const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// Read from bible-data/data, write compressed to frontend/assets
const dbPath = path.join(__dirname, '../data/bible.db');
const gzipPath = path.join(__dirname, '../../frontend/assets/bible.db.gz');

console.log('🗜️  Bible Database GZIP Compression\n');

const originalSize = fs.statSync(dbPath).size;
console.log(`📊 Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

console.log('\n🔧 Compressing with GZIP...');

const input = fs.createReadStream(dbPath);
const output = fs.createWriteStream(gzipPath);
const gzip = zlib.createGzip({ level: 9 }); // Maximum compression

input.pipe(gzip).pipe(output);

output.on('finish', () => {
  const gzipSize = fs.statSync(gzipPath).size;
  const reduction = originalSize - gzipSize;
  const percentReduction = ((reduction / originalSize) * 100).toFixed(2);

  console.log('✅ Compression complete!\n');
  console.log('📊 Results:');
  console.log(`   Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Compressed: ${(gzipSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Saved: ${(reduction / 1024 / 1024).toFixed(2)} MB (${percentReduction}%)`);

  if (gzipSize > 25 * 1024 * 1024) {
    console.log('\n⚠️  WARNING: Compressed file is still over 25MB!');
    console.log('   You need to reduce the database content.');
  } else {
    console.log('\n✅ Compressed file is under 25MB threshold!');
    console.log('\n📝 Next steps:');
    console.log('   1. Update your app to decompress bible.db.gz on first launch');
    console.log('   2. Add this to your asset loading code:');
    console.log('\n   ```typescript');
    console.log('   import * as FileSystem from "expo-file-system";');
    console.log('   import { Asset } from "expo-asset";');
    console.log('   import * as gzip from "pako"; // npm install pako');
    console.log('   ');
    console.log('   async function decompressBibleDb() {');
    console.log('     const asset = Asset.fromModule(require("./assets/bible.db.gz"));');
    console.log('     await asset.downloadAsync();');
    console.log('     const compressed = await FileSystem.readAsStringAsync(');
    console.log('       asset.localUri,');
    console.log('       { encoding: FileSystem.EncodingType.Base64 }');
    console.log('     );');
    console.log('     const decompressed = gzip.ungzip(compressed);');
    console.log('     const dbPath = FileSystem.documentDirectory + "bible.db";');
    console.log('     await FileSystem.writeAsStringAsync(dbPath, decompressed);');
    console.log('   }');
    console.log('   ```');
  }

  console.log(`\n💾 Compressed file: ${gzipPath}`);
});

output.on('error', (err) => {
  console.error('❌ Compression failed:', err);
  process.exit(1);
});
