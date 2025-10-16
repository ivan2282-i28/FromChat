import { getDefaultConfig } from 'expo/metro-config';
import path from 'path';

const config = getDefaultConfig(__dirname);

export default {
    ...config,
    watchFolders: [
        path.resolve(__dirname, '..'),
        path.resolve(__dirname, 'src'),
    ],
    resolver: {
        ...config.resolver,
        nodeModulesPaths: [
            path.resolve(__dirname, '../node_modules'),
            path.resolve(__dirname, 'node_modules'),
        ],
        platforms: ['ios', 'android', 'native'],
        unstable_enablePackageExports: false,
        resolverMainFields: ['react-native', 'browser', 'main'],
    },
};
