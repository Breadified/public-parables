/**
 * SQLite Service Layer
 * High-performance Bible data access with sub-50ms queries
 */

import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidChapterId } from '../modules/bible/bibleBookMappings';
import { DATABASE_VERSION, DB_VERSION_KEY } from '../config/databaseVersion';
import { getBibleDatabasePath, isDatabaseReady } from '../utils/dbLoader';
import { bibleStore$ } from '../state/bibleStore';

// Database configuration
const DB_NAME = 'bible.db';

// Types matching our database schema
export interface BibleVersion {
  id: string;
  name: string;
  abbreviation: string;
  language: string;
  is_default: boolean;
}

export interface Book {
  id: number;
  name: string;
  testament: string;
  book_order: number;
  abbreviation?: string;
}

export interface Chapter {
  id: number;
  book_id: number;
  chapter_number: number;
  book_name?: string;
}

export interface Section {
  id: string;  // Changed from number to string (format: "ESV_19077001")
  version_id: string;
  chapter_id: number;
  title?: string;
  subtitle?: string;
  section_order: number;
}

export interface Paragraph {
  id: string;  // Changed from number to string (format: "ESV_19077001001")
  version_id: string;
  section_id: string;  // Changed from number to string
  paragraph_order: number;
  is_poetry: boolean;
}

// Verse entity (independent of paragraphs)
export interface Verse {
  id: number;  // Verse ID like 40013014 for Matthew 13:14
  chapter_id: number;
  verse_number: number;
}

// Verse line (actual text lines within paragraphs)
export interface VerseLine {
  id: string;  // Line ID like "40013014_0", can be duplicated across paragraphs
  version_id: string;
  verse_id: number;  // References the verse entity
  paragraph_id: string;  // Changed from number to string - Combined with id forms the unique composite key
  text: string;
  indent_level: number;
  is_isolated: boolean;
  line_order: number;  // Order within the verse
  verse_number?: number | null;  // Verse number from joined verse table
  show_verse_number?: boolean;  // Flag to indicate if verse number should be displayed
  sequence_order?: number;  // Added from database schema
}

// Aggregate types for efficient loading
export interface ChapterContent {
  chapter: Chapter;
  sections: Array<{
    section: Section;
    paragraphs: Array<{
      paragraph: Paragraph;
      verseLines: VerseLine[];
    }>;
  }>;
}

export interface VerseRange {
  startChapter: number;
  endChapter: number;
  startVerse?: number;
  endVerse?: number;
}

class BibleSQLiteService {
  private db: SQLiteDatabase | null = null;
  private isInitialized = false;
  private queryQueue: Promise<any> = Promise.resolve();
  private activeQueries = 0;
  private maxConcurrentQueries = 3;
  private cachedChapterList: { id: number }[] | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private lastQueryTime = 0;
  private queryDebounceDelay = 50; // Minimum delay between queries
  private initializationPromise: Promise<void> | null = null; // Prevent concurrent initialization
  private currentVersion: string = 'ESV'; // Default to ESV
  private availableVersions: BibleVersion[] = [];

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check database version
      const storedVersion = await AsyncStorage.getItem(DB_VERSION_KEY);
      const currentStoredVersion = storedVersion ? parseInt(storedVersion, 10) : 0;

