import { MessagePanel } from "./MessagePanel";
import { API_BASE_URL } from "@/core/config";
import { getAuthHeaders } from "@/core/api/authApi";
import { 
    getGroupMessages, sendGroupMessage, deleteGroupMessage
} from "@/core/api/groupsApi";
import type { 
    Group, GroupMessage, GroupNewWebSocketMessage, GroupMessageDeletedWebSocketMessage, 
    GroupReactionUpdateWebSocketMessage, GroupUpdatedWebSocketMessage,
    Message, WebSocketMessage 
} from "@/core/types";
import type { UserState, ProfileDialogData } from "@/pages/chat/state";

export class GroupPanel extends MessagePanel {
    private groupId: number;
    private group: Group | null = null;
    private messagesLoaded: boolean = false;

    constructor(
        groupId: number,
        currentUser: UserState
    ) {
        super(`group-${groupId}`, currentUser);
        this.groupId = groupId;
    }

    isDm(): boolean {
        return false;
    }

    async activate(): Promise<void> {
        await this.loadGroupInfo();
        await this.loadMessages();
    }

    deactivate(): void {
        // Cleanup if needed
    }

    clearMessages(): void {
        super.clearMessages();
        this.messagesLoaded = false;
    }

    private async loadGroupInfo(): Promise<void> {
        if (!this.currentUser.authToken) return;
        try {
            const response = await fetch(`${API_BASE_URL}/groups/${this.groupId}`, {
                headers: getAuthHeaders(this.currentUser.authToken)
            });
            if (response.ok) {
                const data = await response.json();
                this.group = data.group;
                if (this.group) {
                    this.updateState({
                        title: this.group.name,
                        profilePicture: this.group.profile_picture || undefined
                    });
                }
            }
        } catch (error) {
            console.error("Error loading group info:", error);
        }
    }

    async loadMessages(): Promise<void> {
        if (!this.currentUser.authToken || this.messagesLoaded) return;

        this.setLoading(true);
        try {
            const messages = await getGroupMessages(this.groupId, this.currentUser.authToken);
            this.clearMessages();
            messages.forEach((msg: GroupMessage) => {
                // Convert GroupMessage to Message format
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
                    reply_to: msg.reply_to ? this.convertGroupMessageToMessage(msg.reply_to) : undefined,
                    files: msg.files,
                    reactions: msg.reactions
                };
                this.addMessage(message);
            });
            this.messagesLoaded = true;
        } catch (error) {
            console.error("Error loading group messages:", error);
        } finally {
            this.setLoading(false);
        }
    }

    private convertGroupMessageToMessage(gm: GroupMessage): Message {
        return {
            id: gm.id,
            user_id: gm.user_id,
            username: gm.username,
            content: gm.content,
            is_read: false,
            is_edited: gm.is_edited,
            timestamp: gm.timestamp,
            profile_picture: gm.profile_picture,
            verified: gm.verified,
            reply_to: gm.reply_to ? this.convertGroupMessageToMessage(gm.reply_to) : undefined,
            files: gm.files,
            reactions: gm.reactions
        };
    }

    protected async sendMessage(content: string, replyToId?: number, files: File[] = []): Promise<void> {
        if (!this.currentUser.authToken || (!content.trim() && files.length === 0)) return;

        try {
            const groupMsg = await sendGroupMessage(
                this.groupId,
                { content: content.trim(), reply_to_id: replyToId || null },
                this.currentUser.authToken,
                files
            );
            
            // Convert to Message format and confirm the temp message
            const message: Message = this.convertGroupMessageToMessage(groupMsg);
            const tempMessages = this.getMessages().filter(m => m.id === -1 && m.runtimeData?.sendingState?.tempId);
            for (const tempMsg of tempMessages) {
                if (tempMsg.runtimeData?.sendingState?.retryData?.content === content.trim()) {
                    this.handleMessageConfirmed(tempMsg.runtimeData.sendingState.tempId!, message);
                    return;
                }
            }
            this.addMessage(message);
        } catch (error) {
            console.error("Error sending group message:", error);
            throw error;
        }
    }

    async handleWebSocketMessage(response: WebSocketMessage<any>): Promise<void> {
        switch (response.type) {
            case 'groupNew':
                const groupNewMsg = response as GroupNewWebSocketMessage;
                if (groupNewMsg.data?.group_id === this.groupId && groupNewMsg.data?.message) {
                    const newMsg = this.convertGroupMessageToMessage(groupNewMsg.data.message);
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
            case 'groupMessageDeleted':
                const deletedMsg = response as GroupMessageDeletedWebSocketMessage;
                if (deletedMsg.data?.group_id === this.groupId && deletedMsg.data?.message_id) {
                    this.removeMessage(deletedMsg.data.message_id);
                }
                break;
            case 'groupReactionUpdate':
                const reactionUpdate = response as GroupReactionUpdateWebSocketMessage;
                if (reactionUpdate.data?.group_id === this.groupId && reactionUpdate.data?.message_id) {
                    this.updateMessageReactions(reactionUpdate.data.message_id, reactionUpdate.data.reactions);
                }
                break;
            case 'groupUpdated':
                const groupUpdated = response as GroupUpdatedWebSocketMessage;
                if (groupUpdated.data?.group_id === this.groupId && groupUpdated.data?.group) {
                    this.group = groupUpdated.data.group;
                    this.updateState({
                        title: this.group.name,
                        profilePicture: this.group.profile_picture || undefined
                    });
                }
                break;
        }
    }

    async handleEditMessage(messageId: number, content: string): Promise<void> {
        if (!this.currentUser.authToken) return;
        try {
            // Group messages use same edit endpoint pattern
            const response = await fetch(`${API_BASE_URL}/groups/${this.groupId}/messages/${messageId}`, {
                method: "PUT",
                headers: getAuthHeaders(this.currentUser.authToken, true),
                body: JSON.stringify({ content })
            });
            if (response.ok) {
                const data = await response.json();
                const updatedMsg = this.convertGroupMessageToMessage(data.message);
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
            await deleteGroupMessage(this.groupId, id, this.currentUser.authToken!);
        } catch (error) {
            console.error("Failed to delete message:", error);
        }
    }

    async getProfile(): Promise<ProfileDialogData | null> {
        if (!this.group) {
            await this.loadGroupInfo();
        }
        if (!this.group) return null;

        return {
            userId: this.group.id,
            username: this.group.username || undefined,
            display_name: this.group.name,
            bio: this.group.description || undefined,
            profilePicture: this.group.profile_picture || undefined,
            isOwnProfile: this.group.owner_id === this.currentUser.currentUser?.id,
            verified: false
        };
    }

    setAuthToken(authToken: string): void {
        this.currentUser.authToken = authToken;
    }

    getGroupId(): number {
        return this.groupId;
    }

    getGroup(): Group | null {
        return this.group;
    }
}

