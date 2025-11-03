import { MessagePanel } from "./MessagePanel";
import { API_BASE_URL } from "@/core/config";
import { getAuthHeaders } from "@/core/api/authApi";
import { 
    getChannelMessages, sendChannelMessage, deleteChannelMessage, addChannelReaction,
    subscribeToChannel, unsubscribeFromChannel,
    type Channel, type ChannelMessage 
} from "@/core/api/channelsApi";
import type { 
    ChannelNewWebSocketMessage, ChannelMessageDeletedWebSocketMessage, 
    ChannelReactionUpdateWebSocketMessage, ChannelUpdatedWebSocketMessage,
    ChannelSubscribedWebSocketMessage, ChannelUnsubscribedWebSocketMessage,
    Message, WebSocketMessage 
} from "@/core/types";
import type { UserState, ProfileDialogData } from "@/pages/chat/state";

export class ChannelPanel extends MessagePanel {
    private channelId: number;
    private channel: Channel | null = null;
    private messagesLoaded: boolean = false;
    private canSendMessages: boolean = false;

    constructor(
        channelId: number,
        currentUser: UserState
    ) {
        super(`channel-${channelId}`, currentUser);
        this.channelId = channelId;
    }

    isDm(): boolean {
        return false;
    }

    async activate(): Promise<void> {
        await this.loadChannelInfo();
        // Only load messages if subscribed
        if (this.channel?.is_subscribed) {
            await this.loadMessages();
        }
        // Check if user can send (admin only)
        this.canSendMessages = this.channel?.is_admin || false;
    }

    deactivate(): void {
        // Cleanup if needed
    }

    clearMessages(): void {
        super.clearMessages();
        this.messagesLoaded = false;
    }

    private async loadChannelInfo(): Promise<void> {
        if (!this.currentUser.authToken) return;
        try {
            const response = await fetch(`${API_BASE_URL}/channels/${this.channelId}`, {
                headers: getAuthHeaders(this.currentUser.authToken)
            });
            if (response.ok) {
                const data = await response.json();
                this.channel = data.channel;
                this.canSendMessages = this.channel.is_admin || false;
                this.updateState({
                    title: this.channel.name,
                    profilePicture: this.channel.profile_picture || undefined
                });
            }
        } catch (error) {
            console.error("Error loading channel info:", error);
        }
    }

    async loadMessages(): Promise<void> {
        if (!this.currentUser.authToken || this.messagesLoaded) return;
        if (!this.channel?.is_subscribed) return;

        this.setLoading(true);
        try {
            const messages = await getChannelMessages(this.channelId, this.currentUser.authToken);
            this.clearMessages();
            messages.forEach((msg: ChannelMessage) => {
                // Convert ChannelMessage to Message format
                const message: Message = {
                    id: msg.id,
                    user_id: msg.user_id,
                    username: msg.username,
                    content: msg.content,
                    is_read: false,
                    is_edited: msg.is_edited,
                    timestamp: msg.timestamp,
                    profile_picture: msg.profile_picture,
                    verified: msg.verified,
                    reply_to: msg.reply_to ? this.convertChannelMessageToMessage(msg.reply_to) : undefined,
                    files: msg.files,
                    reactions: msg.reactions // Anonymous reactions
                };
                this.addMessage(message);
            });
            this.messagesLoaded = true;
        } catch (error) {
            console.error("Error loading channel messages:", error);
        } finally {
            this.setLoading(false);
        }
    }

    private convertChannelMessageToMessage(cm: ChannelMessage): Message {
        return {
            id: cm.id,
            user_id: cm.user_id,
            username: cm.username,
            content: cm.content,
            is_read: false,
            is_edited: cm.is_edited,
            timestamp: cm.timestamp,
            profile_picture: cm.profile_picture,
            verified: cm.verified,
            reply_to: cm.reply_to ? this.convertChannelMessageToMessage(cm.reply_to) : undefined,
            files: cm.files,
            reactions: cm.reactions // Anonymous - no user info
        };
    }

    protected async sendMessage(content: string, replyToId?: number, files: File[] = []): Promise<void> {
        if (!this.currentUser.authToken || (!content.trim() && files.length === 0)) return;
        if (!this.canSendMessages) {
            throw new Error("Only admins can send messages in channels");
        }

        try {
            const channelMsg = await sendChannelMessage(
                this.channelId,
                { content: content.trim(), reply_to_id: replyToId || null },
                this.currentUser.authToken,
                files
            );
            
            // Convert to Message format and confirm the temp message
            const message: Message = this.convertChannelMessageToMessage(channelMsg);
            const tempMessages = this.getMessages().filter(m => m.id === -1 && m.runtimeData?.sendingState?.tempId);
            for (const tempMsg of tempMessages) {
                if (tempMsg.runtimeData?.sendingState?.retryData?.content === content.trim()) {
                    this.handleMessageConfirmed(tempMsg.runtimeData.sendingState.tempId!, message);
                    return;
                }
            }
            this.addMessage(message);
        } catch (error) {
            console.error("Error sending channel message:", error);
            throw error;
        }
    }

