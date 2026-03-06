/**
 * Vector Search Service
 *
 * Provides semantic search over Bible verses using pre-computed embeddings.
 * All embeddings are pre-computed - no on-device embedding generation.
 *
 * Architecture:
 * - Embeddings stored in SQLite (embeddings.db)
 * - Loaded into memory on first search (~48MB for all verses)
 * - Pure JavaScript cosine similarity (expo-sqlite doesn't support sqlite-vec)
 * - Query bank for instant matches on common questions
 */

import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEmbeddingsDatabasePath } from '../../utils/dbLoader';
import { EMBEDDINGS_VERSION, EMBEDDINGS_VERSION_KEY } from '../../config/databaseVersion';
import { getBookName } from '../bible/bibleBookMappings';

// Key to track SQLite directory copy version
const SQLITE_EMBEDDINGS_VERSION_KEY = '@parables/sqlite_embeddings_version';
import {
  jaroWinkler,
  suggestBiblicalTerms,
  correctWord,
  type FuzzyMatch,
} from './fuzzyMatcher';

// Re-export fuzzy matching utilities for UI usage (e.g., "Did you mean?" suggestions)
export { correctBiblicalTerm, suggestBiblicalTerms, type FuzzyMatch } from './fuzzyMatcher';

// =============================================================================
// TYPES
// =============================================================================

export interface SemanticSearchResult {
  verseId: number;
  bibleRef: string; // e.g., "John 3:16"
  verseText: string;
  score: number; // Cosine similarity 0-1
  bookId: number;
  chapter: number;
  verse: number;
}

export interface PassageSearchResult {
  bibleRef: string; // e.g., "Genesis 1:3-5" for grouped, or "John 3:16" for single
  verses: SemanticSearchResult[]; // Individual verses in this passage
  averageScore: number; // Average of all verse scores
  startVerse: number;
  endVerse: number;
  bookId: number;
  chapter: number;
  verseCount: number;
}

interface VerseEmbedding {
  verseId: number;
  verseText: string;
  enrichedDescription: string | null; // Pastor Kenny's enrichment for semantic matching
  bookId: number;
  chapter: number;
  verse: number;
  embedding: Float32Array; // Combined embedding (legacy)
  verseEmbedding: Float32Array | null; // Verse text only - for dual signal search
  enrichmentEmbedding: Float32Array | null; // Enrichment only - for dual signal search
}

interface QueryBankEntry {
  queryText: string;
  category: string;
  embedding: Float32Array;
  topVerseIds: number[];
}

// =============================================================================
// STATE
// =============================================================================

let embeddingsDb: SQLiteDatabase | null = null;
let isInitialized = false;
let isDbLoading = false;

// In-memory cache for fast search
let verseEmbeddings: Map<number, VerseEmbedding> = new Map();
let queryBank: Map<string, QueryBankEntry> = new Map();

// Embedding dimensions
// Using all-MiniLM-L6-v2 for on-device compatible embeddings
const EMBEDDING_DIM = 384;

// Track if database uses int8 quantization
let isQuantizedInt8 = false;

// Loading state for embeddings - prevents concurrent loading
let embeddingsLoadPromise: Promise<void> | null = null;

// =============================================================================
// INT8 DE-QUANTIZATION
// =============================================================================

/**
 * De-quantize int8 embedding back to float32 using stored min/max parameters
 *
 * Quantization formula: quantized = (normalized * 255) - 128
 * Where normalized = (value - min) / (max - min)
 *
 * De-quantization formula: value = ((quantized + 128) / 255) * (max - min) + min
 */
function dequantizeInt8ToFloat32(
  int8Bytes: Uint8Array,
  paramsBytes: Uint8Array
): Float32Array {
  // Parse min/max from params (2 float32s = 8 bytes)
  const paramsView = new DataView(paramsBytes.buffer, paramsBytes.byteOffset, paramsBytes.byteLength);
  const minVal = paramsView.getFloat32(0, true); // little-endian
  const maxVal = paramsView.getFloat32(4, true);

  const range = maxVal - minVal;
  const result = new Float32Array(int8Bytes.length);

  // Convert int8 values to signed (-128 to 127)
  const int8View = new Int8Array(int8Bytes.buffer, int8Bytes.byteOffset, int8Bytes.byteLength);

  for (let i = 0; i < int8View.length; i++) {
    // De-quantize: normalize back to 0-1 then scale to original range
    const normalized = (int8View[i] + 128) / 255;
    result[i] = normalized * range + minVal;
  }

  return result;
}

// =============================================================================
// BINARY CACHE - Fast loading of pre-parsed embeddings
// =============================================================================

const BINARY_CACHE_VERSION = '2'; // Increment when cache format changes
const EMBEDDINGS_CACHE_FILE = 'embeddings_cache.bin';
const METADATA_CACHE_FILE = 'embeddings_metadata.json';
const CACHE_VERSION_KEY = '@parables/embeddings_cache_version';

interface CacheMetadata {
  version: string;
  embeddingsVersion: string;
  verseCount: number;
  queryBankCount: number;
  verses: Array<{
    verseId: number;
    verseText: string;
    enrichedDescription: string | null;
    bookId: number;
    chapter: number;
    verse: number;
    hasVerseEmbedding: boolean;
    hasEnrichmentEmbedding: boolean;
  }>;
  queryBank: Array<{
    queryText: string;
    category: string;
    topVerseIds: number[];
  }>;
}

/**
 * Check if binary cache exists and is valid
 */
async function isCacheValid(): Promise<boolean> {
  try {
    const cacheVersion = await AsyncStorage.getItem(CACHE_VERSION_KEY);
    const expectedVersion = `${BINARY_CACHE_VERSION}_${EMBEDDINGS_VERSION.current}`;
    console.log('[VectorSearch] Cache version check:', cacheVersion, 'vs expected:', expectedVersion);

    if (cacheVersion !== expectedVersion) {
      console.log('[VectorSearch] Cache version mismatch');
      return false;
    }

    // Use legacy API to check cache files exist
    const cachePath = FileSystemLegacy.cacheDirectory;
    if (!cachePath) {
      console.log('[VectorSearch] No cache directory available');
      return false;
    }

    const binaryPath = `${cachePath}${EMBEDDINGS_CACHE_FILE}`;
    const metadataPath = `${cachePath}${METADATA_CACHE_FILE}`;

    const binaryInfo = await FileSystemLegacy.getInfoAsync(binaryPath);
    const metadataInfo = await FileSystemLegacy.getInfoAsync(metadataPath);

    console.log('[VectorSearch] Cache files exist - binary:', binaryInfo.exists, 'metadata:', metadataInfo.exists);

    return binaryInfo.exists && metadataInfo.exists;
  } catch (error) {
    console.error('[VectorSearch] isCacheValid error:', error);
    return false;
  }
}

/**
 * Load embeddings from binary cache (FAST)
 * Returns true if loaded successfully, false if cache invalid
 */
