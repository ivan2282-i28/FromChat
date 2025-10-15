import { Platform } from 'react-native';

export const MOBILE_CONFIG = {
    apiBaseUrl: __DEV__ 
        ? 'http://localhost:8300/api' 
        : 'https://beta.fromchat.ru/api',
    websocketUrl: __DEV__
        ? 'ws://localhost:8300/api'
        : 'wss://beta.fromchat.ru/api',
    platform: Platform.OS as 'ios' | 'android' | 'web',
};
