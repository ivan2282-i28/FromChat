import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Appbar, TextInput, IconButton, ActivityIndicator } from 'react-native-paper';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { webSocketService } from '../services/websocket';
import { fetchPublicMessages } from '../api/chatApi';
import MessageItem from '../components/MessageItem';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { WebSocketMessage, Message } from '../../../shared/types.d';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'ChatScreen'>;

export default function ChatScreen() {
    const route = useRoute<ChatScreenRouteProp>();
    const { chatType, chatId, chatName } = route.params;
    const { authToken, user } = useAuthStore();
    const { messages, setMessages, addMessage, setCurrentChat, setLoading, isLoading } = useChatStore();
    
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        if (!authToken) return;

        // Set current chat
        setCurrentChat(chatType, chatId);

        // Connect WebSocket if not connected
        if (!webSocketService.isConnected()) {
            webSocketService.connect(authToken).catch(console.error);
        }

        // Set up message handler
        webSocketService.setMessageHandler(handleWebSocketMessage);

        // Fetch initial messages
        loadMessages();

        return () => {
            // Clean up when leaving chat
            webSocketService.setMessageHandler(() => {});
        };
    }, [authToken, chatType, chatId]);

    const loadMessages = async () => {
        if (!authToken) return;

        setLoading(true);
        try {
            if (chatType === 'public') {
                const fetchedMessages = await fetchPublicMessages(authToken);
                setMessages(fetchedMessages);
            }
            // Add other chat types here later (DM, group, etc.)
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleWebSocketMessage = (message: WebSocketMessage<any>) => {
        switch (message.type) {
            case 'newMessage':
                if (message.data) {
                    addMessage(message.data as Message);
                    // Auto-scroll to bottom
                    setTimeout(() => {
                        flatListRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                }
                break;
            case 'messageEdited':
                // Handle message editing
                break;
            case 'messageDeleted':
                // Handle message deletion
                break;
        }
    };

    const handleSendMessage = async () => {
        if (!inputText.trim() || !authToken || sending) return;

        const messageContent = inputText.trim();
        setInputText('');
        setSending(true);

        try {
            if (chatType === 'public') {
                await webSocketService.sendPublicMessage(messageContent, authToken);
            }
            // Add other chat types here later
        } catch (error) {
            console.error('Error sending message:', error);
            // Restore input text on error
            setInputText(messageContent);
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isOwnMessage = item.username === user?.username;
        return <MessageItem message={item} isOwnMessage={isOwnMessage} />;
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Appbar.Header>
                <Appbar.BackAction onPress={() => {}} />
                <Appbar.Content title={chatName} />
            </Appbar.Header>

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id.toString()}
                style={styles.messagesList}
                inverted
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.inputContainer}
            >
                <View style={styles.inputRow}>
                    <TextInput
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Type a message..."
                        mode="outlined"
                        style={styles.textInput}
                        multiline
                        maxLength={1000}
                        disabled={sending}
                    />
                    <IconButton
                        icon="send"
                        mode="contained"
                        onPress={handleSendMessage}
                        disabled={!inputText.trim() || sending}
                        style={styles.sendButton}
                    />
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5'
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    messagesList: {
        flex: 1,
        paddingVertical: 8
    },
    inputContainer: {
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0'
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 8,
        paddingVertical: 8
    },
    textInput: {
        flex: 1,
        marginRight: 8,
        maxHeight: 100
    },
    sendButton: {
        margin: 0
    }
});