async function loadFromBinaryCache(): Promise<boolean> {
  try {
    const startTime = Date.now();
    console.log('[VectorSearch] Loading from binary cache...');

    const cachePath = FileSystemLegacy.cacheDirectory;
    if (!cachePath) {
      console.log('[VectorSearch] No cache directory');
      return false;
    }

    // Read metadata using legacy API
    const metadataPath = `${cachePath}${METADATA_CACHE_FILE}`;
    const metadataText = await FileSystemLegacy.readAsStringAsync(metadataPath);
    const metadata: CacheMetadata = JSON.parse(metadataText);

    // Read binary embeddings using legacy API
    const binaryPath = `${cachePath}${EMBEDDINGS_CACHE_FILE}`;
    const binaryBase64 = await FileSystemLegacy.readAsStringAsync(binaryPath, {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });

    // Decode base64 to ArrayBuffer
    const binaryString = atob(binaryBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const allEmbeddings = new Float32Array(bytes.buffer);

    // Calculate embedding counts per verse
    // Each verse can have: 1 main + 1 verse-only + 1 enrichment-only = up to 3 embeddings
    let embeddingOffset = 0;

    // Load verse embeddings
    for (const verseMeta of metadata.verses) {
      // Main embedding (always present)
      const embedding = allEmbeddings.slice(embeddingOffset, embeddingOffset + EMBEDDING_DIM);
      embeddingOffset += EMBEDDING_DIM;

      // Verse-only embedding (optional)
      let verseEmbedding: Float32Array | null = null;
      if (verseMeta.hasVerseEmbedding) {
        verseEmbedding = allEmbeddings.slice(embeddingOffset, embeddingOffset + EMBEDDING_DIM);
        embeddingOffset += EMBEDDING_DIM;
      }

      // Enrichment embedding (optional)
      let enrichmentEmbedding: Float32Array | null = null;
      if (verseMeta.hasEnrichmentEmbedding) {
        enrichmentEmbedding = allEmbeddings.slice(embeddingOffset, embeddingOffset + EMBEDDING_DIM);
        embeddingOffset += EMBEDDING_DIM;
      }

      verseEmbeddings.set(verseMeta.verseId, {
        verseId: verseMeta.verseId,
        verseText: verseMeta.verseText,
        enrichedDescription: verseMeta.enrichedDescription,
        bookId: verseMeta.bookId,
        chapter: verseMeta.chapter,
        verse: verseMeta.verse,
        embedding,
        verseEmbedding,
        enrichmentEmbedding,
      });
    }

    // Load query bank embeddings
    for (const qbMeta of metadata.queryBank) {
      const embedding = allEmbeddings.slice(embeddingOffset, embeddingOffset + EMBEDDING_DIM);
      embeddingOffset += EMBEDDING_DIM;

      queryBank.set(qbMeta.queryText.toLowerCase(), {
        queryText: qbMeta.queryText,
        category: qbMeta.category,
        embedding,
        topVerseIds: qbMeta.topVerseIds,
      });
    }

    const loadTime = Date.now() - startTime;
    console.log(
      `[VectorSearch] Binary cache loaded: ${verseEmbeddings.size} verses, ` +
      `${queryBank.size} query bank entries in ${loadTime}ms`
    );

    return true;
  } catch (error) {
    console.warn('[VectorSearch] Failed to load from binary cache:', error);
    return false;
  }
}

/**
 * Save embeddings to binary cache for fast future loads
 * Uses chunked writing to avoid OutOfMemoryError on low-RAM devices
 */
async function saveToBinaryCache(): Promise<void> {
  try {
    const startTime = Date.now();
    console.log('[VectorSearch] Saving to binary cache (chunked)...');

    const cachePath = FileSystemLegacy.cacheDirectory;
    if (!cachePath) {
      console.log('[VectorSearch] No cache directory for saving');
      return;
    }

    const binaryPath = `${cachePath}${EMBEDDINGS_CACHE_FILE}`;
    const metadataPath = `${cachePath}${METADATA_CACHE_FILE}`;

    // Collect metadata while writing embeddings in chunks
    const versesMetadata: CacheMetadata['verses'] = [];
    const queryBankMetadata: CacheMetadata['queryBank'] = [];

    // Process in chunks to avoid memory spikes
    const CHUNK_SIZE = 2000; // Verses per chunk
    const verseArray = Array.from(verseEmbeddings.values());
    const chunks: string[] = [];

    for (let i = 0; i < verseArray.length; i += CHUNK_SIZE) {
      const chunkVerses = verseArray.slice(i, i + CHUNK_SIZE);

      // Calculate embeddings needed for this chunk
      let chunkEmbeddingCount = 0;
      for (const verse of chunkVerses) {
        chunkEmbeddingCount += 1; // Main embedding
        if (verse.verseEmbedding) chunkEmbeddingCount += 1;
        if (verse.enrichmentEmbedding) chunkEmbeddingCount += 1;
      }

      // Create chunk buffer
      const chunkBuffer = new Float32Array(chunkEmbeddingCount * EMBEDDING_DIM);
      let offset = 0;

      for (const verse of chunkVerses) {
        chunkBuffer.set(verse.embedding, offset);
        offset += EMBEDDING_DIM;

        const hasVerseEmbedding = verse.verseEmbedding !== null;
        const hasEnrichmentEmbedding = verse.enrichmentEmbedding !== null;

        if (verse.verseEmbedding) {
          chunkBuffer.set(verse.verseEmbedding, offset);
          offset += EMBEDDING_DIM;
        }

        if (verse.enrichmentEmbedding) {
          chunkBuffer.set(verse.enrichmentEmbedding, offset);
          offset += EMBEDDING_DIM;
        }

        versesMetadata.push({
          verseId: verse.verseId,
          verseText: verse.verseText,
          enrichedDescription: verse.enrichedDescription,
          bookId: verse.bookId,
          chapter: verse.chapter,
          verse: verse.verse,
          hasVerseEmbedding,
          hasEnrichmentEmbedding,
        });
      }

      // Convert chunk to base64 using efficient method
      const uint8Chunk = new Uint8Array(chunkBuffer.buffer);
      const chunkBase64 = uint8ArrayToBase64(uint8Chunk);
      chunks.push(chunkBase64);

      // Yield to allow GC
      await new Promise(resolve => setTimeout(resolve, 0));
      console.log(`[VectorSearch] Processed chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(verseArray.length / CHUNK_SIZE)}`);
    }

    // Process query bank (small, single chunk)
    const queryBankBuffer = new Float32Array(queryBank.size * EMBEDDING_DIM);
    let qbOffset = 0;
    for (const [, entry] of queryBank) {
      queryBankBuffer.set(entry.embedding, qbOffset);
      qbOffset += EMBEDDING_DIM;
      queryBankMetadata.push({
        queryText: entry.queryText,
        category: entry.category,
        topVerseIds: entry.topVerseIds,
      });
    }
    const qbUint8 = new Uint8Array(queryBankBuffer.buffer);
    chunks.push(uint8ArrayToBase64(qbUint8));

    // Decode all chunks and combine into Uint8Array
    // Calculate total size first
    let totalSize = 0;
    for (const chunk of chunks) {
      totalSize += atob(chunk).length;
    }

    // Allocate combined buffer
    const allBinary = new Uint8Array(totalSize);
    let writeOffset = 0;

    for (const chunk of chunks) {
      const decoded = atob(chunk);
      for (let i = 0; i < decoded.length; i++) {
        allBinary[writeOffset++] = decoded.charCodeAt(i);
      }
      // Allow GC between chunks
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Convert combined binary to base64 using chunked method
    const combinedBase64 = uint8ArrayToBase64(allBinary);

    // Write files
    await FileSystemLegacy.writeAsStringAsync(binaryPath, combinedBase64, {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });

    const metadata: CacheMetadata = {
      version: BINARY_CACHE_VERSION,
      embeddingsVersion: EMBEDDINGS_VERSION.current.toString(),
      verseCount: verseEmbeddings.size,
      queryBankCount: queryBank.size,
      verses: versesMetadata,
      queryBank: queryBankMetadata,
    };
    await FileSystemLegacy.writeAsStringAsync(metadataPath, JSON.stringify(metadata));

    // Mark cache as valid
    await AsyncStorage.setItem(CACHE_VERSION_KEY, `${BINARY_CACHE_VERSION}_${EMBEDDINGS_VERSION.current}`);

    const saveTime = Date.now() - startTime;
    const sizeMB = (allBinary.length / 1024 / 1024).toFixed(2);
    console.log(`[VectorSearch] Binary cache saved: ${sizeMB}MB in ${saveTime}ms`);
  } catch (error) {
    console.error('[VectorSearch] Failed to save binary cache:', error);
    // Non-fatal: app will just load from SQLite next time
  }
}

/**
 * Efficiently convert Uint8Array to base64 string
 * Uses chunked processing to avoid stack overflow on large arrays
 */
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  const CHUNK_SIZE = 0x8000; // 32KB chunks to avoid call stack issues
  const chunks: string[] = [];

  for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
    const chunk = uint8Array.subarray(i, Math.min(i + CHUNK_SIZE, uint8Array.length));
    chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
  }

  return btoa(chunks.join(''));
}

