import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Appbar, List, Avatar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type ChatsTabNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

interface ChatItem {
    id: string;
    name: string;
    type: 'public' | 'dm' | 'group';
    lastMessage?: string;
    timestamp?: string;
}

export default function ChatsTab() {
    const navigation = useNavigation<ChatsTabNavigationProp>();

    // For now, we have one hardcoded public chat
    // Later this will be populated from API
    const chats: ChatItem[] = [
        {
            id: 'general',
            name: 'Public Chat',
            type: 'public',
            lastMessage: 'Welcome to the public chat!',
            timestamp: 'Now'
        }
    ];

    const handleChatPress = (chat: ChatItem) => {
        navigation.navigate('ChatScreen', {
            chatType: chat.type,
            chatId: chat.id,
            chatName: chat.name
        });
    };

    const renderChatItem = ({ item }: { item: ChatItem }) => (
        <List.Item
            title={item.name}
            description={item.lastMessage}
            left={(props) => (
                <Avatar.Icon 
                    {...props} 
                    icon="message-text" 
                    size={48}
                />
            )}
            onPress={() => handleChatPress(item)}
            style={styles.chatItem}
        />
    );

    return (
        <View style={styles.container}>
            <Appbar.Header>
                <Appbar.Content title="Chats" />
            </Appbar.Header>
            
            <FlatList
                data={chats}
                renderItem={renderChatItem}
                keyExtractor={(item) => item.id}
                style={styles.list}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5'
    },
    list: {
        flex: 1
    },
    chatItem: {
        backgroundColor: 'white',
        marginHorizontal: 8,
        marginVertical: 4,
        borderRadius: 8,
        elevation: 1
    }
});