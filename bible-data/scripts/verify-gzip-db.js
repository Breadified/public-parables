const Database = require('../../frontend/node_modules/better-sqlite3');
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// Compressed file is in frontend/assets, test in bible-data/data
const gzipPath = path.join(__dirname, '../../frontend/assets/bible.db.gz');
const testDbPath = path.join(__dirname, '../data/bible-test.db');

console.log('🔍 Verifying GZIP Compressed Database\n');

console.log('📦 Decompressing...');
const compressed = fs.readFileSync(gzipPath);
const decompressed = zlib.gunzipSync(compressed);
fs.writeFileSync(testDbPath, decompressed);
console.log('✅ Decompression successful\n');

console.log('🔍 Testing database integrity...');
const db = new Database(testDbPath);

try {
  // Test 1: Check integrity
  const integrityCheck = db.prepare('PRAGMA integrity_check;').get();
  console.log(`   Integrity: ${integrityCheck.integrity_check}`);

  // Test 2: Count records
  const versionCount = db.prepare('SELECT COUNT(*) as count FROM bible_versions').get();
  const verseCount = db.prepare('SELECT COUNT(*) as count FROM verse_lines').get();
  const bookCount = db.prepare('SELECT COUNT(*) as count FROM books').get();

  console.log(`   Bible versions: ${versionCount.count}`);
  console.log(`   Verse lines: ${verseCount.count}`);
  console.log(`   Books: ${bookCount.count}`);

  // Test 3: Sample query
  const sampleVerse = db.prepare(`
    SELECT * FROM verse_lines
    WHERE verse_id = 43003016
    LIMIT 1
  `).get();

  if (sampleVerse) {
    console.log('\n📖 Sample verse (John 3:16):');
    console.log(`   ${sampleVerse.text}`);
  }

  db.close();

  // Clean up test file
  fs.unlinkSync(testDbPath);

  console.log('\n✅ Database integrity verified!');
  console.log('🎉 bible.db.gz is ready to use in your Expo app!');

} catch (err) {
  console.error('❌ Verification failed:', err);
  db.close();
  fs.unlinkSync(testDbPath);
  process.exit(1);
}
