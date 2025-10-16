import React, { useState, useRef, useEffect } from 'react';
import { PaperProvider, MD3LightTheme, MD3DarkTheme, Text, BottomNavigation, useTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, Animated, useColorScheme, View } from 'react-native';

// Animated placeholder screens with theme support
function ChatsScreen() {
    const theme = useTheme();

    return (
        <View style={styles.screen}>
            <Text style={[styles.screenTitle, { color: theme.colors.onSurface }]}>Chats</Text>
            <Text style={[styles.screenSubtitle, { color: theme.colors.onSurfaceVariant }]}>Your conversations will appear here</Text>
        </View>
    );
}

function ContactsScreen() {
    const theme = useTheme();

    return (
        <View style={styles.screen}>
            <Text style={[styles.screenTitle, { color: theme.colors.onSurface }]}>Contacts</Text>
            <Text style={[styles.screenSubtitle, { color: theme.colors.onSurfaceVariant }]}>Your contacts will appear here</Text>
        </View>
    );
}

function SettingsScreen() {
    const theme = useTheme();

    return (
        <View style={styles.screen}>
            <Text style={[styles.screenTitle, { color: theme.colors.onSurface }]}>Settings</Text>
            <Text style={[styles.screenSubtitle, { color: theme.colors.onSurfaceVariant }]}>App settings will appear here</Text>
        </View>
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
