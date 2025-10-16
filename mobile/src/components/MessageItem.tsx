import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text, Avatar } from 'react-native-paper';
import type { Message } from '../../../shared/types.d';
import { formatTime } from '../../../shared/utils';

interface MessageItemProps {
    message: Message;
    isOwnMessage: boolean;
}

export default function MessageItem({ message, isOwnMessage }: MessageItemProps) {
    const avatarText = message.username.charAt(0).toUpperCase();
    const timestamp = formatTime(message.timestamp);

    return (
        <View style={[
            styles.container,
            isOwnMessage ? styles.ownMessage : styles.otherMessage
        ]}>
            {!isOwnMessage && (
                <Avatar.Text 
                    size={32} 
                    label={avatarText}
                    style={styles.avatar}
                />
            )}
            
            <View style={[
                styles.messageContainer,
                isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
            ]}>
                {!isOwnMessage && (
                    <Text variant="labelSmall" style={styles.username}>
                        {message.username}
                    </Text>
                )}
                
                <Surface 
                    style={[
                        styles.messageBubble,
                        isOwnMessage ? styles.ownBubble : styles.otherBubble
                    ]}
                    elevation={1}
                >
                    <Text variant="bodyMedium" style={styles.messageText}>
                        {message.content}
                    </Text>
                </Surface>
                
                <Text variant="labelSmall" style={styles.timestamp}>
                    {timestamp}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        marginVertical: 4,
        marginHorizontal: 16,
        alignItems: 'flex-end'
    },
    ownMessage: {
        justifyContent: 'flex-end'
    },
    otherMessage: {
        justifyContent: 'flex-start'
    },
    avatar: {
        marginRight: 8,
        marginBottom: 4
    },
    messageContainer: {
        maxWidth: '70%',
        minWidth: 100
    },
    ownMessageContainer: {
        alignItems: 'flex-end'
    },
    otherMessageContainer: {
        alignItems: 'flex-start'
    },
    username: {
        marginBottom: 2,
        opacity: 0.7,
        marginLeft: 4
    },
    messageBubble: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        marginBottom: 2
    },
    ownBubble: {
        backgroundColor: '#007AFF', // iOS blue
        borderBottomRightRadius: 4
    },
    otherBubble: {
        backgroundColor: '#E5E5EA', // iOS gray
        borderBottomLeftRadius: 4
    },
    messageText: {
        color: 'white'
    },
    timestamp: {
        opacity: 0.6,
        fontSize: 11,
        marginHorizontal: 4
    }
});