// =============================================================================
// DATABASE INITIALIZATION
// =============================================================================

/**
 * Initialize the embeddings database
 * Call this on app start or before first semantic search
 */
export async function initializeEmbeddingsDb(): Promise<void> {
  if (isInitialized || isDbLoading) return;

  isDbLoading = true;

  try {
    // Use unified dbLoader to get embeddings database path
    // This handles versioning, decompression, and caching
    const dbPath = await getEmbeddingsDatabasePath((progress) => {
      console.log(`[VectorSearch] Loading progress: ${progress}%`);
    });

    console.log('[VectorSearch] Embeddings database path:', dbPath);

    // Ensure SQLite directory exists before copying
    const sqliteDirPath = `${FileSystemLegacy.documentDirectory}SQLite`;
    const sqliteDirInfo = await FileSystemLegacy.getInfoAsync(sqliteDirPath);
    if (!sqliteDirInfo.exists) {
      console.log('[VectorSearch] Creating SQLite directory...');
      await FileSystemLegacy.makeDirectoryAsync(sqliteDirPath, { intermediates: true });
    }

    // Copy to SQLite directory if needed
    const dbName = 'embeddings.db';
    const sqliteDbPath = `${sqliteDirPath}/${dbName}`;
    const sqliteDbInfo = await FileSystemLegacy.getInfoAsync(sqliteDbPath);

    // Check SQLite copy version - need to re-copy if version changed
    const sqliteVersion = await AsyncStorage.getItem(SQLITE_EMBEDDINGS_VERSION_KEY);
    const needsCopy = !sqliteDbInfo.exists || sqliteVersion !== EMBEDDINGS_VERSION.current.toString();

    if (needsCopy) {
      console.log('[VectorSearch] Copying embeddings to SQLite directory...');

      // Delete old copy if exists
      if (sqliteDbInfo.exists) {
        await FileSystemLegacy.deleteAsync(sqliteDbPath, { idempotent: true });
      }

      // Source file is the one downloaded by dbLoader
      const sourcePath = `${FileSystemLegacy.documentDirectory}embeddings.db`;
      const sourceInfo = await FileSystemLegacy.getInfoAsync(sourcePath);

      if (!sourceInfo.exists) {
        console.error('[VectorSearch] Source embeddings.db not found at:', sourcePath);
        console.log('[VectorSearch] dbPath was:', dbPath);
        // Use the dbPath from getEmbeddingsDatabasePath instead
        if (dbPath !== sourcePath) {
          console.log('[VectorSearch] Trying dbPath as source');
          await FileSystemLegacy.copyAsync({ from: dbPath, to: sqliteDbPath });
        } else {
          throw new Error('Embeddings database file not found');
        }
      } else {
        console.log('[VectorSearch] Copying from:', sourcePath, 'to:', sqliteDbPath);
        await FileSystemLegacy.copyAsync({ from: sourcePath, to: sqliteDbPath });
      }

      // Track SQLite copy version
      await AsyncStorage.setItem(SQLITE_EMBEDDINGS_VERSION_KEY, EMBEDDINGS_VERSION.current.toString());
      console.log('[VectorSearch] Embeddings copied to SQLite directory');
    }

    // Open database
    embeddingsDb = await openDatabaseAsync(dbName);

    // Enable WAL mode
    await embeddingsDb.execAsync('PRAGMA journal_mode = WAL');

    isInitialized = true;
    console.log('[VectorSearch] Embeddings database initialized (version', EMBEDDINGS_VERSION.current + ')');
  } catch (error) {
    console.error('[VectorSearch] Failed to initialize:', error);
  } finally {
    isDbLoading = false;
  }
}

/** Progress callback for embedding loading */
export type EmbeddingLoadProgress = {
  phase: 'cache' | 'sqlite' | 'complete';
  percent: number;
  message: string;
};

/**
 * Load all embeddings into memory for fast search
 * Uses binary cache for fast subsequent loads
 *
 * @param onProgress - Optional callback for progress updates
 */
export async function loadEmbeddingsToMemory(
  onProgress?: (progress: EmbeddingLoadProgress) => void
): Promise<void> {
  // Already loaded - return immediately
  if (verseEmbeddings.size > 0) {
    console.log('[VectorSearch] Embeddings already loaded, skipping');
    onProgress?.({ phase: 'complete', percent: 100, message: 'Already loaded' });
    return;
  }

  // If already loading, wait for that to complete (prevents concurrent loading)
  if (embeddingsLoadPromise) {
    console.log('[VectorSearch] Embeddings already loading, waiting...');
    await embeddingsLoadPromise;
    onProgress?.({ phase: 'complete', percent: 100, message: 'Loaded' });
    return;
  }

  // Create the loading promise
  embeddingsLoadPromise = (async () => {
    console.log('[VectorSearch] Starting embeddings load...');
    const startTime = Date.now();

    try {
      await loadEmbeddingsInternal(onProgress, startTime);
    } finally {
      embeddingsLoadPromise = null;
    }
  })();

  await embeddingsLoadPromise;
}

/**
 * Internal function that does the actual loading
 */
