import Constants from 'expo-constants';

/**
 * Get the development machine IP from Expo's hostUri
 * @returns The IP address or null if not available
 */
function getDevMachineIP(): string | null {
    const hostUri = Constants.expoConfig?.hostUri;
    if (!hostUri) return null;
    
    // hostUri format: "192.168.1.100:8081"
    const ip = hostUri.split(':')[0];
    return ip;
}

/**
 * Get API base URL based on environment
 */
export function getApiBaseUrl(): string {
    if (__DEV__) {
        const devIP = getDevMachineIP();
        if (devIP) {
            return `http://${devIP}:8300/api`;
        }
        // Fallback for iOS Simulator
        return 'http://localhost:8300/api';
    }
    
    // Production URL
    return 'https://fromchat.ru/api';
}

/**
 * Get WebSocket base URL based on environment
 */
export function getWebSocketBaseUrl(): string {
    if (__DEV__) {
        const devIP = getDevMachineIP();
        if (devIP) {
            return `ws://${devIP}:8300/api`;
        }
        // Fallback for iOS Simulator
        return 'ws://localhost:8300/api';
    }
    
    // Production URL
    return 'wss://fromchat.ru/api';
}

export const API_BASE_URL = getApiBaseUrl();
export const WS_BASE_URL = getWebSocketBaseUrl();