    async handleWebSocketMessage(response: WebSocketMessage<any>): Promise<void> {
        switch (response.type) {
            case 'channelNew':
                const channelNewMsg = response as ChannelNewWebSocketMessage;
                if (channelNewMsg.data?.channel_id === this.channelId && channelNewMsg.data?.message) {
                    const newMsg = this.convertChannelMessageToMessage(channelNewMsg.data.message);
                    // Check if this is a confirmation of our message
                    const isOurMessage = newMsg.user_id === this.currentUser.currentUser?.id;
                    if (isOurMessage) {
                        const tempMessages = this.getMessages().filter(m => m.id === -1 && m.runtimeData?.sendingState?.tempId);
                        for (const tempMsg of tempMessages) {
                            if (tempMsg.runtimeData?.sendingState?.retryData?.content === newMsg.content) {
                                this.handleMessageConfirmed(tempMsg.runtimeData.sendingState.tempId!, newMsg);
                                return;
                            }
                        }
                    }
                    this.addMessage(newMsg);
                }
                break;
            case 'channelMessageDeleted':
                const deletedMsg = response as ChannelMessageDeletedWebSocketMessage;
                if (deletedMsg.data?.channel_id === this.channelId && deletedMsg.data?.message_id) {
                    this.removeMessage(deletedMsg.data.message_id);
                }
                break;
            case 'channelReactionUpdate':
                const reactionUpdate = response as ChannelReactionUpdateWebSocketMessage;
                if (reactionUpdate.data?.channel_id === this.channelId && reactionUpdate.data?.message_id) {
                    // Anonymous reactions - no user info
                    this.updateMessageReactions(reactionUpdate.data.message_id, reactionUpdate.data.reactions);
                }
                break;
            case 'channelUpdated':
                const channelUpdated = response as ChannelUpdatedWebSocketMessage;
                if (channelUpdated.data?.channel_id === this.channelId && channelUpdated.data?.channel) {
                    this.channel = channelUpdated.data.channel;
                    this.canSendMessages = this.channel.is_admin || false;
                    this.updateState({
                        title: this.channel.name,
                        profilePicture: this.channel.profile_picture || undefined
                    });
                }
                break;
            case 'channelSubscribed':
                const subscribed = response as ChannelSubscribedWebSocketMessage;
                if (subscribed.data?.channel_id === this.channelId) {
                    if (this.channel) {
                        this.channel.is_subscribed = subscribed.data.user_id === this.currentUser.currentUser?.id;
                        this.channel.subscriber_count = subscribed.data.subscriber_count;
                    }
                }
                break;
            case 'channelUnsubscribed':
                const unsubscribed = response as ChannelUnsubscribedWebSocketMessage;
                if (unsubscribed.data?.channel_id === this.channelId) {
                    if (this.channel) {
                        this.channel.is_subscribed = false;
                        this.channel.subscriber_count = unsubscribed.data.subscriber_count;
                    }
                }
                break;
        }
    }

    async handleEditMessage(messageId: number, content: string): Promise<void> {
        if (!this.currentUser.authToken) return;
        try {
            const response = await fetch(`${API_BASE_URL}/channels/${this.channelId}/messages/${messageId}`, {
                method: "PUT",
                headers: getAuthHeaders(this.currentUser.authToken, true),
                body: JSON.stringify({ content })
            });
            if (response.ok) {
                const data = await response.json();
                const updatedMsg = this.convertChannelMessageToMessage(data.message);
                this.updateMessage(messageId, updatedMsg);
            }
        } catch (error) {
            console.error("Failed to edit message:", error);
        }
    }

    async handleDeleteMessage(id: number): Promise<void> {
        // Remove message immediately from UI
        this.deleteMessageImmediately(id);

        // Fire and forget server deletion
        try {
            await deleteChannelMessage(this.channelId, id, this.currentUser.authToken!);
        } catch (error) {
            console.error("Failed to delete message:", error);
        }
    }

    async subscribe(): Promise<void> {
        if (!this.currentUser.authToken) return;
        try {
            await subscribeToChannel(this.channelId, this.currentUser.authToken);
            if (this.channel) {
                this.channel.is_subscribed = true;
                this.channel.subscriber_count = (this.channel.subscriber_count || 0) + 1;
            }
            await this.loadMessages();
        } catch (error) {
            console.error("Failed to subscribe:", error);
            throw error;
        }
    }

    async unsubscribe(): Promise<void> {
        if (!this.currentUser.authToken) return;
        try {
            await unsubscribeFromChannel(this.channelId, this.currentUser.authToken);
            if (this.channel) {
                this.channel.is_subscribed = false;
                this.channel.subscriber_count = Math.max(0, (this.channel.subscriber_count || 0) - 1);
            }
            this.clearMessages();
        } catch (error) {
            console.error("Failed to unsubscribe:", error);
            throw error;
        }
    }

    async getProfile(): Promise<ProfileDialogData | null> {
        if (!this.channel) {
            await this.loadChannelInfo();
        }
        if (!this.channel) return null;

        return {
            userId: this.channel.id,
            username: this.channel.username || undefined,
            display_name: this.channel.name,
            bio: this.channel.description || undefined,
            profilePicture: this.channel.profile_picture || undefined,
            isOwnProfile: this.channel.owner_id === this.currentUser.currentUser?.id,
            verified: false
        };
    }

    setAuthToken(authToken: string): void {
        this.currentUser.authToken = authToken;
    }

    getChannelId(): number {
        return this.channelId;
    }

    getChannel(): Channel | null {
        return this.channel;
    }

    canSend(): boolean {
        return this.canSendMessages;
    }

    isSubscribed(): boolean {
        return this.channel?.is_subscribed || false;
    }
}