async function loadEmbeddingsInternal(
  onProgress: ((progress: EmbeddingLoadProgress) => void) | undefined,
  startTime: number
): Promise<void> {

  // Try loading from binary cache first (FAST path)
  console.log('[VectorSearch] Checking if binary cache is valid...');
  onProgress?.({ phase: 'cache', percent: 0, message: 'Checking cache...' });
  const cacheValid = await isCacheValid();
  console.log('[VectorSearch] Cache valid:', cacheValid);

  if (cacheValid) {
    onProgress?.({ phase: 'cache', percent: 10, message: 'Loading from cache...' });
    console.log('[VectorSearch] Loading from binary cache...');
    const cacheLoaded = await loadFromBinaryCache();
    console.log('[VectorSearch] Cache loaded:', cacheLoaded);
    if (cacheLoaded) {
      onProgress?.({ phase: 'complete', percent: 100, message: 'Loaded from cache' });
      return; // Successfully loaded from cache
    }
  }

  // Binary cache miss - load from SQLite (SLOW path)
  console.log('[VectorSearch] Binary cache miss, loading from SQLite...');
  onProgress?.({ phase: 'sqlite', percent: 0, message: 'Initializing database...' });

  if (!embeddingsDb) {
    await initializeEmbeddingsDb();
  }

  if (!embeddingsDb) {
    console.error('[VectorSearch] No database available');
    onProgress?.({ phase: 'sqlite', percent: 0, message: 'Database unavailable' });
    return;
  }

  try {
    // Debug: Check table structure
    const tableInfo = await embeddingsDb.getAllAsync<{ name: string; type: string }>(
      `PRAGMA table_info(verse_embeddings)`
    );
    console.log('[VectorSearch] Table columns:', tableInfo.map(c => `${c.name}:${c.type}`).join(', '));

    // Check if database uses int8 quantization (has embedding_params column)
    const hasParamsColumn = tableInfo.some(c => c.name === 'embedding_params');
    isQuantizedInt8 = hasParamsColumn;
    console.log(`[VectorSearch] Database format: ${isQuantizedInt8 ? 'int8 quantized' : 'float32'}`);

    // Debug: Check row count
    const countResult = await embeddingsDb.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM verse_embeddings`
    );
    console.log('[VectorSearch] Total rows in verse_embeddings:', countResult?.count);

    // Debug: Check embeddings that are not null and not placeholder (all zeros)
    const nonNullCount = await embeddingsDb.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM verse_embeddings WHERE embedding IS NOT NULL`
    );
    console.log('[VectorSearch] Rows with non-null embedding:', nonNullCount?.count);

    // Load verse embeddings in batches to reduce memory pressure on low-RAM devices
    const BATCH_SIZE = 3000;
    let offset = 0;
    let totalLoaded = 0;
    let validCount = 0;
    let invalidCount = 0;
    let zeroEmbeddingCount = 0;

    // Get total count for progress logging
    const totalCount = nonNullCount?.count || 31000;

    while (true) {
      // Query batch with LIMIT and OFFSET
      const verses = isQuantizedInt8
        ? await embeddingsDb.getAllAsync<{
            verse_id: number;
            verse_text: string;
            enriched_description: string | null;
            book_id: number;
            chapter: number;
            verse: number;
            embedding: ArrayBuffer;
            embedding_params: ArrayBuffer;
            verse_embedding: ArrayBuffer | null;
            verse_embedding_params: ArrayBuffer | null;
            enrichment_embedding: ArrayBuffer | null;
            enrichment_embedding_params: ArrayBuffer | null;
          }>(`
            SELECT verse_id, verse_text, enriched_description, book_id, chapter, verse,
                   embedding, embedding_params,
                   verse_embedding, verse_embedding_params,
                   enrichment_embedding, enrichment_embedding_params
            FROM verse_embeddings
            WHERE embedding IS NOT NULL
            ORDER BY verse_id
            LIMIT ${BATCH_SIZE} OFFSET ${offset}
          `)
        : await embeddingsDb.getAllAsync<{
            verse_id: number;
            verse_text: string;
            enriched_description: string | null;
            book_id: number;
            chapter: number;
            verse: number;
            embedding: ArrayBuffer;
            verse_embedding: ArrayBuffer | null;
            enrichment_embedding: ArrayBuffer | null;
          }>(`
            SELECT verse_id, verse_text, enriched_description, book_id, chapter, verse,
                   embedding, verse_embedding, enrichment_embedding
            FROM verse_embeddings
            WHERE embedding IS NOT NULL
            ORDER BY verse_id
            LIMIT ${BATCH_SIZE} OFFSET ${offset}
          `);

      if (verses.length === 0) {
        break; // No more rows
      }

      const progressPercent = Math.round((offset + verses.length) / totalCount * 100);
      const batchNum = Math.floor(offset / BATCH_SIZE) + 1;
      console.log(`[VectorSearch] Processing batch ${batchNum}: ${verses.length} verses (${progressPercent}%)`);
      onProgress?.({
        phase: 'sqlite',
        percent: progressPercent,
        message: `Loading verses... ${offset + verses.length}/${totalCount}`,
      });

      // Yield to main thread between batches to keep UI responsive
      await new Promise(resolve => setTimeout(resolve, 0));

      // Process batch
      for (const row of verses) {
      let embedding: Float32Array;

      if (isQuantizedInt8) {
        // Int8 format: de-quantize using stored min/max params
        const int8Row = row as typeof row & {
          embedding_params: ArrayBuffer;
          verse_embedding_params: ArrayBuffer | null;
          enrichment_embedding_params: ArrayBuffer | null;
        };

        const embBytes = row.embedding as unknown as Uint8Array;
        const paramsBytes = int8Row.embedding_params as unknown as Uint8Array;

        if (!paramsBytes || paramsBytes.byteLength !== 8) {
          invalidCount++;
          continue;
        }

        embedding = dequantizeInt8ToFloat32(embBytes, paramsBytes);
      } else {
        // Float32 format: direct conversion
        const bytes = row.embedding as unknown as Uint8Array;
        embedding = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      }

      // Check if embedding is all zeros (placeholder)
      const isAllZeros = embedding.every(v => v === 0);
      if (isAllZeros) {
        zeroEmbeddingCount++;
        continue; // Skip placeholder embeddings
      }

      // Only add if embedding has correct dimensions
      if (embedding.length === EMBEDDING_DIM) {
        validCount++;

        // Fix book_id format: if > 66, it's stored as bookId * 1000000
        const bookId = row.book_id > 66 ? Math.floor(row.book_id / 1000000) : row.book_id;

        // Parse verse-only embedding if available
        let verseEmb: Float32Array | null = null;
        if (row.verse_embedding) {
          if (isQuantizedInt8) {
            const int8Row = row as typeof row & { verse_embedding_params: ArrayBuffer | null };
            if (int8Row.verse_embedding_params) {
              const veBytes = row.verse_embedding as unknown as Uint8Array;
              const veParams = int8Row.verse_embedding_params as unknown as Uint8Array;
              if (veParams.byteLength === 8) {
                const ve = dequantizeInt8ToFloat32(veBytes, veParams);
                if (ve.length === EMBEDDING_DIM && !ve.every(v => v === 0)) {
                  verseEmb = ve;
                }
              }
            }
          } else {
            const veBytes = row.verse_embedding as unknown as Uint8Array;
            const ve = new Float32Array(veBytes.buffer, veBytes.byteOffset, veBytes.byteLength / 4);
            if (ve.length === EMBEDDING_DIM && !ve.every(v => v === 0)) {
              verseEmb = ve;
            }
          }
        }

        // Parse enrichment-only embedding if available
        let enrichEmb: Float32Array | null = null;
        if (row.enrichment_embedding) {
          if (isQuantizedInt8) {
            const int8Row = row as typeof row & { enrichment_embedding_params: ArrayBuffer | null };
            if (int8Row.enrichment_embedding_params) {
              const eeBytes = row.enrichment_embedding as unknown as Uint8Array;
              const eeParams = int8Row.enrichment_embedding_params as unknown as Uint8Array;
              if (eeParams.byteLength === 8) {
                const ee = dequantizeInt8ToFloat32(eeBytes, eeParams);
                if (ee.length === EMBEDDING_DIM && !ee.every(v => v === 0)) {
                  enrichEmb = ee;
                }
              }
            }
          } else {
            const eeBytes = row.enrichment_embedding as unknown as Uint8Array;
            const ee = new Float32Array(eeBytes.buffer, eeBytes.byteOffset, eeBytes.byteLength / 4);
            if (ee.length === EMBEDDING_DIM && !ee.every(v => v === 0)) {
              enrichEmb = ee;
            }
          }
        }

        verseEmbeddings.set(row.verse_id, {
          verseId: row.verse_id,
          verseText: row.verse_text,
          enrichedDescription: row.enriched_description,
          bookId,
          chapter: row.chapter,
          verse: row.verse,
          embedding,
          verseEmbedding: verseEmb,
          enrichmentEmbedding: enrichEmb,
        });
      } else {
        invalidCount++;
        if (invalidCount <= 3) {
          console.log('[VectorSearch] Invalid embedding dimension:', embedding.length, 'for verse', row.verse_id);
        }
      }
    }

      totalLoaded += verses.length;
      offset += BATCH_SIZE;

      // Yield to event loop between batches to prevent UI blocking
      await new Promise(resolve => setTimeout(resolve, 10));

      // If batch was smaller than BATCH_SIZE, we've reached the end
      if (verses.length < BATCH_SIZE) {
        break;
      }
    }

    console.log(`[VectorSearch] Embedding analysis: ${validCount} valid, ${invalidCount} invalid dimensions, ${zeroEmbeddingCount} placeholders (all zeros)`)

    // Load query bank - format depends on quantization
    if (isQuantizedInt8) {
      const queries = await embeddingsDb.getAllAsync<{
        query_text: string;
        category: string;
        embedding: ArrayBuffer;
        embedding_params: ArrayBuffer;
        top_verse_ids: string;
      }>(`
        SELECT query_text, category, embedding, embedding_params, top_verse_ids
        FROM query_bank
      `);

      for (const row of queries) {
        const embBytes = row.embedding as unknown as Uint8Array;
        const paramsBytes = row.embedding_params as unknown as Uint8Array;

        if (paramsBytes && paramsBytes.byteLength === 8) {
          const embedding = dequantizeInt8ToFloat32(embBytes, paramsBytes);
          if (embedding.length === EMBEDDING_DIM) {
            queryBank.set(row.query_text.toLowerCase(), {
              queryText: row.query_text,
              category: row.category,
              embedding,
              topVerseIds: JSON.parse(row.top_verse_ids || '[]'),
            });
          }
        }
      }
    } else {
      const queries = await embeddingsDb.getAllAsync<{
        query_text: string;
        category: string;
        embedding: ArrayBuffer;
        top_verse_ids: string;
      }>(`
        SELECT query_text, category, embedding, top_verse_ids
        FROM query_bank
      `);

      for (const row of queries) {
        // Convert BLOB (Uint8Array) to Float32Array
        const bytes = row.embedding as unknown as Uint8Array;
        const embedding = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
        if (embedding.length === EMBEDDING_DIM) {
          queryBank.set(row.query_text.toLowerCase(), {
            queryText: row.query_text,
            category: row.category,
            embedding,
            topVerseIds: JSON.parse(row.top_verse_ids || '[]'),
          });
        }
      }
    }

    const loadTime = Date.now() - startTime;
    console.log(
      `[VectorSearch] Loaded ${verseEmbeddings.size} verse embeddings, ` +
        `${queryBank.size} query bank entries from SQLite in ${loadTime}ms`,
    );

    onProgress?.({
      phase: 'complete',
      percent: 100,
      message: `Loaded ${verseEmbeddings.size} verses in ${(loadTime / 1000).toFixed(1)}s`,
    });

    // NOTE: Binary cache disabled - still causes OOM on low-RAM devices
    // Background loading provides instant app start, so cache isn't critical
    // SQLite load (~9s) happens in background while user can use the app
  } catch (error) {
    console.error('[VectorSearch] Failed to load embeddings:', error);
    onProgress?.({ phase: 'sqlite', percent: 0, message: 'Failed to load embeddings' });
  }
}

