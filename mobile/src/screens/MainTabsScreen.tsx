import React, { useState } from 'react';
import { View } from 'react-native';
import { BottomNavigation } from 'react-native-paper';
import ChatsTab from '../tabs/ChatsTab';
import ContactsTab from '../tabs/ContactsTab';
import SettingsTab from '../tabs/SettingsTab';

const ChatsRoute = () => <ChatsTab />;
const ContactsRoute = () => <ContactsTab />;
const SettingsRoute = () => <SettingsTab />;

export default function MainTabsScreen() {
    const [index, setIndex] = useState(0);
    
    const routes = [
        { 
            key: 'chats', 
            title: 'Chats', 
            focusedIcon: 'message-text', 
            unfocusedIcon: 'message-text-outline' 
        },
        { 
            key: 'contacts', 
            title: 'Contacts', 
            focusedIcon: 'account-group', 
            unfocusedIcon: 'account-group-outline' 
        },
        { 
            key: 'settings', 
            title: 'Settings', 
            focusedIcon: 'cog', 
            unfocusedIcon: 'cog-outline' 
        },
    ];

    const renderScene = BottomNavigation.SceneMap({
        chats: ChatsRoute,
        contacts: ContactsRoute,
        settings: SettingsRoute,
    });

    return (
        <View style={{ flex: 1 }}>
            <BottomNavigation
                navigationState={{ index, routes }}
                onIndexChange={setIndex}
                renderScene={renderScene}
                shifting={true}
                labeled={true}
            />
        </View>
    );
}
