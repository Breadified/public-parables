#!/usr/bin/env node

/**
 * Apply Migrations to Remote Supabase
 *
 * This script automatically applies SQL migrations to the remote Supabase database
 * using the service role key from .env file.
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  // Skip comments and empty lines
  if (line.trim().startsWith('#') || !line.trim()) return;

  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    env[key] = value;
  }
});

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PROJECT_REF = env.SUPABASE_PROJECT_REF;
const SUPABASE_MIGRATION_PERSONAL_ACCESS_TOKEN = env.SUPABASE_MIGRATION_PERSONAL_ACCESS_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_PROJECT_REF) {
  console.error('❌ Missing required environment variables in .env file');
  console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PROJECT_REF');
  process.exit(1);
}

console.log('🚀 Starting migration application...');
console.log(`📍 Supabase URL: ${SUPABASE_URL}`);

// Function to execute SQL via Supabase Management API using personal access token
async function executeSqlViaManagementApi(sql) {
  if (!SUPABASE_MIGRATION_PERSONAL_ACCESS_TOKEN) {
    throw new Error('SUPABASE_MIGRATION_PERSONAL_ACCESS_TOKEN required for Management API. Get it from: https://supabase.com/dashboard/account/tokens');
  }

  const response = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_MIGRATION_PERSONAL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SQL execution failed: ${response.status} ${errorText}`);
  }

  return await response.json();
}

// Function to execute SQL via service role (RPC function approach)
async function executeSqlViaServiceRole(sql) {
  // This requires creating a custom RPC function in Supabase that can execute SQL
  // Not recommended due to security risks
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql_query: sql })
  });

  if (!response.ok) {
    throw new Error(`SQL execution failed: ${response.status} ${await response.text()}`);
  }

  return await response.json();
}

// Read and apply migration files
async function applyMigrations(skipFiles = []) {
  const migrationsDir = path.join(__dirname, 'migrations');

  // Dynamically read all .sql files from migrations directory
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .filter(file => !skipFiles.includes(file)) // Skip already-applied migrations
    .sort(); // Sort by filename (timestamp-based names are in chronological order)

  if (migrationFiles.length === 0) {
    console.log('\n✅ No migrations to apply (all skipped or already applied)');
    return;
  }

  console.log(`\n📋 Found ${migrationFiles.length} migration(s) to apply`);
  if (skipFiles.length > 0) {
    console.log(`⏭️  Skipping ${skipFiles.length} already-applied migration(s)`);
  }

  for (const filename of migrationFiles) {
    const filePath = path.join(migrationsDir, filename);

    console.log(`\n📄 Applying: ${filename}`);

    try {
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`   Executing SQL via Management API...`);

      // Execute the entire migration file as one SQL statement
      // The Management API can handle multiple statements separated by semicolons
      const result = await executeSqlViaManagementApi(sql);

      console.log(`   ✅ Migration ${filename} applied successfully`);
      if (result && result.length > 0) {
        console.log(`   📊 Result:`, JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error(`   ❌ Error applying ${filename}:`, error.message);
      process.exit(1);
    }
  }

  console.log('\n🎉 All migrations applied successfully!');
}

// Alternative: Generate SQL script that can be copy-pasted
function generateCombinedScript() {
  const migrationsDir = path.join(__dirname, 'migrations');

  // Dynamically read all .sql files from migrations directory
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort by filename (timestamp-based names are in chronological order)

  console.log('\n📋 COMBINED MIGRATION SQL');
  console.log('=' .repeat(80));
  console.log('Copy the SQL below and run it in Supabase SQL Editor:');
  console.log(`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF || 'YOUR_PROJECT'}/sql-editor`);
  console.log('=' .repeat(80));
  console.log('');

  for (const filename of migrationFiles) {
    const filePath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`-- ${filename}`);
    console.log(sql);
    console.log('');
  }

  console.log('=' .repeat(80));
}

// Parse command line arguments
const skipFilesArg = process.argv.find(arg => arg.startsWith('--skip='));
const skipFiles = skipFilesArg
  ? skipFilesArg.split('=')[1].split(',')
  : [];

// Skip first two migrations if they're already applied
const defaultSkipFiles = [
  '20251118000000_consolidated_user_data.sql',
  '20251119000000_auto_create_display_names.sql',
];

// Run the appropriate method
if (process.argv.includes('--print')) {
  // Print mode: generate combined SQL for manual copy-paste
  generateCombinedScript();
} else {
  // Default mode: execute via Management API
  // Skip the first two migrations by default (already applied to your database)
  const filesToSkip = skipFiles.length > 0 ? skipFiles : defaultSkipFiles;

  applyMigrations(filesToSkip).catch(error => {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n💡 Tip: Use --print flag to generate SQL for manual execution');
    console.log('💡 Tip: Use --skip=file1.sql,file2.sql to skip specific migrations');
    process.exit(1);
  });
}
