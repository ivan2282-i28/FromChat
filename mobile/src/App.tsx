import React, { useState, useRef, useEffect } from 'react';
import { PaperProvider, MD3LightTheme, MD3DarkTheme, Text, BottomNavigation, useTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, Animated, useColorScheme } from 'react-native';

// Animated placeholder screens with theme support
function ChatsScreen() {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const theme = useTheme();

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [fadeAnim]);

    return (
        <Animated.View style={[styles.screen, { opacity: fadeAnim }]}>
            <Text style={[styles.screenTitle, { color: theme.colors.onSurface }]}>Chats</Text>
            <Text style={[styles.screenSubtitle, { color: theme.colors.onSurfaceVariant }]}>Your conversations will appear here</Text>
        </Animated.View>
    );
}

function ContactsScreen() {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const theme = useTheme();

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [fadeAnim]);

    return (
        <Animated.View style={[styles.screen, { opacity: fadeAnim }]}>
            <Text style={[styles.screenTitle, { color: theme.colors.onSurface }]}>Contacts</Text>
            <Text style={[styles.screenSubtitle, { color: theme.colors.onSurfaceVariant }]}>Your contacts will appear here</Text>
        </Animated.View>
    );
}

function SettingsScreen() {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const theme = useTheme();

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [fadeAnim]);

    return (
        <Animated.View style={[styles.screen, { opacity: fadeAnim }]}>
            <Text style={[styles.screenTitle, { color: theme.colors.onSurface }]}>Settings</Text>
            <Text style={[styles.screenSubtitle, { color: theme.colors.onSurfaceVariant }]}>App settings will appear here</Text>
        </Animated.View>
    );
}

export default function App() {
    const [index, setIndex] = useState(0);
    const colorScheme = useColorScheme();
    
    // Material You theme with automatic dark/light mode
    const theme = colorScheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
    
    const [routes] = useState([
        { key: 'chats', title: 'Chats', focusedIcon: 'message-text', unfocusedIcon: 'message-text-outline' },
        { key: 'contacts', title: 'Contacts', focusedIcon: 'account-group', unfocusedIcon: 'account-group-outline' },
        { key: 'settings', title: 'Settings', focusedIcon: 'cog', unfocusedIcon: 'cog-outline' },
    ]);

    const renderScene = BottomNavigation.SceneMap({
        chats: ChatsScreen,
        contacts: ContactsScreen,
        settings: SettingsScreen,
    });

    return (
        <SafeAreaProvider>
            <PaperProvider theme={theme}>
                <BottomNavigation
                    navigationState={{ index, routes }}
                    onIndexChange={setIndex}
                    renderScene={renderScene}
                    activeColor={theme.colors.primary}
                    inactiveColor={theme.colors.onSurfaceVariant}
                    barStyle={{ backgroundColor: theme.colors.surface }}
                    shifting={true}
                    labeled={true}
                />
            </PaperProvider>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    screenTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    screenSubtitle: {
        fontSize: 16,
        textAlign: 'center',
    },
});
