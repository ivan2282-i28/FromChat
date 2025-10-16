import React, { useEffect } from 'react';
import { PaperProvider, MD3LightTheme, MD3DarkTheme, ActivityIndicator } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/store/authStore';

export default function App() {
    const colorScheme = useColorScheme();
    const { restoreSession, isLoading } = useAuthStore();
    
    // Material You theme with automatic dark/light mode
    const theme = colorScheme === 'dark' ? MD3DarkTheme : MD3LightTheme;

    useEffect(() => {
        // Check for saved credentials on app launch
        restoreSession();
    }, [restoreSession]);

    if (isLoading) {
        return (
            <SafeAreaProvider>
                <PaperProvider theme={theme}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" />
                    </View>
                </PaperProvider>
            </SafeAreaProvider>
        );
    }

    return (
        <SafeAreaProvider>
            <PaperProvider theme={theme}>
                <NavigationContainer>
                    <AppNavigator />
                </NavigationContainer>
            </PaperProvider>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5'
    }
});