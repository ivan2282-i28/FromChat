const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Only watch specific directories from the parent to improve performance
config.watchFolders = [
    path.resolve(__dirname, '../package.json'),
    path.resolve(__dirname, '../node_modules'),
];

// Add the parent node_modules to the resolver
config.resolver.nodeModulesPaths = [
    path.resolve(__dirname, '../node_modules'),
];

// Ignore other files in parent directory to reduce file watching
config.resolver.blockList = [
    /.*\/backend\/.*/,
    /.*\/frontend\/.*/,
    /.*\/deployment\/.*/,
    /.*\/build\/.*/,
];

export default config;