// =============================================================================
// VECTOR OPERATIONS
// =============================================================================

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1 (higher = more similar)
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Format verse info to bibleRef string
 * Uses stored bookId/chapter/verse for accuracy
 */
function formatBibleRef(bookId: number, chapter: number, verse: number): string {
  const bookName = getBookName(bookId);
  return `${bookName} ${chapter}:${verse}`;
}

// =============================================================================
// SEARCH FUNCTIONS
// =============================================================================

/**
 * Check query bank for an instant match
 * Returns pre-computed top results if query matches
 */
export async function checkQueryBank(
  query: string,
): Promise<SemanticSearchResult[] | null> {
  if (queryBank.size === 0) {
    await loadEmbeddingsToMemory();
  }

  // Exact match in query bank
  const normalizedQuery = query.toLowerCase().trim();
  const entry = queryBank.get(normalizedQuery);

  if (entry && entry.topVerseIds.length > 0) {
    // Return pre-computed results
    const results: SemanticSearchResult[] = [];

    for (const verseId of entry.topVerseIds) {
      const verse = verseEmbeddings.get(verseId);
      if (verse) {
        results.push({
          verseId: verse.verseId,
          bibleRef: formatBibleRef(verse.bookId, verse.chapter, verse.verse),
          verseText: verse.verseText,
          score: 1.0, // Pre-computed matches are considered perfect
          bookId: verse.bookId,
          chapter: verse.chapter,
          verse: verse.verse,
        });
      }
    }

    return results;
  }

  return null;
}

/**
 * Yield to the event loop to allow UI updates during long-running operations
 */
