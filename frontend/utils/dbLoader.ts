/**
 * Database Loader Utility
 *
 * Handles loading of bible.db on first app launch.
 * Uses compressed database (bible.db.gz) for all environments.
 */

import { Paths, File } from 'expo-file-system';
import { Asset } from 'expo-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DATABASE_VERSION, DB_VERSION_KEY, EMBEDDINGS_VERSION, EMBEDDINGS_VERSION_KEY } from '../config/databaseVersion';
import pako from 'pako';

const DB_READY_KEY = 'bible_db_ready';
const DB_FILE_NAME = 'bible.db';
const CURRENT_DB_VERSION = DATABASE_VERSION.current.toString();

const EMBEDDINGS_READY_KEY = 'embeddings_db_ready';
const EMBEDDINGS_FILE_NAME = 'embeddings.db';
const CURRENT_EMBEDDINGS_VERSION = EMBEDDINGS_VERSION.current.toString();

/**
 * Checks if the database is ready
 */
export async function isDatabaseReady(): Promise<boolean> {
  const ready = await AsyncStorage.getItem(DB_READY_KEY);
  const version = await AsyncStorage.getItem(DB_VERSION_KEY);

  // Check if ready and version matches
  if (ready === 'true' && version === CURRENT_DB_VERSION) {
    // Verify the file actually exists
    const dbFile = new File(Paths.document, DB_FILE_NAME);
    return dbFile.exists;
  }

  return false;
}

/**
 * Load compressed database from .gz asset and decompress
 * Returns decompressed data and the cache file path for cleanup
 */
async function loadCompressedDatabase(onProgress?: (progress: number) => void): Promise<{ data: Uint8Array; cacheFile: File | null }> {
  console.log('[dbLoader] Loading compressed database...');
  onProgress?.(20);

  const asset = Asset.fromModule(require('../assets/bible.db.gz'));
  await asset.downloadAsync();

  if (!asset.localUri) {
    throw new Error('Compressed database has no localUri');
  }

  onProgress?.(40);

  const gzFile = new File(asset.localUri);
  const compressedBuffer = await gzFile.arrayBuffer();
  const compressedData = new Uint8Array(compressedBuffer);

  console.log(`[dbLoader] Compressed data loaded: ${(compressedData.length / 1024 / 1024).toFixed(2)} MB`);
  onProgress?.(60);

  // Decompress using pako
  console.log('[dbLoader] Decompressing database...');
  const database = pako.inflate(compressedData);

  console.log(`[dbLoader] Database decompressed: ${(database.length / 1024 / 1024).toFixed(2)} MB`);
  onProgress?.(80);

  return { data: database, cacheFile: gzFile };
}

/**
 * Loads the bundled bible.db to the document directory
 * This only needs to happen once on first launch
 */