      // Check if database exists in document directory
      const dbPath = `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;
      const dbInfo = await FileSystem.getInfoAsync(dbPath);

      // Force refresh if version changed or database doesn't exist
      const needsRefresh = !dbInfo.exists || currentStoredVersion < DATABASE_VERSION.current;

      if (needsRefresh) {
        console.log(`[SQLite] Database refresh needed. Current version: ${currentStoredVersion}, Required: ${DATABASE_VERSION.current}`);

        // Delete old database if it exists
        if (dbInfo.exists) {
          console.log('[SQLite] Removing old database...');
          await FileSystem.deleteAsync(dbPath, { idempotent: true });
        }

        // Ensure SQLite directory exists
        const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
        const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
        }

        // Use unified database loader for both Metro dev and EAS builds
        // - Metro dev: loads chunked files (bible.db.1, .2, etc.)
        // - EAS builds: loads compressed file (bible.db.gz) and decompresses
        console.log('[SQLite] Loading database via unified loader...');
        const loadedDbPath = await getBibleDatabasePath((progress) => {
          console.log(`[SQLite] Loading progress: ${progress}%`);
        });

        console.log(`[SQLite] Database loaded to: ${loadedDbPath}`);

        // Copy to SQLite directory
        await FileSystem.copyAsync({
          from: loadedDbPath,
          to: dbPath,
        });
        console.log('[SQLite] Database copied to SQLite directory');

        // Update stored version
        await AsyncStorage.setItem(DB_VERSION_KEY, DATABASE_VERSION.current.toString());
        console.log(`[SQLite] Database version updated to ${DATABASE_VERSION.current}`);

        // Clear all tabs to avoid invalid chapter references from old database
        console.log('[SQLite] Clearing all tabs due to database version change');
        bibleStore$.clearAllTabs();
      } else {
        console.log(`[SQLite] Using existing database (version ${currentStoredVersion})`);
      }

      // Open database asynchronously
      this.db = await openDatabaseAsync(DB_NAME);

      // Enable WAL mode for better concurrency
      await this.db.execAsync('PRAGMA journal_mode = WAL');

      // Load available Bible versions
      await this.loadAvailableVersions();

      // Enable query optimization
      await this.db.execAsync('PRAGMA optimize');
      
      this.isInitialized = true;
      console.log('[SQLite] Database initialized successfully');
    } catch (error) {
      console.error('[SQLite] Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Ensure database is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    // Check both initialization flag AND database connection
    if (!this.isInitialized || !this.db) {
      // If already initializing, wait for it to complete
      if (this.initializationPromise) {
        console.log('[SQLite] Waiting for ongoing initialization...');
        await this.initializationPromise;
        return;
      }
      
      console.log('[SQLite] Re-initializing database connection...');
      this.isInitialized = false; // Reset flag
      
      // Create initialization promise to prevent concurrent attempts
      this.initializationPromise = this.initialize();
      
      try {
        await this.initializationPromise;
      } finally {
        this.initializationPromise = null;
      }
    }
  }

  /**
   * Load available Bible versions from database
   */
  private async loadAvailableVersions(): Promise<void> {
    try {
      const versions = await this.db!.getAllAsync<BibleVersion>(
        'SELECT * FROM bible_versions ORDER BY is_default DESC, abbreviation'
      );

      this.availableVersions = versions;

      // Set current version to default or first available
      const defaultVersion = versions.find(v => v.is_default) || versions[0];
      if (defaultVersion) {
        this.currentVersion = defaultVersion.id;
        console.log(`[SQLite] Available Bible versions: ${versions.map(v => v.abbreviation).join(', ')}`);
        console.log(`[SQLite] Default version set to: ${this.currentVersion}`);
      }

      // In dev mode, check if LIV is available
      if (__DEV__ && versions.some(v => v.id === 'LIV')) {
        console.log('[SQLite] Lorem Ipsum Version (LIV) available for testing');
      }
    } catch (error) {
      console.error('[SQLite] Failed to load Bible versions:', error);
      // Fall back to ESV if loading fails
      this.availableVersions = [{
        id: 'ESV',
        name: 'English Standard Version',
        abbreviation: 'ESV',
        language: 'en',
        is_default: true
      }];
      this.currentVersion = 'ESV';
    }
  }

  /**
   * Get available Bible versions
   */
  async getAvailableVersions(): Promise<BibleVersion[]> {
    await this.ensureInitialized();
    return this.availableVersions;
  }

  /**
   * Get current Bible version
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Set current Bible version
   */
  async setCurrentVersion(versionId: string): Promise<boolean> {
    await this.ensureInitialized();

    const version = this.availableVersions.find(v => v.id === versionId);
    if (!version) {
      console.error(`[SQLite] Version ${versionId} not available`);
      return false;
    }

    this.currentVersion = versionId;
    console.log(`[SQLite] Bible version changed to: ${versionId}`);

    // Clear cache to force reload with new version
    this.cachedChapterList = null;

    return true;
  }

  /**
   * Get all books
   */
  async getBooks(): Promise<Book[]> {
    await this.ensureInitialized();

    const result = await this.db!.getAllAsync<Book>(
      'SELECT * FROM books ORDER BY book_order'
    );

    return result;
  }

  /**
   * Get chapters for a book
   */
  async getChaptersForBook(bookId: number): Promise<Chapter[]> {
    await this.ensureInitialized();
    
    const result = await this.db!.getAllAsync<Chapter>(
      'SELECT * FROM chapters WHERE book_id = ? ORDER BY chapter_number',
      [bookId]
    );
    
    return result;
  }

  /**
   * Get all chapters with book names (for navigation)
   */
  async getAllChaptersWithBooks(): Promise<Chapter[]> {
    await this.ensureInitialized();
    
    // Import validation function
    const { isValidChapterId } = await import('../modules/bible/bibleBookMappings');
    
    const result = await this.db!.getAllAsync<Chapter>(
      `SELECT c.*, b.name as book_name 
       FROM chapters c 
       JOIN books b ON c.book_id = b.id 
       ORDER BY b.book_order, c.chapter_number`
    );
    
    // Filter out invalid chapters using proper validation
    const validChapters = result.filter(c => {
      const isValid = isValidChapterId(c.id);
      if (!isValid) {
        const bookId = Math.floor(c.id / 1000000);
        const chapterNum = Math.floor((c.id % 1000000) / 1000);
        console.warn(`[SQLite] Filtering out invalid chapter from DB: ${c.id} (Book ${bookId}, Chapter ${chapterNum})`);
      }
      return isValid;
    });
    
    if (validChapters.length !== result.length) {
      console.log(`[SQLite] Filtered ${result.length - validChapters.length} invalid chapters from database`);
      console.log(`[SQLite] Returning ${validChapters.length} valid chapters`);
    }
    
    // Log sample of valid results
    if (validChapters.length > 0) {
      console.log(`[SQLite] Sample valid chapter IDs:`, validChapters.slice(0, 5).map(c => c.id));
    }
    
    return validChapters;
  }

  /**
   * NEW: Get verses for multiple specific chapter IDs
   */
  async getBulkVersesForChapterIds(chapterIds: number[], versionId?: string): Promise<any[]> {
    // Queue this query to prevent overwhelming the database
    return this.queryQueue = this.queryQueue.then(async () => {
      // Debounce rapid queries
      const now = Date.now();
      if (now - this.lastQueryTime < this.queryDebounceDelay) {
        await new Promise(resolve => setTimeout(resolve, this.queryDebounceDelay));
      }
      this.lastQueryTime = Date.now();
      
      await this.ensureInitialized();
    
    // Check if database is still connected and attempt reconnection if needed
    if (!this.db) {
      console.error('[SQLite] Database connection lost! Attempting to reconnect...');
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[SQLite] Max reconnection attempts reached. Giving up.');
        return [];
      }
      
      this.reconnectAttempts++;
      this.isInitialized = false;  // Reset flag to allow re-initialization
      
      try {
        await this.ensureInitialized();
        if (!this.db) {
          console.error('[SQLite] Failed to reconnect to database');
          return [];
        }
        this.reconnectAttempts = 0; // Reset on successful reconnection
      } catch (error) {
        console.error('[SQLite] Reconnection failed:', error);
        return [];
      }
    }
    
    if (chapterIds.length === 0) return [];
    
    // Validate chapter IDs using the proper validation function
    const validChapterIds = chapterIds.filter(id => {
      const isValid = isValidChapterId(id);
      
      if (!isValid) {
        const bookId = Math.floor(id / 1000000);
        const chapterNum = Math.floor((id % 1000000) / 1000);
        const verseNum = id % 1000;
        console.warn(`[SQLite] Invalid chapter ID: ${id} (book: ${bookId}, chapter: ${chapterNum}, verse: ${verseNum})`);
      }
      
      return isValid;
    });
    
    if (validChapterIds.length === 0) {
      console.error('[SQLite] No valid chapter IDs after filtering');
      return [];
    }
    
    if (validChapterIds.length !== chapterIds.length) {
      console.warn(`[SQLite] Filtered out ${chapterIds.length - validChapterIds.length} invalid chapter IDs`);
    }
    
    try {
      const startTime = performance.now();
      
      // CRITICAL: Batch queries to avoid SQLite limits on mobile
      // Mobile SQLite can fail with too many parameters in IN clause
      const BATCH_SIZE = 15; // Further reduced for stability
      const allVerses: any[] = [];
      const failedChapterIds: number[] = [];
      
      console.log(`[SQLite] Processing ${validChapterIds.length} chapters in batches of ${BATCH_SIZE}`);
      
      for (let i = 0; i < validChapterIds.length; i += BATCH_SIZE) {
        const batch = validChapterIds.slice(i, i + BATCH_SIZE);
        const batchStartTime = performance.now();
        
        // Create placeholders for this batch
        const placeholders = batch.map(() => '?').join(',');
        
        try {
          // Add a small delay between batches to prevent overwhelming the database
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          
          // Double-check database connection before query
          if (!this.db) {
            console.error('[SQLite] Database connection lost during batch processing');
            await this.ensureInitialized();
            if (!this.db) {
              throw new Error('Database connection could not be restored');
            }
          }
          
          const verses = await this.db.getAllAsync(
            `SELECT
              vl.id as verse_id,
              vl.line_order,
              CASE WHEN vl.show_verse_number = 1 THEN v.verse_number ELSE NULL END as verse_number,
              vl.show_verse_number,
              vl.text,
              vl.indent_level,
              vl.is_isolated,
              p.id as paragraph_id,
              p.paragraph_order,
              p.is_poetry,
              s.id as section_id,
              s.title as section_title,
              s.subtitle as section_subtitle,
              s.section_order,
              c.id as chapter_id,
              c.chapter_number,
              b.id as book_id,
              b.name as book_name
            FROM chapters c
            JOIN books b ON c.book_id = b.id
            JOIN sections s ON s.chapter_id = c.id AND s.version_id = ?
            JOIN paragraphs p ON p.section_id = s.id AND p.version_id = ?
            JOIN verse_lines vl ON vl.paragraph_id = p.id AND vl.version_id = ?
            JOIN verses v ON v.id = vl.verse_id
            WHERE c.id IN (${placeholders})
            ORDER BY b.book_order, c.chapter_number, s.section_order, p.paragraph_order,
              vl.sequence_order`,
            [versionId || this.currentVersion, versionId || this.currentVersion, versionId || this.currentVersion, ...batch]
          );

          // Debug: Log the first verse text to verify version
          if (verses.length > 0 && i === 0) {
            const firstVerse = verses[0] as any;
            const actualVersion = versionId || this.currentVersion;
            console.log(`[SQLite] Sample verse from ${actualVersion}: "${firstVerse.text?.substring(0, 50)}..."`);
          }
          
          const batchTime = performance.now() - batchStartTime;
          console.log(`[SQLite] Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(validChapterIds.length/BATCH_SIZE)}: ${verses.length} verses in ${batchTime.toFixed(0)}ms`);
          
          allVerses.push(...verses);
        } catch (batchError: any) {
          console.error(`[SQLite] Error in batch ${Math.floor(i/BATCH_SIZE) + 1}:`, batchError?.message || batchError);
          
          // Check if it's a connection error
          if (batchError?.message?.includes('NullPointerException') || 
              batchError?.message?.includes('prepareAsync')) {
            console.warn('[SQLite] Database error - these chapters may not exist in the database');
            
            // Track failed chapters
            failedChapterIds.push(...batch);
            
            // Try individual queries for each chapter as fallback
            for (const chapterId of batch) {
              try {
                // Check if chapter exists first
                const chapterExists = await this.db?.getFirstAsync(
                  'SELECT id FROM chapters WHERE id = ?',
                  [chapterId]
                );
                
                if (!chapterExists) {
                  const bookId = Math.floor(chapterId / 1000000);
                  const chapterNum = Math.floor((chapterId % 1000000) / 1000);
                  console.warn(`[SQLite] Chapter ${chapterId} (Book ${bookId}, Chapter ${chapterNum}) does not exist in database`);
                  continue;
                }
                
                // If chapter exists, try to get its verse lines
                const singleChapterVerses = await this.db?.getAllAsync(
                  `SELECT 
                    vl.id as verse_id,
                    vl.line_order,
                    CASE WHEN vl.show_verse_number = 1 THEN v.verse_number ELSE NULL END as verse_number,
                    vl.show_verse_number,
                    vl.text,
                    vl.indent_level,
                    vl.is_isolated,
                    p.id as paragraph_id,
                    p.paragraph_order,
                    p.is_poetry,
                    s.id as section_id,
                    s.title as section_title,
                    s.section_order,
                    c.id as chapter_id,
                    c.chapter_number,
                    b.id as book_id,
                    b.name as book_name
                  FROM chapters c
                  JOIN books b ON c.book_id = b.id
                  JOIN sections s ON s.chapter_id = c.id AND s.version_id = ?
                  JOIN paragraphs p ON p.section_id = s.id AND p.version_id = ?
                  JOIN verse_lines vl ON vl.paragraph_id = p.id AND vl.version_id = ?
                  JOIN verses v ON v.id = vl.verse_id
                  WHERE c.id = ?
                  ORDER BY s.section_order, p.paragraph_order, vl.sequence_order`,
                  [this.currentVersion, this.currentVersion, this.currentVersion, chapterId]
                );
                
                if (singleChapterVerses && singleChapterVerses.length > 0) {
                  allVerses.push(...singleChapterVerses);
                  console.log(`[SQLite] Recovered ${singleChapterVerses.length} verses for chapter ${chapterId}`);
                }
              } catch (singleError) {
                // Skip this chapter silently
              }
            }
          } else {
            // Other errors - log details
            failedChapterIds.push(...batch);
            if (batchError.code) {
              console.error(`[SQLite] Error code:`, batchError.code);
            }
          }
          
          // Continue with other batches even if one fails
          // Add a longer recovery delay after error
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      const queryTime = performance.now() - startTime;
      console.log(`[SQLite] Total: Loaded ${allVerses.length} verses for ${validChapterIds.length} chapters in ${queryTime.toFixed(2)}ms`);
      
      // Report any failed chapters
      if (failedChapterIds.length > 0) {
        console.warn(`[SQLite] Failed to load ${failedChapterIds.length} chapters:`, failedChapterIds);
        console.warn(`[SQLite] These chapters may not exist in the database or have no verses`);
      }
      
      return allVerses;
    } catch (error) {
      console.error('[SQLite] Error in getBulkVersesForChapterIds:', error);
      console.error('[SQLite] Chapter IDs that caused error:', validChapterIds);
      return [];
    }
    }).catch(error => {
      console.error('[SQLite] Queue error:', error);
      return [];
    });
  }

  /**
   * NEW: Get verses for a range of chapters in a single efficient query
   * This replaces the complex nested chapter loading
   */
  async getBulkVersesForChapterRange(startChapterId: number, endChapterId: number): Promise<any[]> {
    await this.ensureInitialized();
    
    try {
      const startTime = performance.now();
      
      // Get all chapter IDs in the range (handles book boundaries)
      const chapterIds = await this.db!.getAllAsync<{ id: number }>(
        `SELECT c.id 
         FROM chapters c
         JOIN books b ON c.book_id = b.id
         WHERE c.id IN (
           SELECT c2.id FROM chapters c2
           JOIN books b2 ON c2.book_id = b2.id
           WHERE (
             -- Get chapters between start and end in sequential order
             SELECT COUNT(*) FROM chapters c3
             JOIN books b3 ON c3.book_id = b3.id
             WHERE (b3.book_order < b2.book_order OR 
                   (b3.book_order = b2.book_order AND c3.chapter_number <= c2.chapter_number))
           ) BETWEEN (
             SELECT COUNT(*) FROM chapters c4
             JOIN books b4 ON c4.book_id = b4.id
             WHERE (b4.book_order < b_start.book_order OR 
                   (b4.book_order = b_start.book_order AND c4.chapter_number <= c_start.chapter_number))
             FROM chapters c_start
             JOIN books b_start ON c_start.book_id = b_start.id
             WHERE c_start.id = ?
           ) AND (
             SELECT COUNT(*) FROM chapters c5
             JOIN books b5 ON c5.book_id = b5.id
             WHERE (b5.book_order < b_end.book_order OR 
                   (b5.book_order = b_end.book_order AND c5.chapter_number <= c_end.chapter_number))
             FROM chapters c_end
             JOIN books b_end ON c_end.book_id = b_end.id
             WHERE c_end.id = ?
           )
         )`,
        [startChapterId, endChapterId]
      );
      
      if (chapterIds.length === 0) {
        // Simpler fallback - just get chapters in ID range
        console.log('[SQLite] Complex query failed, using simple range');
        const verses = await this.db!.getAllAsync(
          `SELECT 
            v.id as verse_id,
            v.verse_number,
            v.text,
            v.indent_level,
            v.is_isolated,
            p.id as paragraph_id,
            p.paragraph_order,
            p.is_poetry,
            s.id as section_id,
            s.title as section_title,
            s.section_order,
            c.id as chapter_id,
            c.chapter_number,
            b.id as book_id,
            b.name as book_name
          FROM chapters c
          JOIN books b ON c.book_id = b.id
          JOIN sections s ON s.chapter_id = c.id
          JOIN paragraphs p ON p.section_id = s.id
          JOIN verses v ON v.paragraph_id = p.id
          WHERE (
            -- Handle book boundaries properly
            (c.id >= ? AND c.id <= ?) OR
            -- Include chapters sequentially between the two
            EXISTS (
              SELECT 1 FROM chapters c_check
              JOIN books b_check ON c_check.book_id = b_check.id
              WHERE c_check.id = c.id
              AND (
                SELECT COUNT(*) FROM chapters c_seq
                JOIN books b_seq ON c_seq.book_id = b_seq.id
                WHERE (b_seq.book_order < b_check.book_order OR 
                      (b_seq.book_order = b_check.book_order AND c_seq.chapter_number < c_check.chapter_number))
              ) BETWEEN (
                SELECT COUNT(*) FROM chapters c_start
                JOIN books b_start ON c_start.book_id = b_start.id
                WHERE c_start.id = ? AND
                      (b_start.book_order < b_check.book_order OR 
                      (b_start.book_order = b_check.book_order AND c_start.chapter_number < c_check.chapter_number))
              ) AND (
                SELECT COUNT(*) FROM chapters c_end
                JOIN books b_end ON c_end.book_id = b_end.id
                WHERE c_end.id = ? AND
                      (b_end.book_order < b_check.book_order OR 
                      (b_end.book_order = b_check.book_order AND c_end.chapter_number < c_check.chapter_number))
              )
            )
          )
          ORDER BY b.book_order, c.chapter_number, s.section_order, p.paragraph_order, 
          CAST(SUBSTR(v.id, 1, INSTR(v.id || '_', '_') - 1) AS INTEGER),
          CAST(SUBSTR(v.id, INSTR(v.id || '_', '_') + 1) AS INTEGER)`,
          [startChapterId, endChapterId, startChapterId, endChapterId]
        );
        
        const queryTime = performance.now() - startTime;
        console.log(`[SQLite] Loaded ${verses.length} verses for sequential range in ${queryTime.toFixed(2)}ms`);
        return verses;
      }
      
      // Use the chapter IDs to get verses
      const chapterIdList = chapterIds.map(c => c.id).join(',');
      const verses = await this.db!.getAllAsync(
        `SELECT 
          v.id as verse_id,
          v.verse_number,
          v.text,
          v.indent_level,
          v.is_isolated,
          p.id as paragraph_id,
          p.paragraph_order,
          p.is_poetry,
          s.id as section_id,
          s.title as section_title,
          s.section_order,
          c.id as chapter_id,
          c.chapter_number,
          b.id as book_id,
          b.name as book_name
        FROM chapters c
        JOIN books b ON c.book_id = b.id
        JOIN sections s ON s.chapter_id = c.id
        JOIN paragraphs p ON p.section_id = s.id
        JOIN verses v ON v.paragraph_id = p.id
        WHERE c.id IN (${chapterIdList})
        ORDER BY b.book_order, c.chapter_number, s.section_order, p.paragraph_order, 
          CAST(SUBSTR(v.id, 1, INSTR(v.id || '_', '_') - 1) AS INTEGER),
          CAST(SUBSTR(v.id, INSTR(v.id || '_', '_') + 1) AS INTEGER)`
      );
      
      const queryTime = performance.now() - startTime;
      console.log(`[SQLite] Loaded ${verses.length} verses for chapters ${startChapterId}-${endChapterId} in ${queryTime.toFixed(2)}ms`);
      
      return verses;
    } catch (error) {
      console.error('[SQLite] Error in getBulkVersesForChapterRange:', error);
      
      // Ultimate fallback - simpler query
      try {
        console.log('[SQLite] Trying simplest query approach');
        
        // Get the book order positions
        const startInfo = await this.db!.getFirstAsync<{book_order: number, chapter_number: number}>(
          `SELECT b.book_order, c.chapter_number 
           FROM chapters c JOIN books b ON c.book_id = b.id 
           WHERE c.id = ?`,
          [startChapterId]
        );
        
        const endInfo = await this.db!.getFirstAsync<{book_order: number, chapter_number: number}>(
          `SELECT b.book_order, c.chapter_number 
           FROM chapters c JOIN books b ON c.book_id = b.id 
           WHERE c.id = ?`,
          [endChapterId]
        );
        
        if (!startInfo || !endInfo) {
          console.error('[SQLite] Could not find chapter info');
          return [];
        }
        
        // Simple query based on book order
        const verses = await this.db!.getAllAsync(
          `SELECT 
            v.id as verse_id,
            v.verse_number,
            v.text,
            v.indent_level,
            v.is_isolated,
            p.id as paragraph_id,
            p.paragraph_order,
            p.is_poetry,
            s.id as section_id,
            s.title as section_title,
            s.section_order,
            c.id as chapter_id,
            c.chapter_number,
            b.id as book_id,
            b.name as book_name
          FROM chapters c
          JOIN books b ON c.book_id = b.id
          JOIN sections s ON s.chapter_id = c.id
          JOIN paragraphs p ON p.section_id = s.id
          JOIN verses v ON v.paragraph_id = p.id
          WHERE (b.book_order > ? OR (b.book_order = ? AND c.chapter_number >= ?)) 
            AND (b.book_order < ? OR (b.book_order = ? AND c.chapter_number <= ?))
          ORDER BY b.book_order, c.chapter_number, s.section_order, p.paragraph_order, 
          CAST(SUBSTR(v.id, 1, INSTR(v.id || '_', '_') - 1) AS INTEGER),
          CAST(SUBSTR(v.id, INSTR(v.id || '_', '_') + 1) AS INTEGER)`,
          [startInfo.book_order, startInfo.book_order, startInfo.chapter_number,
           endInfo.book_order, endInfo.book_order, endInfo.chapter_number]
        );
        
        console.log(`[SQLite] Simple query loaded ${verses.length} verses`);
        return verses;
        
      } catch (fallbackError) {
        console.error('[SQLite] All query approaches failed:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Get complete chapter content with all nested data
   * This is the main query for displaying a chapter
   */
  async getChapterContent(chapterId: number): Promise<ChapterContent | null> {
    await this.ensureInitialized();
    
    // Queue this query to prevent database overload
    return this.queueQuery(async () => {
      const startTime = performance.now();
      
      try {
      // Validate chapter ID - must be a valid format (ends in 000)
      if (!chapterId || chapterId % 1000 !== 0) {
        console.error(`[SQLite] Invalid chapter ID: ${chapterId}. Chapter IDs must end in 000`);
        // Don't even try to query with invalid ID
        return null;
      }
      
      // Additional validation - reasonable range
      const bookId = Math.floor(chapterId / 1000000);
      if (bookId < 1 || bookId > 66) {
        console.error(`[SQLite] Invalid book ID in chapter: ${chapterId}`);
        return null;
      }
      
      // Get chapter info with book name
      const chapter = await this.db!.getFirstAsync<Chapter>(
        `SELECT c.*, b.name as book_name 
         FROM chapters c 
         JOIN books b ON c.book_id = b.id 
         WHERE c.id = ?`,
        [chapterId]
      );
      
      if (!chapter) return null;
      
      // Get all sections for this chapter and current version
      const sections = await this.db!.getAllAsync<Section>(
        'SELECT * FROM sections WHERE chapter_id = ? AND version_id = ? ORDER BY section_order',
        [chapterId, this.currentVersion]
      );
      
      if (!sections || sections.length === 0) {
        console.warn(`[SQLite] No sections found for chapter ${chapterId}`);
        return null;
      }
      
      // Build complete content structure
      const content: ChapterContent = {
        chapter,
        sections: []
      };
      
      for (const section of sections) {
        // Get paragraphs for this section and version
        const paragraphs = await this.db!.getAllAsync<Paragraph>(
          'SELECT * FROM paragraphs WHERE section_id = ? AND version_id = ? ORDER BY paragraph_order',
          [section.id, this.currentVersion]
        );
        
        const sectionData = {
          section,
          paragraphs: [] as Array<{ paragraph: Paragraph; verseLines: VerseLine[] }>
        };
        
        for (const paragraph of paragraphs) {
          // Get verse lines for this paragraph with verse numbers and version
          // show_verse_number flag is stored directly in the database
          const verseLines = await this.db!.getAllAsync<VerseLine>(
            `SELECT vl.*,
                    CASE WHEN vl.show_verse_number = 1 THEN v.verse_number ELSE NULL END as verse_number,
                    vl.show_verse_number
             FROM verse_lines vl
             JOIN verses v ON v.id = vl.verse_id
             WHERE vl.paragraph_id = ? AND vl.version_id = ?
             ORDER BY vl.sequence_order`,
            [paragraph.id, this.currentVersion]
          );
          
          sectionData.paragraphs.push({ paragraph, verseLines });
        }
        
        content.sections.push(sectionData);
      }
      
      const queryTime = performance.now() - startTime;
      console.log(`[SQLite] Chapter ${chapterId} loaded in ${queryTime.toFixed(2)}ms`);
      
      return content;
    } catch (error) {
      console.error('[SQLite] Error loading chapter content:', error);
      return null;
    }
    });
  }

  /**
   * Queue queries to prevent database overload with retry logic
   */
  private async queueQuery<T>(queryFn: () => Promise<T>): Promise<T> {
    // Wait if too many concurrent queries
    while (this.activeQueries >= this.maxConcurrentQueries) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    this.activeQueries++;
    let retries = 3;
    let lastError: any;
    
    while (retries > 0) {
      try {
        return await queryFn();
      } catch (error: any) {
        lastError = error;
        retries--;
        
        if (error?.message?.includes('NullPointerException') || 
            error?.message?.includes('database is locked')) {
          console.warn(`[SQLite] Database busy, retrying... (${3 - retries}/3)`);
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 100 * (4 - retries)));
        } else {
          // Non-retryable error
          break;
        }
      } finally {
        if (retries === 0 || retries === 3) {
          this.activeQueries--;
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Get multiple chapters at once (for prefetching)
   */
  async getChapterRange(startChapterId: number, endChapterId: number): Promise<ChapterContent[]> {
    await this.ensureInitialized();

    const chapters: ChapterContent[] = [];

    // Get all chapter IDs in range
    const chapterIds = await this.db!.getAllAsync<{ id: number }>(
      `SELECT id FROM chapters
       WHERE id >= ? AND id <= ?
       ORDER BY id`,
      [startChapterId, endChapterId]
    );

    // Load each chapter
    for (const { id } of chapterIds) {
      const content = await this.getChapterContent(id);
      if (content) {
        chapters.push(content);
      }
    }

    return chapters;
  }

  /**
   * Get chapters for Bible Peek display
   * Fetches reference chapter plus N chapters before and after (respecting book boundaries)
   */
  async getChaptersForBiblePeek(
    bookNumber: number,
    chapter: number,
    contextChapters: number = 2
  ): Promise<{
    chapters: ChapterContent[];
    referenceChapterIndex: number;
  }> {
    await this.ensureInitialized();

    // Convert simple book number (1-66) to full book ID format (1000000, 40000000, etc.)
    const fullBookId = bookNumber * 1000000;

    // Get book info to verify it exists
    const book = await this.db!.getFirstAsync<{ id: number }>(
      'SELECT id FROM books WHERE id = ?',
      [fullBookId]
    );

    if (!book) {
      console.error(`[SQLite] Book ${bookNumber} (id: ${fullBookId}) not found`);
      return { chapters: [], referenceChapterIndex: 0 };
    }

    // Get max chapter number for this book from chapters table
    const chapterCountResult = await this.db!.getFirstAsync<{ max_chapter: number }>(
      'SELECT MAX(chapter_number) as max_chapter FROM chapters WHERE book_id = ?',
      [fullBookId]
    );
    const maxChapter = chapterCountResult?.max_chapter || chapter;

    // Calculate chapter range (staying within book boundaries)
    const startChapter = Math.max(1, chapter - contextChapters);
    const endChapter = Math.min(maxChapter, chapter + contextChapters);

    // Build chapter IDs (format: bookNumber * 1000000 + chapterNumber * 1000)
    const startChapterId = fullBookId + startChapter * 1000;
    const endChapterId = fullBookId + endChapter * 1000;

    // Fetch chapters in range
    const chapters = await this.getChapterRange(startChapterId, endChapterId);

    // Calculate the index of the reference chapter in the result array
    const referenceChapterIndex = chapter - startChapter;

    console.log(
      `[SQLite] Bible Peek loaded ${chapters.length} chapters for ${book.id} ch.${chapter} (${startChapter}-${endChapter})`
    );

    return {
      chapters,
      referenceChapterIndex,
    };
  }

  /**
   * Search verse lines by text
   * Always filters by current Bible version
   */
  async searchVerseLines(query: string, limit: number = 50): Promise<VerseLine[]> {
    await this.ensureInitialized();

    const result = await this.db!.getAllAsync<VerseLine>(
      `SELECT vl.*,
              CASE WHEN vl.show_verse_number = 1 THEN v.verse_number ELSE NULL END as verse_number,
              vl.show_verse_number
       FROM verse_lines vl
       JOIN verses v ON v.id = vl.verse_id
       WHERE vl.version_id = ?
       AND vl.text LIKE ?
       LIMIT ?`,
      [this.currentVersion, `%${query}%`, limit]
    );

    return result;
  }

  /**
   * Get verse entity by ID
   */
  async getVerse(verseId: number): Promise<Verse | null> {
    await this.ensureInitialized();
    
    const result = await this.db!.getFirstAsync<Verse>(
      'SELECT * FROM verses WHERE id = ?',
      [verseId]
    );
    
    return result || null;
  }

  /**
   * Get verse line by ID (returns first match)
   * Note: Since verse line IDs can be duplicated across paragraphs, this returns the first match.
   * Use getVerseLineByCompositeKey for a specific paragraph's verse line.
   * Always filters by current Bible version
   */
  async getVerseLine(verseLineId: string): Promise<VerseLine | null> {
    await this.ensureInitialized();

    const result = await this.db!.getFirstAsync<VerseLine>(
      `SELECT vl.*,
              CASE WHEN vl.show_verse_number = 1 THEN v.verse_number ELSE NULL END as verse_number,
              vl.show_verse_number
       FROM verse_lines vl
       JOIN verses v ON v.id = vl.verse_id
       WHERE vl.version_id = ?
       AND vl.id = ?
       LIMIT 1`,
      [this.currentVersion, verseLineId]
    );

    return result || null;
  }

  /**
   * Get verse line by composite key (paragraph_id + verse_line_id)
   * Always filters by current Bible version
   */
  async getVerseLineByCompositeKey(paragraphId: number, verseLineId: string): Promise<VerseLine | null> {
    await this.ensureInitialized();

    const result = await this.db!.getFirstAsync<VerseLine>(
      `SELECT vl.*,
              CASE WHEN vl.show_verse_number = 1 THEN v.verse_number ELSE NULL END as verse_number,
              vl.show_verse_number
       FROM verse_lines vl
       JOIN verses v ON v.id = vl.verse_id
       WHERE vl.version_id = ?
       AND vl.paragraph_id = ?
       AND vl.id = ?`,
      [this.currentVersion, paragraphId, verseLineId]
    );

    return result || null;
  }

  /**
   * Get verse lines for a specific range (e.g., John 3:16-18)
   * Always filters by current Bible version
   */
  async getVerseLineRange(chapterId: number, startVerse: number, endVerse: number): Promise<VerseLine[]> {
    await this.ensureInitialized();

    const result = await this.db!.getAllAsync<VerseLine>(
      `SELECT vl.*,
              CASE WHEN vl.show_verse_number = 1 THEN v.verse_number ELSE NULL END as verse_number,
              vl.show_verse_number
       FROM verse_lines vl
       JOIN verses v ON v.id = vl.verse_id
       JOIN paragraphs p ON vl.paragraph_id = p.id AND p.version_id = ?
       JOIN sections s ON p.section_id = s.id AND s.version_id = ?
       WHERE s.chapter_id = ?
       AND vl.version_id = ?
       AND v.verse_number >= ?
       AND v.verse_number <= ?
       ORDER BY v.id, vl.line_order`,
      [this.currentVersion, this.currentVersion, chapterId, this.currentVersion, startVerse, endVerse]
    );

    return result;
  }

  /**
   * Get verse numbers for a chapter (for verse navigation UI)
   * Returns array of verse numbers (e.g., [1, 2, 3, ..., 24] for Genesis 3)
   * Performance target: <5ms with indexed query
   */
  async getVerseNumbersForChapter(bookId: number, chapterNumber: number): Promise<number[]> {
    await this.ensureInitialized();

    const chapterId = bookId * 1000000 + chapterNumber * 1000;

    const result = await this.db!.getAllAsync<{ verse_number: number }>(
      `SELECT DISTINCT verse_number
       FROM verses
       WHERE chapter_id = ?
       ORDER BY verse_number`,
      [chapterId]
    );

    return result.map(row => row.verse_number);
  }

  /**
   * Get adjacent chapters for prefetching
   * Simple approach that works across book boundaries
   */
  async getAdjacentChapters(chapterId: number, before: number = 2, after: number = 2): Promise<number[]> {
    // Just use the more robust getSequentialChapterRange
    return this.getSequentialChapterRange(chapterId, before, after);
  }

  /**
   * Get chapter by global index (0-based)
   */
  async getChapterByIndex(index: number): Promise<Chapter | null> {
    await this.ensureInitialized();
    
    const result = await this.db!.getFirstAsync<Chapter>(
      `SELECT c.*, b.name as book_name 
       FROM chapters c 
       JOIN books b ON c.book_id = b.id 
       ORDER BY b.book_order, c.chapter_number 
       LIMIT 1 OFFSET ?`,
      [index]
    );
    
    return result || null;
  }

  /**
   * Get sequential chapter range for continuous scrolling
   * Returns chapters in reading order regardless of ID gaps
   */
  async getSequentialChapterRange(centerChapterId: number, before: number = 5, after: number = 10): Promise<number[]> {
    await this.ensureInitialized();
    
    try {
      // Fix chapter ID if invalid
      if (centerChapterId % 1000 !== 0) {
        const bookPart = Math.floor(centerChapterId / 1000000) * 1000000;
        const chapterPart = Math.floor((centerChapterId % 1000000) / 1000) * 1000;
        const correctedId = bookPart + chapterPart;
        console.log(`[SQLite] Correcting chapter ID from ${centerChapterId} to ${correctedId}`);
        centerChapterId = correctedId;
      }
      
      console.log(`[SQLite] Getting sequential range for chapter ${centerChapterId}, before: ${before}, after: ${after}`);
      
      // Use cached chapter list if available
      let allChapters = this.cachedChapterList;
      
      if (!allChapters) {
        console.log('[SQLite] Loading chapter list for the first time...');
        // Queue this query to prevent database overload
        allChapters = await this.queueQuery(async () => {
          return await this.db!.getAllAsync<{ id: number }>(
            `SELECT c.id
             FROM chapters c 
             JOIN books b ON c.book_id = b.id 
             ORDER BY b.book_order, c.chapter_number`
          );
        });
        
        // Cache for future use
        this.cachedChapterList = allChapters;
      }
      
      console.log(`[SQLite] Total chapters in database: ${allChapters.length}`);
      
      // Find the center chapter's position
      const centerIndex = allChapters.findIndex(c => c.id === centerChapterId);
      
      if (centerIndex === -1) {
        console.error(`[SQLite] Chapter ${centerChapterId} not found in sequential list`);
        return [centerChapterId];
      }
      
      // Get range with bounds checking
      const startIndex = Math.max(0, centerIndex - before);
      const endIndex = Math.min(allChapters.length - 1, centerIndex + after);
      
      // Return the IDs in the range
      const result = allChapters
        .slice(startIndex, endIndex + 1)
        .map(c => c.id);
      
      console.log(`[SQLite] Returning ${result.length} chapters: indices ${startIndex}-${endIndex}, IDs: ${result[0]}-${result[result.length-1]}`);
      
      return result;
    } catch (error) {
      console.error('[SQLite] Error in getSequentialChapterRange:', error);
      // Return just the center chapter on error - DO NOT generate invalid IDs
      return [centerChapterId];
    }
  }

  /**
   * Get total chapter count
   */
  async getTotalChapterCount(): Promise<number> {
    await this.ensureInitialized();
    
    const result = await this.db!.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM chapters'
    );
    
    return result?.count || 0;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.isInitialized = false;
    }
  }

  // ============================================================================
  // BIBLE PLANS QUERIES
  // ============================================================================

  /**
   * Get all available Bible reading plans
   */
  async getAllPlans(): Promise<Array<{
    id: string;
    name: string;
    description: string | null;
    duration_days: number;
    group_id: string | null;
    group_name: string | null;
    sort_order: number;
    source: string | null;
  }>> {
    await this.ensureInitialized();

    try {
      const plans = await this.db!.getAllAsync<{
        id: string;
        name: string;
        description: string | null;
        duration_days: number;
        group_id: string | null;
        group_name: string | null;
        sort_order: number;
        source: string | null;
      }>(
        'SELECT * FROM bible_plans ORDER BY group_id, sort_order, name'
      );

      console.log(`[SQLite] Loaded ${plans.length} Bible reading plans`);
      return plans;
    } catch (error) {
      console.warn('[SQLite] bible_plans table not found or query failed:', error);
      return [];
    }
  }

  /**
   * Get a specific plan with all its days and content items
   * Content items can be: intro, reading, or recap
   */
  async getPlanById(planId: string): Promise<{
    id: string;
    name: string;
    description: string | null;
    duration_days: number;
    group_id: string | null;
    group_name: string | null;
    sort_order: number;
    source: string | null;
    days: Array<{
      day_number: number;
      content: Array<{
        order: number;
        type: 'intro' | 'reading' | 'recap';
        reference?: string;
        verse_id_start?: number;
        verse_id_end?: number;
        text?: string;
      }>;
    }>;
  } | null> {
    await this.ensureInitialized();

    try {
      // Get plan info
      const plan = await this.db!.getFirstAsync<{
        id: string;
        name: string;
        description: string | null;
        duration_days: number;
        group_id: string | null;
        group_name: string | null;
        sort_order: number;
        source: string | null;
      }>(
        'SELECT * FROM bible_plans WHERE id = ?',
        [planId]
      );

      if (!plan) return null;

      // Get all days with content items (unified content structure)
      const contentData = await this.db!.getAllAsync<{
        day_id: number;
        day_number: number;
        content_order: number;
        content_type: 'intro' | 'reading' | 'recap';
        reference: string | null;
        verse_id_start: number | null;
        verse_id_end: number | null;
        text: string | null;
      }>(
        `SELECT
          d.id as day_id,
          d.day_number,
          c.content_order,
          c.content_type,
          c.reference,
          c.verse_id_start,
          c.verse_id_end,
          c.text
         FROM bible_plan_days d
         LEFT JOIN bible_plan_content c ON c.plan_day_id = d.id
         WHERE d.plan_id = ?
         ORDER BY d.day_number, c.content_order`,
        [planId]
      );

      // Group content items by day
      const daysMap = new Map<number, {
        day_number: number;
        content: Array<{
          order: number;
          type: 'intro' | 'reading' | 'recap';
          reference?: string;
          verse_id_start?: number;
          verse_id_end?: number;
          text?: string;
        }>;
      }>();

      for (const row of contentData) {
        if (!daysMap.has(row.day_number)) {
          daysMap.set(row.day_number, {
            day_number: row.day_number,
            content: []
          });
        }

        if (row.content_type) {
          const contentItem: {
            order: number;
            type: 'intro' | 'reading' | 'recap';
            reference?: string;
            verse_id_start?: number;
            verse_id_end?: number;
            text?: string;
          } = {
            order: row.content_order,
            type: row.content_type,
          };

          // Add reading-specific fields
          if (row.content_type === 'reading') {
            if (row.reference) contentItem.reference = row.reference;
            if (row.verse_id_start !== null) contentItem.verse_id_start = row.verse_id_start;
            if (row.verse_id_end !== null) contentItem.verse_id_end = row.verse_id_end;
          } else {
            // Add text for intro/recap
            if (row.text) contentItem.text = row.text;
          }

          daysMap.get(row.day_number)!.content.push(contentItem);
        }
      }

      return {
        ...plan,
        days: Array.from(daysMap.values()).sort((a, b) => a.day_number - b.day_number)
      };
    } catch (error) {
      console.warn('[SQLite] Failed to load plan:', error);
      return null;
    }
  }

  /**
   * Search plans by name or description
   */
  async searchPlans(query: string): Promise<Array<{
    id: string;
    name: string;
    description: string | null;
    duration_days: number;
    category: string | null;
    source: string | null;
  }>> {
    await this.ensureInitialized();

    try {
      const plans = await this.db!.getAllAsync<{
        id: string;
        name: string;
        description: string | null;
        duration_days: number;
        category: string | null;
        source: string | null;
      }>(
        `SELECT * FROM bible_plans
         WHERE name LIKE ? OR description LIKE ?
         ORDER BY name`,
        [`%${query}%`, `%${query}%`]
      );

      return plans;
    } catch (error) {
      console.warn('[SQLite] Failed to search plans:', error);
      return [];
    }
  }

  /**
   * Get plans by category
   */
  async getPlansByCategory(category: string): Promise<Array<{
    id: string;
    name: string;
    description: string | null;
    duration_days: number;
    category: string | null;
    source: string | null;
  }>> {
    await this.ensureInitialized();

    try {
      const plans = await this.db!.getAllAsync<{
        id: string;
        name: string;
        description: string | null;
        duration_days: number;
        category: string | null;
        source: string | null;
      }>(
        'SELECT * FROM bible_plans WHERE category = ? ORDER BY name',
        [category]
      );

      return plans;
    } catch (error) {
      console.warn('[SQLite] Failed to get plans by category:', error);
      return [];
    }
  }

  /**
   * Get all unique plan categories
   */
  async getPlanCategories(): Promise<string[]> {
    await this.ensureInitialized();

    try {
      const categories = await this.db!.getAllAsync<{ category: string }>(
        'SELECT DISTINCT category FROM bible_plans WHERE category IS NOT NULL ORDER BY category'
      );

      return categories.map(c => c.category);
    } catch (error) {
      console.warn('[SQLite] Failed to get plan categories:', error);
      return [];
    }
  }
}

// Export singleton instance
export const bibleSQLite = new BibleSQLiteService();