function yieldToUI(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Search for similar verses using a query embedding
 * Uses DUAL SIGNAL scoring: max(verse_similarity, enrichment_similarity)
 * This captures matches from either the verse text OR the theological enrichment
 *
 * IMPORTANT: Yields to UI thread every 2000 verses to prevent blocking
 */
export async function searchByEmbedding(
  queryEmbedding: Float32Array,
  limit: number = 20,
): Promise<SemanticSearchResult[]> {
  if (verseEmbeddings.size === 0) {
    await loadEmbeddingsToMemory();
  }

  if (verseEmbeddings.size === 0) {
    console.warn('[VectorSearch] No embeddings loaded');
    return [];
  }

  const startTime = Date.now();

  // Calculate DUAL SIGNAL similarity scores for all verses
  // Score = max(verse_similarity, enrichment_similarity)
  // This way a verse ranks high if query matches EITHER the verse text OR the enrichment
  const scores: { verseId: number; score: number }[] = [];

  // PERF: Yield to UI every N verses to prevent blocking the JS thread
  // This allows user input to be processed even during long searches
  const YIELD_INTERVAL = 2000;
  let processedCount = 0;

  for (const [verseId, verse] of verseEmbeddings) {
    let score: number;

    // Use dual signal if both embeddings are available
    if (verse.verseEmbedding && verse.enrichmentEmbedding) {
      const verseSim = cosineSimilarity(queryEmbedding, verse.verseEmbedding);
      const enrichSim = cosineSimilarity(queryEmbedding, verse.enrichmentEmbedding);
      score = Math.max(verseSim, enrichSim); // Dual signal: best of both
    } else {
      // Fallback to combined embedding
      score = cosineSimilarity(queryEmbedding, verse.embedding);
    }

    scores.push({ verseId, score });

    // Yield to UI periodically to prevent blocking
    processedCount++;
    if (processedCount % YIELD_INTERVAL === 0) {
      await yieldToUI();
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Take top results
  const topResults = scores.slice(0, limit);

  // Build result objects
  const results: SemanticSearchResult[] = topResults.map(({ verseId, score }) => {
    const verse = verseEmbeddings.get(verseId)!;
    return {
      verseId: verse.verseId,
      bibleRef: formatBibleRef(verse.bookId, verse.chapter, verse.verse),
      verseText: verse.verseText,
      score,
      bookId: verse.bookId,
      chapter: verse.chapter,
      verse: verse.verse,
    };
  });

  const searchTime = Date.now() - startTime;
  console.log(
    `[VectorSearch] Dual signal search ${verseEmbeddings.size} verses in ${searchTime}ms`,
  );

  return results;
}

// =============================================================================
// QUERY REFORMULATION (General Algorithmic Approach)
// =============================================================================

/**
 * Question scaffolding words to strip - these add no semantic value
 * Works for ANY query structure, not just predefined patterns
 */
const QUESTION_WORDS = new Set([
  'why', 'how', 'what', 'when', 'where', 'who', 'which',
  'did', 'does', 'do', 'is', 'are', 'was', 'were', 'will', 'would', 'could', 'should',
  'can', 'may', 'might', 'must', 'shall',
  'to', 'the', 'a', 'an', 'my', 'your', 'our', 'their',
  'i', 'we', 'you', 'he', 'she', 'it', 'they',
  'am', 'be', 'been', 'being', 'have', 'has', 'had',
]);

/**
 * Name synonyms - algorithmic expansion for common religious terms
 */
const NAME_SYNONYMS: Record<string, string[]> = {
  'jesus': ['christ', 'lord', 'son', 'savior'],
  'god': ['lord', 'father', 'almighty'],
  'spirit': ['holy spirit', 'ghost'],
  'heaven': ['kingdom', 'paradise'],
  'sin': ['transgression', 'iniquity'],
};

/**
 * Connectors for generating statement variations
 */
const CONNECTORS = ['to', 'by', 'for', 'through', 'of', 'in'];

/**
 * Question-type semantic expansions
 * Maps trigger words to semantic intent words that match explanatory prose
 */
const QUESTION_SEMANTICS: Record<string, string[]> = {
  'why': ['purpose', 'reason', 'because', 'mission', 'came'],
  'how': ['way', 'method', 'means', 'able'],
  'what': ['meaning', 'definition', 'nature', 'plan'],
  'overcome': ['not', 'peace', 'free', 'deliver'],
};

/**
 * Extract content words from query (remove question scaffolding)
 */
function extractContentWords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[?!.,;:'"]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !QUESTION_WORDS.has(w));
}

/**
 * General query reformulation - works for ANY query
 *
 * Algorithm:
 * 1. Keep original query
 * 2. Extract content words (strip question scaffolding)
 * 3. Add question-type semantic intent words
 * 4. Generate variations with connectors
 * 5. Generate negation variations
 * 6. Expand name synonyms across all variations
 */
function reformulateQuery(query: string): string[] {
  const normalized = query.toLowerCase().trim().replace(/\?$/, '');
  const results = new Set<string>([normalized]);

  // Extract core content words
  const contentWords = extractContentWords(normalized);
  if (contentWords.length === 0) return [normalized];

  const corePhrase = contentWords.join(' ');
  results.add(corePhrase);

  // Detect question type and add semantic intent words
  for (const [trigger, semantics] of Object.entries(QUESTION_SEMANTICS)) {
    if (normalized.includes(trigger)) {
      for (const sem of semantics) {
        results.add(`${corePhrase} ${sem}`);
        results.add(`${sem} ${corePhrase}`);
      }
    }
  }

  // Generate connector variations
  for (const conn of CONNECTORS) {
    results.add(`${corePhrase} ${conn}`);
  }

  // Generate negation variations
  results.add(`not ${corePhrase}`);
  results.add(`no ${corePhrase}`);

  // Expand name synonyms across ALL variations
  const withSynonyms = new Set(results);
  for (const phrase of results) {
    for (const [word, synonyms] of Object.entries(NAME_SYNONYMS)) {
      if (phrase.includes(word)) {
        for (const syn of synonyms) {
          withSynonyms.add(phrase.replace(new RegExp(word, 'g'), syn));
        }
      }
    }
  }

  return Array.from(withSynonyms);
}

/**
 * Extract unique keywords from all reformulated queries
 * This expands the search to include biblical vocabulary
 */
function getExpandedKeywords(query: string): string[] {
  const reformulations = reformulateQuery(query);
  const allWords = new Set<string>();

  for (const text of reformulations) {
    const words = text.split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
    for (const word of words) {
      allWords.add(normalizeWord(word));
    }
  }

  return Array.from(allWords);
}

// Common stop words to ignore in matching
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'about', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'between', 'under', 'again', 'further', 'then', 'once',
  'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you',
  'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself',
  'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them',
  'their', 'theirs', 'themselves', 'bible', 'verse', 'verses', 'says', 'say'
]);

/**
 * Find the best matching query in query bank to use its embedding
 * Requires meaningful word overlap - no weak matches
 */
export async function findSimilarQueryBankEntry(
  query: string,
): Promise<{ entry: QueryBankEntry; matchType: 'exact' | 'overlap' | 'similar'; matchKey: string } | null> {
  if (queryBank.size === 0) {
    await loadEmbeddingsToMemory();
  }

  const normalizedQuery = query.toLowerCase().trim();

  // First, try exact match
  const exactMatch = queryBank.get(normalizedQuery);
  if (exactMatch) {
    return { entry: exactMatch, matchType: 'exact', matchKey: normalizedQuery };
  }

  // Extract meaningful words (no stop words, min length 3)
  const queryWords = normalizedQuery
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));

  if (queryWords.length === 0) {
    return null;
  }

  let bestOverlapEntry: QueryBankEntry | null = null;
  let bestOverlapScore = 0;
  let bestOverlapKey = '';
  let bestMatchCount = 0;

  let bestSimilarEntry: QueryBankEntry | null = null;
  let bestSimilarScore = 0;
  let bestSimilarKey = '';

  for (const [key, entry] of queryBank) {
    const entryWords = key
      .split(/\s+/)
      .filter(w => w.length >= 3 && !STOP_WORDS.has(w));

    // Exact word match only (no substring matching)
    let matchingWords = 0;
    for (const qWord of queryWords) {
      if (entryWords.includes(qWord)) {
        matchingWords++;
      }
    }

    // Only consider if at least one meaningful word matches
    if (matchingWords > 0) {
      // Score = proportion of query words matched
      const overlapScore = matchingWords / queryWords.length;

      if (overlapScore > bestOverlapScore ||
          (overlapScore === bestOverlapScore && matchingWords > bestMatchCount)) {
        bestOverlapScore = overlapScore;
        bestOverlapEntry = entry;
        bestOverlapKey = key;
        bestMatchCount = matchingWords;
      }
    }

    // Also check Jaro-Winkler for typo handling (on full query)
    const jwScore = jaroWinkler(normalizedQuery, key);
    if (jwScore > bestSimilarScore) {
      bestSimilarScore = jwScore;
      bestSimilarEntry = entry;
      bestSimilarKey = key;
    }
  }

  // Require ALL meaningful words to match (100% overlap)
  // This prevents matching "birth of jesus" to "why did jesus have to die?" just because of "jesus"
  if (bestOverlapScore === 1.0 && bestOverlapEntry) {
    console.log(`[VectorSearch] Query bank match: "${normalizedQuery}" → "${bestOverlapKey}" (all ${bestMatchCount} words)`);
    return { entry: bestOverlapEntry, matchType: 'overlap', matchKey: bestOverlapKey };
  }

  // Fall back to very high similarity match (for typos, >92%)
  if (bestSimilarScore >= 0.92 && bestSimilarEntry) {
    console.log(`[VectorSearch] Query bank typo match: "${normalizedQuery}" → "${bestSimilarKey}" (${(bestSimilarScore * 100).toFixed(0)}%)`);
    return { entry: bestSimilarEntry, matchType: 'similar', matchKey: bestSimilarKey };
  }

  // No good match - will fall through to verse text search
  return null;
}

/** Progress callback for search */
export type SearchProgress = {
  phase: 'loading' | 'finding_seeds' | 'calculating' | 'complete';
  percent: number;
  message: string;
};

/**
 * Main semantic search function
 * Uses embeddings for cosine similarity search
 *
 * Strategy: Find seed verses containing query keywords, average their embeddings
 * weighted by match quality, then search for similar verses with aggressive
 * keyword boosting.
 */