export async function loadBibleDatabase(
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    const dbFile = new File(Paths.document, DB_FILE_NAME);

    // Check if already loaded with correct version
    if (await isDatabaseReady()) {
      console.log(`[dbLoader] Database already loaded (version ${CURRENT_DB_VERSION})`);
      return dbFile.uri;
    }

    console.log(`[dbLoader] Loading bible database (version ${CURRENT_DB_VERSION})...`);

    // Clean up old version files
    console.log('[dbLoader] Cleaning up old database files...');
    try {
      if (dbFile.exists) {
        await dbFile.delete();
      }
    } catch (cleanupError) {
      console.warn('[dbLoader] Failed to clean up old database:', cleanupError);
    }

    onProgress?.(0);

    // Load and decompress database
    const { data: database, cacheFile } = await loadCompressedDatabase(onProgress);
    onProgress?.(80);

    // Write the database
    console.log('[dbLoader] Writing database...');
    await dbFile.write(database, {});
    console.log(`[dbLoader] Database written to: ${dbFile.uri}`);
    onProgress?.(90);

    // Verify the written file
    console.log('[dbLoader] Verifying written database...');
    const writtenSize = await dbFile.size;
    console.log(`[dbLoader] Written file size: ${writtenSize} bytes (${(writtenSize / 1024 / 1024).toFixed(2)} MB)`);

    if (writtenSize !== database.length) {
      throw new Error(`File size mismatch! Expected ${database.length}, got ${writtenSize}`);
    }

    // Cleanup cached .gz file to save storage space
    if (cacheFile && cacheFile.exists) {
      try {
        await cacheFile.delete();
        console.log('[dbLoader] Cleaned up cached compressed file');
      } catch (cleanupErr) {
        // Non-critical, just log
        console.warn('[dbLoader] Failed to cleanup cached .gz file:', cleanupErr);
      }
    }

    // Mark as ready
    await AsyncStorage.setItem(DB_READY_KEY, 'true');
    await AsyncStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
    onProgress?.(100);

    console.log('[dbLoader] Database load complete!');
    return dbFile.uri;
  } catch (error) {
    console.error('[dbLoader] Failed to load database:', error);
    // Clean up on failure
    await AsyncStorage.removeItem(DB_READY_KEY);
    await AsyncStorage.removeItem(DB_VERSION_KEY);
    throw error;
  }
}

/**
 * Gets the path to the bible database
 * Loads if needed on first access
 */
export async function getBibleDatabasePath(
  onProgress?: (progress: number) => void
): Promise<string> {
  if (await isDatabaseReady()) {
    const dbFile = new File(Paths.document, DB_FILE_NAME);
    return dbFile.uri;
  }

  return await loadBibleDatabase(onProgress);
}

/**
 * Resets the database state (for testing or re-loading)
 */
export async function resetDatabase(): Promise<void> {
  const dbFile = new File(Paths.document, DB_FILE_NAME);

  try {
    await dbFile.delete();
    await AsyncStorage.removeItem(DB_READY_KEY);
    await AsyncStorage.removeItem(DB_VERSION_KEY);
  } catch (error) {
    console.error('[dbLoader] Failed to reset database:', error);
    throw error;
  }
}

// =============================================================================
// EMBEDDINGS DATABASE
// =============================================================================

/**
 * Checks if the embeddings database is ready
 */
export async function isEmbeddingsDatabaseReady(): Promise<boolean> {
  const ready = await AsyncStorage.getItem(EMBEDDINGS_READY_KEY);
  const version = await AsyncStorage.getItem(EMBEDDINGS_VERSION_KEY);

  if (ready === 'true' && version === CURRENT_EMBEDDINGS_VERSION) {
    const dbFile = new File(Paths.document, EMBEDDINGS_FILE_NAME);
    return dbFile.exists;
  }

  return false;
}

/**
 * Load compressed embeddings database from .gz asset and decompress
 * Returns decompressed data and the cache file path for cleanup
 */
async function loadCompressedEmbeddingsDatabase(onProgress?: (progress: number) => void): Promise<{ data: Uint8Array; cacheFile: File | null }> {
  console.log('[dbLoader] Loading compressed embeddings database...');
  onProgress?.(20);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const asset = Asset.fromModule(require('../assets/embeddings.db.gz'));
  await asset.downloadAsync();

  if (!asset.localUri) {
    throw new Error('Compressed embeddings database has no localUri');
  }

  onProgress?.(40);

  const gzFile = new File(asset.localUri);
  const compressedBuffer = await gzFile.arrayBuffer();
  const compressedData = new Uint8Array(compressedBuffer);

  console.log(`[dbLoader] Compressed embeddings data loaded: ${(compressedData.length / 1024 / 1024).toFixed(2)} MB`);
  onProgress?.(60);

  // Decompress using pako
  console.log('[dbLoader] Decompressing embeddings database...');
  const database = pako.inflate(compressedData);

  console.log(`[dbLoader] Embeddings database decompressed: ${(database.length / 1024 / 1024).toFixed(2)} MB`);
  onProgress?.(80);

  return { data: database, cacheFile: gzFile };
}

