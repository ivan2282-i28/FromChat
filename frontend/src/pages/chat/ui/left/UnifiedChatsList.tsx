import { useState, useEffect, useCallback } from "react";
import { useAppState } from "@/pages/chat/state";
import { useDM, type DMUser } from "@/pages/chat/hooks/useDM";
import { fetchUserPublicKey } from "@/core/api/dmApi";
import { StatusBadge } from "@/core/components/StatusBadge";
import type { Group, Channel, GroupMessage, ChannelMessage } from "@/core/types";
import { websocket } from "@/core/websocket";
import { onlineStatusManager } from "@/core/onlineStatusManager";
import { OnlineIndicator } from "@/pages/chat/ui/right/OnlineIndicator";
import defaultAvatar from "@/images/default-avatar.png";
import { MaterialBadge, MaterialCircularProgress, MaterialList, MaterialListItem } from "@/utils/material";
import styles from "@/pages/chat/css/left-panel.module.scss";

interface GroupChat {
    id: number;
    name: string;
    type: "group";
    lastMessage?: GroupMessage;
    profile_picture?: string;
    member_count: number;
}

interface ChannelChat {
    id: number;
    name: string;
    type: "channel";
    lastMessage?: ChannelMessage;
    profile_picture?: string;
    subscriber_count: number;
}

interface DMConversation {
    id: number;
    userId: number;
    username: string;
    display_name: string;
    profile_picture?: string;
    online?: boolean;
    type: "dm";
    lastMessage?: string;
    unreadCount: number;
    publicKey?: string | null;
    verified?: boolean;
}

type ChatItem = GroupChat | ChannelChat | DMConversation;

