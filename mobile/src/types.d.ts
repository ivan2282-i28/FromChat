// Mobile-specific type definitions
// This will eventually import from shared types

export interface MobileAppConfig {
    apiBaseUrl: string;
    websocketUrl: string;
}

export interface PlatformInfo {
    platform: 'ios' | 'android' | 'web';
    version: string;
}
