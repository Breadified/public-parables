const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

/**
 * Creates a temporary directory for unzipping Bible source files
 * @returns {string} Path to the temp directory
 */
function createTempDir() {
  const tempBase = os.tmpdir();
  const tempDir = path.join(tempBase, `bible-data-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Unzips a Bible source zip file to a temporary directory
 * @param {string} zipPath - Path to the zip file
 * @param {string} tempDir - Temp directory to unzip to
 * @returns {string} Path to the unzipped content directory
 */
function unzipToTemp(zipPath, tempDir) {
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Zip file not found: ${zipPath}`);
  }

  console.log(`Unzipping ${path.basename(zipPath)} to temp directory...`);

  // Use PowerShell Expand-Archive on Windows, unzip on Unix
  try {
    if (process.platform === "win32") {
      execSync(
        `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force"`,
        { stdio: "inherit" },
      );
    } else {
      execSync(`unzip -q -o "${zipPath}" -d "${tempDir}"`, {
        stdio: "inherit",
      });
    }
  } catch (error) {
    throw new Error(`Failed to unzip: ${error.message}`);
  }

  // Find the unzipped directory (should be the only directory in tempDir)
  const contents = fs.readdirSync(tempDir);
  const unzippedDir = contents.find((item) =>
    fs.statSync(path.join(tempDir, item)).isDirectory(),
  );

  if (!unzippedDir) {
    throw new Error("No directory found after unzipping");
  }

  const unzippedPath = path.join(tempDir, unzippedDir);
  console.log(`Unzipped to: ${unzippedPath}`);
  return unzippedPath;
}

/**
 * Cleans up temporary directory
 * @param {string} tempDir - Temp directory to remove
 */
function cleanupTemp(tempDir) {
  if (fs.existsSync(tempDir)) {
    console.log(`Cleaning up temp directory: ${tempDir}`);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = {
  createTempDir,
  unzipToTemp,
  cleanupTemp,
};
