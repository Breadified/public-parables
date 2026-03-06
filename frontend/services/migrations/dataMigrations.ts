/**
 * DATA MIGRATIONS - TEMPORARY FIXES
 *
 * This file contains temporary data migrations that fix data format issues.
 * These migrations run automatically on app launch.
 *
 * ⚠️ IMPORTANT: Mark each migration with:
 * - Date added
 * - Issue fixed
 * - Safe to remove after (date)
 *
 * Clean up old migrations periodically to keep codebase lean.
 */

import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bibleStore$ } from '../../state/bibleStore';
import type { Note } from '../../types/database';

/**
 * MIGRATION 001: Fix Note IDs from Custom Format to UUID
 *
 * Added: 2025-11-19
 * Issue: Notes were created with custom IDs like "note_1763271407568_hy3vyk01q"
 *        but Supabase requires proper UUID format
 * Fix: Replace all custom note IDs with proper UUIDs
 * Safe to remove: After 2025-12-19 (30 days - enough for all users to migrate)
 *
 * @returns Number of notes migrated
 */
export async function migrateNoteIdsToUUID(): Promise<number> {
  try {
    const notes = bibleStore$.notes.get();
    let migratedCount = 0;

    // UUID regex pattern (36 chars with hyphens in specific positions)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const migratedNotes = notes.map((note: Note) => {
      // Check if note ID is NOT a valid UUID
      if (!uuidPattern.test(note.id)) {
        migratedCount++;
        console.log(`[Migration 001] Converting note ID: ${note.id} -> UUID`);

        return {
          ...note,
          id: uuidv4(), // Generate new UUID
        };
      }
      return note;
    });

    if (migratedCount > 0) {
      console.log(`[Migration 001] Migrated ${migratedCount} notes to UUID format`);

      // Update store
      bibleStore$.notes.set(migratedNotes);

      // Persist to AsyncStorage
      await bibleStore$.saveNotesToStorage();

      console.log(`[Migration 001] ✅ Migration complete - ${migratedCount} notes updated`);
    } else {
      console.log('[Migration 001] ✅ No notes need migration');
    }

    return migratedCount;
  } catch (error) {
    console.error('[Migration 001] ❌ Migration failed:', error);
    // Don't throw - allow app to continue even if migration fails
    return 0;
  }
}

/**
 * MIGRATION 002: Migrate from softDeletedNotes Array to Status Field
 *
 * Added: 2025-11-22
 * Issue: Notes use separate softDeletedNotes array instead of status field.
 *        This prevents proper Supabase sync and creates unnecessary complexity.
 * Fix:
 *   1. Add status: 'active' to all existing notes in notes array
 *   2. Add status: 'inactive' to all notes in softDeletedNotes array
 *   3. Merge both arrays into single notes array
 *   4. Remove softDeletedNotes from AsyncStorage
 * Safe to remove: After 2025-12-22 (30 days)
 *
 * @returns Number of notes migrated
 */
export async function migrateNotesToStatusField(): Promise<number> {
  try {
    console.log('[Migration 002] 🔄 Migrating notes to status field...');

    // Load current notes from storage directly (bypass store to get raw data)
    const notesJSON = await AsyncStorage.getItem('bible_notes');
    const softDeletedJSON = await AsyncStorage.getItem('bible_soft_deleted_notes');

    const notes: Note[] = notesJSON ? JSON.parse(notesJSON) : [];
    const softDeletedNotes: Note[] = softDeletedJSON ? JSON.parse(softDeletedJSON) : [];

    let migratedCount = 0;

    // Add status to active notes (if they don't have it)
    const activeNotes = notes.map((note: Note) => {
      if (!note.status) {
        migratedCount++;
        return { ...note, status: 'active' as const };
      }
      return note;
    });

    // Add status to soft deleted notes
    const inactiveNotes = softDeletedNotes.map((note: Note) => {
      migratedCount++;
      return { ...note, status: 'inactive' as const };
    });

    console.log('[Migration 002] 📊 Migration stats:', {
      activeNotes: activeNotes.length,
      inactiveNotes: inactiveNotes.length,
      totalMigrated: migratedCount
    });

    if (migratedCount > 0 || softDeletedNotes.length > 0) {
      // Merge arrays
      const mergedNotes = [...activeNotes, ...inactiveNotes];

      // Update store
      bibleStore$.notes.set(mergedNotes);

      // Save to AsyncStorage
      await bibleStore$.saveNotesToStorage();

      // Remove old softDeletedNotes key
      await AsyncStorage.removeItem('bible_soft_deleted_notes');

      console.log(`[Migration 002] ✅ Migration complete - ${migratedCount} notes updated, softDeletedNotes removed`);
    } else {
      console.log('[Migration 002] ✅ No notes need migration');
    }

    return migratedCount;
  } catch (error) {
    console.error('[Migration 002] ❌ Migration failed:', error);
    // Don't throw - allow app to continue even if migration fails
    return 0;
  }
}

/**
 * Run all data migrations
 * Call this on app initialization
 */
export async function runAllDataMigrations(): Promise<void> {
  console.log('[DataMigrations] 🔄 Running data migrations...');

  try {
    // Run migrations in order
    const notesMigrated = await migrateNoteIdsToUUID();
    const statusMigrated = await migrateNotesToStatusField();

    // Add future migrations here:
    // await migration003();

    console.log('[DataMigrations] ✅ All migrations complete', {
      notesMigrated,
      statusMigrated,
    });
  } catch (error) {
    console.error('[DataMigrations] ❌ Migrations failed:', error);
    // Don't throw - allow app to continue
  }
}

/**
 * MIGRATION TEMPLATE
 *
 * Copy this template for new migrations:
 *
 * export async function migrationXXX_Description(): Promise<number> {
 *   // Added: YYYY-MM-DD
 *   // Issue: What problem this fixes
 *   // Fix: What this migration does
 *   // Safe to remove: YYYY-MM-DD (30 days after)
 *
 *   try {
 *     // Migration logic here
 *     return migratedCount;
 *   } catch (error) {
 *     console.error('[Migration XXX] Failed:', error);
 *     return 0;
 *   }
 * }
 */
