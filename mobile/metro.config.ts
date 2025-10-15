import { getDefaultConfig } from 'expo/metro-config';
import path from 'path';

const config = getDefaultConfig(__dirname);

export default {
    ...config,
    watchFolders: [
        path.resolve(__dirname, '..'),
    ],
    resolver: {
        ...config.resolver,
        nodeModulesPaths: [
            path.resolve(__dirname, '../node_modules'),
        ],
        platforms: ['ios', 'android', 'native'],
        unstable_enablePackageExports: false,
    },
};
