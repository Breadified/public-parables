/**
 * App Version Configuration
 *
 * App version (1.0.4) is defined in app.config.js
 * Build number is auto-incremented on every ship
 */

// This should match app.config.js version
export const APP_VERSION = "1.0.4";

// Build number - incremented by npm run ship
export const BUILD_NUMBER = 67;

export const getVersionString = (): string => {
  return `${APP_VERSION}.${BUILD_NUMBER}`;
};

export const getVersionDisplay = (): string => {
  return `v${getVersionString()}`;
};