export async function semanticSearch(
  query: string,
  limit: number = 20,
  onProgress?: (progress: SearchProgress) => void,
): Promise<SemanticSearchResult[]> {
  console.log('[VectorSearch] === SEMANTIC SEARCH START ===');
  console.log('[VectorSearch] Query:', query);
  console.log('[VectorSearch] Embeddings loaded:', verseEmbeddings.size);

  onProgress?.({ phase: 'loading', percent: 0, message: 'Searching scripture...' });

  // Ensure embeddings are loaded
  if (verseEmbeddings.size === 0) {
    await loadEmbeddingsToMemory();
  }

  if (verseEmbeddings.size === 0) {
    console.warn('[VectorSearch] Semantic search unavailable - no embeddings');
    onProgress?.({ phase: 'complete', percent: 100, message: 'Search unavailable' });
    return [];
  }

  onProgress?.({ phase: 'finding_seeds', percent: 20, message: 'Searching scripture...' });

  // Pure embedding-based search using weighted seed averaging
  const results = await searchByVerseSeeds(query, limit, onProgress);

  onProgress?.({ phase: 'complete', percent: 100, message: 'Complete' });

  if (results.length > 0) {
    console.log('[VectorSearch] Top result:', results[0]?.bibleRef, `(${(results[0]?.score * 100).toFixed(1)}%)`);
  }
  return results;
}

/**
 * Normalize a word for matching:
 * - Lowercase
 * - Remove possessive suffixes ('s, 's)
 * - Remove common suffixes for root matching
 */
function normalizeWord(word: string): string {
  let normalized = word.toLowerCase();
  // Remove possessive suffixes
  normalized = normalized.replace(/'s$/, '').replace(/'s$/, '');
  return normalized;
}

/**
 * Search by finding seed verses that contain query words,
 * then use their WEIGHTED embeddings to find semantically similar verses.
 *
 * Improvements over simple averaging:
 * - Seeds are weighted by match quality (more keywords = higher weight)
 * - Enriched description matches get bonus weight (theological concepts)
 * - Aggressive keyword boosting (50%) for results containing query words
 * - Uses fuzzy matching when exact words aren't found
 */
async function searchByVerseSeeds(
  query: string,
  limit: number,
  onProgress?: (progress: SearchProgress) => void,
): Promise<SemanticSearchResult[]> {
  const queryLower = query.toLowerCase();
  const rawWords = queryLower
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));

  // Normalize words (remove possessives, etc.)
  const queryWords = rawWords.map(normalizeWord).filter(w => w.length >= 3);

  if (queryWords.length === 0) {
    return [];
  }

  console.log('[VectorSearch] Seed words:', queryWords.join(', '));

  onProgress?.({ phase: 'finding_seeds', percent: 30, message: 'Searching scripture...' });

  // Try to find seeds with original words first
  let { seeds, searchWords, fuzzyPenalty } = await findSeedVerses(queryWords);

  // If no seeds found, try fuzzy matching for each word
  if (seeds.length === 0) {
    console.log('[VectorSearch] No exact matches, trying fuzzy correction...');

    const correctedWords: string[] = [];
    let totalFuzzyScore = 0;
    let fuzzyCount = 0;

    for (const word of queryWords) {
      const correction = correctWord(word);
      if (correction && correction.score >= 0.8) {
        console.log(`[VectorSearch] Fuzzy: "${word}" → "${correction.term}" (${correction.method}, ${(correction.score * 100).toFixed(0)}%)`);
        correctedWords.push(correction.term);
        totalFuzzyScore += correction.score;
        fuzzyCount++;
      } else {
        // Keep original word if no good correction found
        correctedWords.push(word);
      }
    }

    // Calculate fuzzy penalty (average of fuzzy match scores)
    fuzzyPenalty = fuzzyCount > 0 ? totalFuzzyScore / fuzzyCount : 1.0;

    if (correctedWords.some((w, i) => w !== queryWords[i])) {
      console.log('[VectorSearch] Corrected words:', correctedWords.join(', '), `(penalty: ${(fuzzyPenalty * 100).toFixed(0)}%)`);

      // Try again with corrected words
      const result = await findSeedVerses(correctedWords);
      seeds = result.seeds;
      searchWords = correctedWords;
      fuzzyPenalty = result.fuzzyPenalty * fuzzyPenalty; // Compound penalty
    }
  }

  if (seeds.length === 0) {
    console.log('[VectorSearch] No matching verses found (even with fuzzy matching)');
    return [];
  }

  // WEIGHTED average of seed embeddings
  // Seeds with higher weights (better matches) contribute more to the query embedding
  const avgEmbedding = new Float32Array(EMBEDDING_DIM);
  let totalWeight = 0;

  for (const seed of seeds) {
    totalWeight += seed.weight;
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      avgEmbedding[i] += seed.verse.embedding[i] * seed.weight;
    }
  }

  // Normalize by total weight
  if (totalWeight > 0) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      avgEmbedding[i] /= totalWeight;
    }
  }

  // Normalize the averaged embedding to unit length
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    norm += avgEmbedding[i] * avgEmbedding[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      avgEmbedding[i] /= norm;
    }
  }

  // Search using the weighted averaged embedding
  const results = await searchByEmbedding(avgEmbedding, limit * 3);

  // AGGRESSIVE keyword boosting (50% max boost)
  // Also check enriched descriptions for theological concept matches
  const boostedResults = results.map(result => {
    const verse = verseEmbeddings.get(result.verseId);
    const textLower = result.verseText.toLowerCase();
    const enrichedLower = verse?.enrichedDescription?.toLowerCase() || '';

    let textMatchCount = 0;
    let enrichedMatchCount = 0;

    for (const word of searchWords) {
      if (wordMatchesInText(word, textLower)) {
        textMatchCount++;
      }
      if (wordMatchesInText(word, enrichedLower)) {
        enrichedMatchCount++;
      }
    }

    // Calculate boost: up to 50% for text matches, extra 20% for enriched matches
    const textBoost = (textMatchCount / searchWords.length) * 0.5;
    const enrichedBoost = (enrichedMatchCount / searchWords.length) * 0.2;
    const totalBoost = 1 + textBoost + enrichedBoost;

    // Apply fuzzy penalty and boost
    const finalScore = result.score * totalBoost * fuzzyPenalty;
    return { ...result, score: Math.min(1, finalScore) };
  });

  // Re-sort by boosted score
  boostedResults.sort((a, b) => b.score - a.score);

  return boostedResults.slice(0, limit);
}

/**
 * Check if a word matches in text, handling possessives and word boundaries
 * e.g., "david" should match "David's", "david", "DAVID"
 */
function wordMatchesInText(word: string, text: string): boolean {
  // Match word with optional possessive suffix
  const regex = new RegExp(`\\b${word}(?:'s|'s)?\\b`, 'i');
  return regex.test(text);
}

/**
 * Find seed verses containing the given words with weighted scoring
 * Searches BOTH verse text AND enriched descriptions (Pastor Kenny's commentary)
 * Returns weighted seeds prioritizing:
 *   1. Verses matching words in enriched description (theological concepts)
 *   2. Verses matching words in verse text
 *
 * Embeddings handle semantic similarity naturally - no hardcoded expansions needed.
 */
