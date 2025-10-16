import React, { useState } from 'react';
import { PaperProvider, MD3LightTheme, MD3DarkTheme, BottomNavigation } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme, View } from 'react-native';
import ChatsTab from './src/tabs/ChatsTab';
import ContactsTab from './src/tabs/ContactsTab';
import SettingsTab from './src/tabs/SettingsTab';

export default function App() {
    const [index, setIndex] = useState(0);
    const colorScheme = useColorScheme();
    
    // Material You theme with automatic dark/light mode
    const theme = colorScheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
    
    const routes = [
        { key: 'chats', title: 'Chats', focusedIcon: 'message-text', unfocusedIcon: 'message-text-outline' },
        { key: 'contacts', title: 'Contacts', focusedIcon: 'account-group', unfocusedIcon: 'account-group-outline' },
        { key: 'settings', title: 'Settings', focusedIcon: 'cog', unfocusedIcon: 'cog-outline' },
    ];

    const renderScene = BottomNavigation.SceneMap({
        chats: ChatsTab,
        contacts: ContactsTab,
        settings: SettingsTab,
    });

    return (
        <SafeAreaProvider>
            <PaperProvider theme={theme}>
                <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
                    <BottomNavigation
                        navigationState={{ index, routes }}
                        onIndexChange={setIndex}
                        renderScene={renderScene}
                        activeColor={theme.colors.primary}
                        inactiveColor={theme.colors.onSurfaceVariant}
                        barStyle={{ backgroundColor: theme.colors.surfaceContainer }}
                        shifting={true}
                        labeled={true}
                    />
                </View>
            </PaperProvider>
        </SafeAreaProvider>
    );
}