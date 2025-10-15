const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add the parent directory to the watchFolders
config.watchFolders = [
  path.resolve(__dirname, '..'),
];

// Use parent node_modules as the primary source
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, '../node_modules'),
];

// Ensure proper resolver configuration
config.resolver.platforms = ['ios', 'android', 'native'];

// Fix module resolution by disabling package exports
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
