const Database = require('../../frontend/node_modules/better-sqlite3');
const fs = require('fs');
const path = require('path');

// Database is now stored in bible-data/data
const dbPath = path.join(__dirname, '../data/bible.db');
const backupPath = path.join(__dirname, '../data/bible.db.backup');

console.log('🗜️  Bible Database Compression Script\n');

// Create backup
console.log('📋 Creating backup...');
fs.copyFileSync(dbPath, backupPath);
console.log('✅ Backup created at:', backupPath);

// Get original size
const originalSize = fs.statSync(dbPath).size;
console.log(`📊 Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB\n`);

const db = new Database(dbPath);

console.log('🔧 Applying compression techniques...\n');

try {
  // Step 1: VACUUM (removes free pages and defragments)
  console.log('1️⃣  Running VACUUM...');
  db.exec('VACUUM;');
  console.log('✅ VACUUM complete');

  // Step 2: Analyze for query optimization
  console.log('2️⃣  Running ANALYZE...');
  db.exec('ANALYZE;');
  console.log('✅ ANALYZE complete');

  // Step 3: Check what's taking space
  console.log('\n3️⃣  Analyzing table sizes...');
  try {
    const rows = db.prepare(`
      SELECT
        name,
        SUM(pgsize) as size
      FROM dbstat
      WHERE name NOT LIKE 'sqlite_%'
      GROUP BY name
      ORDER BY size DESC;
    `).all();

    if (rows && rows.length > 0) {
      console.log('\nTable sizes:');
      rows.forEach(row => {
        console.log(`  ${row.name}: ${(row.size / 1024 / 1024).toFixed(2)} MB`);
      });
    }
  } catch (err) {
    console.log('⚠️  Could not analyze table sizes (not critical)');
  }

  // Step 4: Close and check final size
  db.close();

  const finalSize = fs.statSync(dbPath).size;
  const reduction = originalSize - finalSize;
  const percentReduction = ((reduction / originalSize) * 100).toFixed(2);

  console.log('\n📊 Compression Results:');
  console.log(`   Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Final: ${(finalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Saved: ${(reduction / 1024 / 1024).toFixed(2)} MB (${percentReduction}%)`);

  if (finalSize > 25 * 1024 * 1024) {
    console.log('\n⚠️  WARNING: Database is still over 25MB!');
    console.log('   Consider these additional strategies:');
    console.log('   1. Remove unused Bible versions');
    console.log('   2. Store only essential metadata');
    console.log('   3. Use on-demand download for additional versions');
    console.log('   4. Compress with gzip and decompress on first launch');
  } else {
    console.log('\n✅ Database is now under 25MB threshold!');
  }

  console.log(`\n💾 Backup available at: ${backupPath}`);
} catch (err) {
  console.error('❌ Error during compression:', err);
  db.close();
  process.exit(1);
}