export function UnifiedChatsList() {
    const { user, switchToGroup, switchToChannel, switchToDM, chat } = useAppState();
    const { dmUsers, isLoadingUsers, loadUsers } = useDM();

    const [groupLastMessages, setGroupLastMessages] = useState<Record<number, GroupMessage | undefined>>({});
    const [channelLastMessages, setChannelLastMessages] = useState<Record<number, ChannelMessage | undefined>>({});
    const [allChats, setAllChats] = useState<ChatItem[]>([]);

    // Load last messages for groups and channels
    const loadLastMessages = useCallback(async () => {
        if (!user.authToken) return;

        try {
            // Load last messages for all joined groups
            for (const group of chat.joinedGroups) {
                try {
                    const { getGroupMessages } = await import("@/core/api/groupsApi");
                    const messages = await getGroupMessages(group.id, user.authToken);
                    if (messages.length > 0) {
                        setGroupLastMessages(prev => ({
                            ...prev,
                            [group.id]: messages[messages.length - 1]
                        }));
                    }
                } catch (error) {
                    console.error(`Error loading messages for group ${group.id}:`, error);
                }
            }

            // Load last messages for all subscribed channels
            for (const channel of chat.subscribedChannels) {
                try {
                    const { getChannelMessages } = await import("@/core/api/channelsApi");
                    const messages = await getChannelMessages(channel.id, user.authToken);
                    if (messages.length > 0) {
                        setChannelLastMessages(prev => ({
                            ...prev,
                            [channel.id]: messages[messages.length - 1]
                        }));
                    }
                } catch (error) {
                    console.error(`Error loading messages for channel ${channel.id}:`, error);
                }
            }
        } catch (error) {
            console.error("Error loading last messages:", error);
        }
    }, [user.authToken, chat.joinedGroups, chat.subscribedChannels]);

    // Load DM users when chats tab is active
    useEffect(() => {
        if (chat.activeTab === "chats") {
            loadUsers();
            loadLastMessages();
        }
    }, [chat.activeTab, loadUsers, loadLastMessages]);

    // Combine groups, channels, and DMs into one list
    useEffect(() => {
        const groupItems: ChatItem[] = chat.joinedGroups.map((group: Group) => ({
            id: group.id,
            name: group.name,
            type: "group" as const,
            lastMessage: groupLastMessages[group.id],
            profile_picture: group.profile_picture || undefined,
            member_count: group.member_count
        }));

        const channelItems: ChatItem[] = chat.subscribedChannels.map((channel: Channel) => ({
            id: channel.id,
            name: channel.name,
            type: "channel" as const,
            lastMessage: channelLastMessages[channel.id],
            profile_picture: channel.profile_picture || undefined,
            subscriber_count: channel.subscriber_count
        }));

        const dmChatItems: ChatItem[] = dmUsers.map((user: DMUser) => ({
            id: user.id,
            userId: user.id,
            username: user.username,
            display_name: user.display_name,
            profile_picture: user.profile_picture,
            online: user.online,
            type: "dm" as const,
            lastMessage: user.lastMessage,
            unreadCount: user.unreadCount,
            publicKey: user.publicKey
        }));

        // Combine and sort by last message timestamp
        const combined = [...dmChatItems, ...groupItems, ...channelItems];
        setAllChats(combined);
    }, [chat.joinedGroups, chat.subscribedChannels, groupLastMessages, channelLastMessages, dmUsers]);

    // WebSocket listener for group and channel message updates
    useEffect(() => {
        if (!websocket) return;

        const handleWebSocketMessage = (e: MessageEvent) => {
            try {
                const msg = JSON.parse(e.data);

                if (msg.type === "groupNew") {
                    const groupMsg = msg.data as { group_id: number; message: GroupMessage };
                    if (chat.joinedGroups.some(g => g.id === groupMsg.group_id)) {
                        setGroupLastMessages(prev => ({
                            ...prev,
                            [groupMsg.group_id]: groupMsg.message
                        }));
                    }
                } else if (msg.type === "channelNew") {
                    const channelMsg = msg.data as { channel_id: number; message: ChannelMessage };
                    if (chat.subscribedChannels.some(c => c.id === channelMsg.channel_id)) {
                        setChannelLastMessages(prev => ({
                            ...prev,
                            [channelMsg.channel_id]: channelMsg.message
                        }));
                    }
                } else if (msg.type === "groupMessageDeleted" || msg.type === "channelMessageDeleted") {
                    const deletedData = msg.data as { group_id?: number; channel_id?: number; message_id: number };
                    if (deletedData.group_id) {
                        setGroupLastMessages(prev => {
                            if (prev[deletedData.group_id!]?.id === deletedData.message_id) {
                                loadLastMessages();
                            }
                            return prev;
                        });
                    } else if (deletedData.channel_id) {
                        setChannelLastMessages(prev => {
                            if (prev[deletedData.channel_id!]?.id === deletedData.message_id) {
                                loadLastMessages();
                            }
                            return prev;
                        });
                    }
                }
            } catch (error) {
                console.error("Failed to handle WebSocket message in UnifiedChatsList:", error);
            }
        };

        websocket.addEventListener("message", handleWebSocketMessage);
        return () => websocket.removeEventListener("message", handleWebSocketMessage);
    }, [chat.joinedGroups, chat.subscribedChannels, loadLastMessages]);

    // Subscribe to online status for all DM users
    useEffect(() => {
        const dmUsers = allChats.filter(chat => chat.type === "dm") as DMConversation[];

        // Subscribe to all DM users
        dmUsers.forEach(dmUser => {
            onlineStatusManager.subscribe(dmUser.id);
        });

        // Cleanup function to unsubscribe from all users
        return () => {
            dmUsers.forEach(dmUser => {
                onlineStatusManager.unsubscribe(dmUser.id);
            });
        };
    }, [allChats]);

    function formatGroupMessage(groupId: number): string {
        const lastMessage = groupLastMessages[groupId];
        if (!lastMessage) {
            return "";
        }

        const isCurrentUser = lastMessage.user_id === user.currentUser?.id;
        const prefix = isCurrentUser ? "Вы: " : `${lastMessage.username}: `;

        const maxContentLength = 50 - prefix.length;
        const content = lastMessage.content.length > maxContentLength
            ? lastMessage.content.substring(0, maxContentLength) + "..."
            : lastMessage.content;

        return prefix + content;
    }

    function formatChannelMessage(channelId: number): string {
        const lastMessage = channelLastMessages[channelId];
        if (!lastMessage) {
            return "";
        }

        const isCurrentUser = lastMessage.user_id === user.currentUser?.id;
        const prefix = isCurrentUser ? "Вы: " : `${lastMessage.username}: `;

        const maxContentLength = 50 - prefix.length;
        const content = lastMessage.content.length > maxContentLength
            ? lastMessage.content.substring(0, maxContentLength) + "..."
            : lastMessage.content;

        return prefix + content;
    }

    async function handleGroupClick(groupId: number) {
        await switchToGroup(groupId);
    }

    async function handleChannelClick(channelId: number) {
        await switchToChannel(channelId);
    }

    async function handleDMClick(dmConversation: DMConversation) {
        if (!dmConversation.publicKey) {
            const authToken = useAppState.getState().user.authToken;
            if (!authToken) return;

            const publicKey = await fetchUserPublicKey(dmConversation.id, authToken);
            if (publicKey) {
                dmConversation.publicKey = publicKey;
            } else {
                console.error("Failed to get public key for user:", dmConversation.id);
                return;
            }
        }

        await switchToDM({
            userId: dmConversation.id,
            username: dmConversation.username,
            publicKey: dmConversation.publicKey,
            profilePicture: dmConversation.profile_picture,
            online: dmConversation.online || false
        });
    }

    if (isLoadingUsers) {
        return <MaterialCircularProgress />;
    }

    return (
        <MaterialList>
            {allChats.map((chatItem) => {
                if (chatItem.type === "group") {
                    return (
                        <MaterialListItem
                            key={`group-${chatItem.id}`}
                            headline={chatItem.name}
                            onClick={() => handleGroupClick(chatItem.id)}
                            style={{ cursor: "pointer" }}
                        >
                            {formatGroupMessage(chatItem.id) && (
                                <span slot="description" className={styles.listDescription}>
                                    {formatGroupMessage(chatItem.id)}
                                </span>
                            )}
                            <img
                                src={chatItem.profile_picture || defaultAvatar}
                                alt={chatItem.name}
                                slot="icon"
                                style={{
                                    width: "40px",
                                    height: "40px",
                                    borderRadius: "50%",
                                    objectFit: "cover"
                                }}
                                onError={(e) => {
                                    e.target.src = defaultAvatar;
                                }}
                            />
                        </MaterialListItem>
                    );
                } else if (chatItem.type === "channel") {
                    return (
                        <MaterialListItem
                            key={`channel-${chatItem.id}`}
                            headline={chatItem.name}
                            onClick={() => handleChannelClick(chatItem.id)}
                            style={{ cursor: "pointer" }}
                        >
                            {formatChannelMessage(chatItem.id) && (
                                <span slot="description" className={styles.listDescription}>
                                    {formatChannelMessage(chatItem.id)}
                                </span>
                            )}
                            <img
                                src={chatItem.profile_picture || defaultAvatar}
                                alt={chatItem.name}
                                slot="icon"
                                style={{
                                    width: "40px",
                                    height: "40px",
                                    borderRadius: "50%",
                                    objectFit: "cover"
                                }}
                                onError={(e) => {
                                    e.target.src = defaultAvatar;
                                }}
                            />
                        </MaterialListItem>
                    );
                } else {
                    return (
                        <MaterialListItem
                            key={`dm-${chatItem.id}`}
                            headline={chatItem.display_name}
                            onClick={() => handleDMClick(chatItem)}
                            style={{ cursor: "pointer" }}
                        >
                            <div slot="headline" className="dm-list-headline">
                                {chatItem.display_name}
                                <StatusBadge 
                                    verified={chatItem.verified || false}
                                    userId={chatItem.userId}
                                    size="small"
                                />
                            </div>
                            <span slot="description" className={styles.listDescription}>
                                {chatItem.lastMessage || "Нет сообщений"}
                            </span>
                            <div slot="icon" style={{ position: "relative", width: "40px", height: "40px", display: "inline-block" }}>
                                <img
                                    src={chatItem.profile_picture || defaultAvatar}
                                    alt={chatItem.display_name}
                                    style={{
                                        width: "40px",
                                        height: "40px",
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                        display: "block"
                                    }}
                                    onError={(e) => {
                                        e.target.src = defaultAvatar;
                                    }}
                                />
                                <OnlineIndicator userId={chatItem.id} />
                            </div>
                            {chatItem.unreadCount > 0 && (
                                <MaterialBadge slot="end-icon">
                                    {chatItem.unreadCount}
                                </MaterialBadge>
                            )}
                        </MaterialListItem>
                    );
                }
            })}
        </MaterialList>
    );
}