/**
 * Loads the bundled embeddings.db to the document directory
 */
export async function loadEmbeddingsDatabase(
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    const dbFile = new File(Paths.document, EMBEDDINGS_FILE_NAME);

    // Check if already loaded with correct version
    if (await isEmbeddingsDatabaseReady()) {
      console.log(`[dbLoader] Embeddings database already loaded (version ${CURRENT_EMBEDDINGS_VERSION})`);
      return dbFile.uri;
    }

    console.log(`[dbLoader] Loading embeddings database (version ${CURRENT_EMBEDDINGS_VERSION})...`);

    // Clean up old version files
    console.log('[dbLoader] Cleaning up old embeddings database files...');
    try {
      if (dbFile.exists) {
        await dbFile.delete();
      }
    } catch (cleanupError) {
      console.warn('[dbLoader] Failed to clean up old embeddings database:', cleanupError);
    }

    onProgress?.(0);

    // Load and decompress database
    const { data: database, cacheFile } = await loadCompressedEmbeddingsDatabase(onProgress);
    onProgress?.(80);

    // Write the database
    console.log('[dbLoader] Writing embeddings database...');
    await dbFile.write(database, {});
    console.log(`[dbLoader] Embeddings database written to: ${dbFile.uri}`);
    onProgress?.(90);

    // Verify the written file
    console.log('[dbLoader] Verifying written embeddings database...');
    const writtenSize = await dbFile.size;
    console.log(`[dbLoader] Written embeddings file size: ${writtenSize} bytes (${(writtenSize / 1024 / 1024).toFixed(2)} MB)`);

    if (writtenSize !== database.length) {
      throw new Error(`Embeddings file size mismatch! Expected ${database.length}, got ${writtenSize}`);
    }

    // Cleanup cached .gz file to save storage space
    if (cacheFile && cacheFile.exists) {
      try {
        await cacheFile.delete();
        console.log('[dbLoader] Cleaned up cached compressed embeddings file');
      } catch (cleanupErr) {
        // Non-critical, just log
        console.warn('[dbLoader] Failed to cleanup cached embeddings .gz file:', cleanupErr);
      }
    }

    // Mark as ready
    await AsyncStorage.setItem(EMBEDDINGS_READY_KEY, 'true');
    await AsyncStorage.setItem(EMBEDDINGS_VERSION_KEY, CURRENT_EMBEDDINGS_VERSION);
    onProgress?.(100);

    console.log('[dbLoader] Embeddings database load complete!');
    return dbFile.uri;
  } catch (error) {
    console.error('[dbLoader] Failed to load embeddings database:', error);
    // Clean up on failure
    await AsyncStorage.removeItem(EMBEDDINGS_READY_KEY);
    await AsyncStorage.removeItem(EMBEDDINGS_VERSION_KEY);
    throw error;
  }
}

/**
 * Gets the path to the embeddings database
 * Loads if needed on first access
 */
export async function getEmbeddingsDatabasePath(
  onProgress?: (progress: number) => void
): Promise<string> {
  if (await isEmbeddingsDatabaseReady()) {
    const dbFile = new File(Paths.document, EMBEDDINGS_FILE_NAME);
    return dbFile.uri;
  }

  return await loadEmbeddingsDatabase(onProgress);
}

/**
 * Resets the embeddings database state
 */
export async function resetEmbeddingsDatabase(): Promise<void> {
  const dbFile = new File(Paths.document, EMBEDDINGS_FILE_NAME);

  try {
    if (dbFile.exists) {
      await dbFile.delete();
    }
    await AsyncStorage.removeItem(EMBEDDINGS_READY_KEY);
    await AsyncStorage.removeItem(EMBEDDINGS_VERSION_KEY);
  } catch (error) {
    console.error('[dbLoader] Failed to reset embeddings database:', error);
    throw error;
  }
}
