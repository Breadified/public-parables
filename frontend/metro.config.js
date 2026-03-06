const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add asset extensions for compressed database and wasm
config.resolver.assetExts.push("gz", "wasm");

// Increase optimization size limit for large assets like bible.db.gz (11.12 MB)
// Default is 150 KiB - we set it to 20 MB to handle our compressed database
config.transformer.minifierConfig = config.transformer.minifierConfig || {};
config.transformer.minifierConfig.compress = {
  ...config.transformer.minifierConfig.compress,
  // Drop console statements in production
  drop_console: false,
};

// Increase the size threshold for optimizations
// This prevents Metro from skipping optimizations on our large .gz file
if (!config.transformer.optimizationSizeLimit) {
  config.transformer.optimizationSizeLimit = 20 * 1024 * 1024; // 20 MB
}

module.exports = config;
