// Mobile-specific type definitions
// This will eventually import from shared types
import type { MD3Theme } from 'react-native-paper';

export interface MobileAppConfig {
    apiBaseUrl: string;
    websocketUrl: string;
}

export interface PlatformInfo {
    platform: 'ios' | 'android' | 'web';
    version: string;
}

declare module 'react-native-paper' {
    export type EnhancedMD3Theme = Omit<MD3Theme, 'colors'> & {
        colors: MD3Colors & {
            surfaceContainer: string;
            onSurfaceContainer: string;
        }
    }

    export const MD3LightTheme: EnhancedMD3Theme;
    export const MD3DarkTheme: EnhancedMD3Theme;
}