async function findSeedVerses(originalWords: string[]): Promise<{
  seeds: { verse: VerseEmbedding; weight: number }[];
  searchWords: string[];
  fuzzyPenalty: number;
}> {
  // Use original words directly - embeddings handle semantic similarity
  const words = originalWords;
  console.log(`[VectorSearch] Search words: [${words.join(', ')}]`);

  const weightedSeeds: { verse: VerseEmbedding; weight: number; matchCount: number; matchedIn: 'text' | 'enriched' | 'both' }[] = [];

  // Yield to UI every N verses to prevent blocking the JS thread
  const YIELD_INTERVAL = 5000;
  let processedCount = 0;

  for (const [, verse] of verseEmbeddings) {
    const textLower = verse.verseText.toLowerCase();
    const enrichedLower = verse.enrichedDescription?.toLowerCase() || '';

    let textMatchCount = 0;
    let enrichedMatchCount = 0;

    for (const word of words) {
      if (wordMatchesInText(word, textLower)) {
        textMatchCount++;
      }
      if (wordMatchesInText(word, enrichedLower)) {
        enrichedMatchCount++;
      }
    }

    // Skip if no matches at all
    if (textMatchCount === 0 && enrichedMatchCount === 0) continue;

    // Weight calculation - enrichment-first approach
    const textRatio = textMatchCount / words.length;
    const enrichedRatio = enrichedMatchCount / words.length;

    let weight;

    if (enrichedMatchCount > 0) {
      // Enriched match: base weight = enriched ratio * 2 (theological relevance)
      weight = enrichedRatio * 2;

      // Bonus if text ALSO matches (verse explicitly about the topic)
      if (textMatchCount > 0) {
        weight += textRatio * 0.5;
      }
    } else {
      // Text-only match: lower weight
      weight = textRatio * 0.5;
    }

    // Bonus for matching many words
    if (enrichedMatchCount >= 3 || textMatchCount >= 3) {
      weight *= 1.5;
    }

    const matchCount = Math.max(textMatchCount, enrichedMatchCount);
    const matchedIn = enrichedMatchCount >= textMatchCount ? 'enriched' :
                      textMatchCount > enrichedMatchCount ? 'text' : 'both';

    weightedSeeds.push({ verse, weight, matchCount, matchedIn });

    // Yield to UI periodically to prevent blocking
    processedCount++;
    if (processedCount % YIELD_INTERVAL === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Sort by weight descending
  weightedSeeds.sort((a, b) => b.weight - a.weight);

  // Log statistics
  const exactMatches = weightedSeeds.filter(s => s.matchCount >= originalWords.length).length;
  const enrichedMatches = weightedSeeds.filter(s => s.matchedIn === 'enriched').length;
  console.log(`[VectorSearch] Found ${exactMatches} good seeds, ${weightedSeeds.length} total (${enrichedMatches} from enriched)`);

  // Take fewer seeds for precision
  const maxSeeds = Math.min(10, 3 + originalWords.length * 2);
  const seeds = weightedSeeds.slice(0, maxSeeds).map(s => ({ verse: s.verse, weight: s.weight }));

  // Calculate fuzzy penalty
  const bestMatchRatio = weightedSeeds.length > 0 ? weightedSeeds[0].matchCount / words.length : 0;
  const fuzzyPenalty = weightedSeeds.length > 0 ? 0.7 + (bestMatchRatio * 0.3) : 0.5;

  if (seeds.length > 0) {
    console.log(`[VectorSearch] Using ${seeds.length} seeds (top weight: ${seeds[0].weight.toFixed(2)})`);
  }

  return { seeds, searchWords: words, fuzzyPenalty };
}

// =============================================================================
// PASSAGE GROUPING
// =============================================================================

/**
 * Group consecutive verses into passages
 *
 * Takes individual verse results and merges consecutive verses from the same
 * chapter into passage references (e.g., Genesis 1:3, 1:4, 1:5 → Genesis 1:3-5)
 *
 * @param results - Individual verse search results
 * @param maxGap - Maximum gap between verses to still consider consecutive (default: 1 = truly consecutive)
 * @returns Grouped passage results sorted by average score
 */
export function groupIntoPassages(
  results: SemanticSearchResult[],
  maxGap: number = 1,
): PassageSearchResult[] {
  if (results.length === 0) return [];

  // Sort results by book, chapter, verse for grouping
  const sortedResults = [...results].sort((a, b) => {
    if (a.bookId !== b.bookId) return a.bookId - b.bookId;
    if (a.chapter !== b.chapter) return a.chapter - b.chapter;
    return a.verse - b.verse;
  });

  const passages: PassageSearchResult[] = [];
  let currentPassage: SemanticSearchResult[] = [sortedResults[0]];

  for (let i = 1; i < sortedResults.length; i++) {
    const prev = sortedResults[i - 1];
    const curr = sortedResults[i];

    // Check if current verse is consecutive with previous
    const isConsecutive =
      curr.bookId === prev.bookId &&
      curr.chapter === prev.chapter &&
      curr.verse - prev.verse <= maxGap &&
      curr.verse > prev.verse;

    if (isConsecutive) {
      // Add to current passage
      currentPassage.push(curr);
    } else {
      // Finalize current passage and start new one
      passages.push(createPassageResult(currentPassage));
      currentPassage = [curr];
    }
  }

  // Don't forget the last passage
  passages.push(createPassageResult(currentPassage));

  // Sort passages by average score (highest first)
  passages.sort((a, b) => b.averageScore - a.averageScore);

  return passages;
}

/**
 * Create a PassageSearchResult from a group of consecutive verses
 */
function createPassageResult(verses: SemanticSearchResult[]): PassageSearchResult {
  const first = verses[0];
  const last = verses[verses.length - 1];

  // Calculate average score
  const averageScore = verses.reduce((sum, v) => sum + v.score, 0) / verses.length;

  // Build bibleRef (e.g., "Genesis 1:3-5" or "Genesis 1:3")
  const bookName = getBookName(first.bookId);
  const bibleRef =
    verses.length === 1
      ? `${bookName} ${first.chapter}:${first.verse}`
      : `${bookName} ${first.chapter}:${first.verse}-${last.verse}`;

  return {
    bibleRef,
    verses,
    averageScore,
    startVerse: first.verse,
    endVerse: last.verse,
    bookId: first.bookId,
    chapter: first.chapter,
    verseCount: verses.length,
  };
}

/**
 * Semantic search with automatic passage grouping
 *
 * @param query - Search query
 * @param options - Search options
 * @returns Grouped passage results
 */
export async function semanticSearchGrouped(
  query: string,
  options: {
    limit?: number;
    maxGap?: number;
    minPassageScore?: number;
    onProgress?: (progress: SearchProgress) => void;
  } = {},
): Promise<PassageSearchResult[]> {
  console.log('[VectorSearch] semanticSearchGrouped called with query:', query);
  const { limit = 30, maxGap = 1, minPassageScore = 0.3, onProgress } = options;

  // Get more individual results to allow for good grouping
  console.log('[VectorSearch] Calling semanticSearch...');
  const individualResults = await semanticSearch(query, limit * 2, onProgress);
  console.log('[VectorSearch] semanticSearch returned', individualResults.length, 'results');

  // Filter by minimum score
  const filteredResults = individualResults.filter((r) => r.score >= minPassageScore);

  // Group into passages
  const passages = groupIntoPassages(filteredResults, maxGap);

  // Return top passages
  return passages.slice(0, limit);
}

// =============================================================================
// STATUS & CLEANUP
// =============================================================================

/**
 * Check if semantic search is available
 */
export function isSemanticSearchAvailable(): boolean {
  return isInitialized && verseEmbeddings.size > 0;
}

/**
 * Get memory usage stats
 */
export function getMemoryStats(): {
  verseCount: number;
  queryBankCount: number;
  estimatedMemoryMB: number;
} {
  const verseCount = verseEmbeddings.size;
  const queryBankCount = queryBank.size;

  // Each embedding: 384 floats × 4 bytes = 1536 bytes
  // Plus overhead for verse text (~200 bytes avg), metadata (~100 bytes)
  const bytesPerVerse = EMBEDDING_DIM * 4 + 300;
  const estimatedMemoryMB = (verseCount * bytesPerVerse + queryBankCount * bytesPerVerse) / 1024 / 1024;

  return { verseCount, queryBankCount, estimatedMemoryMB };
}

/**
 * Clear memory cache (for low memory situations)
 */
export function clearEmbeddingsCache(): void {
  verseEmbeddings.clear();
  queryBank.clear();
  console.log('[VectorSearch] Cache cleared');
}

/**
 * Close the database connection
 */
export async function closeEmbeddingsDb(): Promise<void> {
  if (embeddingsDb) {
    await embeddingsDb.closeAsync();
    embeddingsDb = null;
    isInitialized = false;
  }
}
