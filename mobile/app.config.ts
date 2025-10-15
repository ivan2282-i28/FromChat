import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig & { main: string } => ({
    ...config,
    name: "FromChat",
    slug: "fromchat-mobile",
    version: "1.0.0",
    main: "index.js",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
        image: "./assets/splash.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
        "**/*"
    ],
    ios: {
        supportsTablet: true,
        bundleIdentifier: "com.fromchat.mobile"
    },
    android: {
        adaptiveIcon: {
            foregroundImage: "./assets/adaptive-icon.png",
            backgroundColor: "#ffffff"
        },
        package: "com.fromchat.mobile"
    },
    plugins: [
        "expo-notifications",
        "expo-media-library",
        "expo-file-system",
        "expo-camera",
        "expo-image-picker",
        "expo-document-picker"
    ],
    notification: {
        icon: "./assets/notification-icon.png",
        color: "#ffffff"
    }
});
