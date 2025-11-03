import { create } from "zustand";
import type { Message, User, Group, Channel } from "@/core/types";
import { request } from "@/core/websocket";
import { MessagePanel } from "./ui/right/panels/MessagePanel";
import { DMPanel, type DMPanelData } from "./ui/right/panels/DMPanel";
import { getAuthHeaders } from "@/core/api/authApi";
import { restoreKeys } from "@/core/api/authApi";
import { API_BASE_URL } from "@/core/config";
import { initialize, subscribe, startElectronReceiver, isSupported } from "@/core/push-notifications/push-notifications";
import { isElectron } from "@/core/electron/electron";
import { onlineStatusManager } from "@/core/onlineStatusManager";
import { typingManager } from "@/core/typingManager";

export type ChatTabs = "chats" | "channels" | "contacts";

export type CallStatus = "calling" | "connecting" | "active" | "ended";

export interface ProfileDialogData {
    userId?: number;
    username?: string;
    display_name?: string;
    profilePicture?: string;
    bio?: string;
    memberSince?: string;
    online?: boolean;
    isOwnProfile: boolean;
    verified?: boolean;
    suspended?: boolean;
    suspension_reason?: string | null;
    deleted?: boolean;
}

interface ActiveDM {
    userId: number;
    username: string;
    publicKey: string | null
}

interface CallState {
    isActive: boolean;
    status: CallStatus;
    startTime: number | null;
    isMuted: boolean;
    remoteUserId: number | null;
    remoteUsername: string | null;
    isInitiator: boolean;
    isMinimized: boolean;
    sessionKeyHash: string | null;
    encryptionEmojis: string[];
    isVideoEnabled: boolean;
    isRemoteVideoEnabled: boolean;
    isSharingScreen: boolean;
    isRemoteScreenSharing: boolean;
}

interface ChatState {
    messages: Message[];
    currentChat: string;
    activeTab: ChatTabs;
    dmUsers: User[];
    activeDm: ActiveDM | null;
    isSwitching: boolean;
    setIsSwitching: (value: boolean) => void;
    activePanel: MessagePanel | null;
    dmPanel: DMPanel | null;
    groupPanel: MessagePanel | null; // GroupPanel will extend MessagePanel
    channelPanel: MessagePanel | null; // ChannelPanel will extend MessagePanel
    pendingPanel?: MessagePanel | null;
    joinedGroups: Group[];
    subscribedChannels: Channel[];
    call: CallState;
    profileDialog: ProfileDialogData | null;
    onlineStatuses: Map<number, {online: boolean, lastSeen: string}>;
    typingUsers: Map<number, string>; // userId -> username
    dmTypingUsers: Map<number, boolean>;
}

export interface UserState {
    currentUser: User | null;
    authToken: string | null;
    isSuspended: boolean;
    suspensionReason: string | null;
}

interface AppState {
    // Chat state
    chat: ChatState;
    addMessage: (message: Message) => void;
    updateMessage: (messageId: number, updatedMessage: Partial<Message>) => void;
    removeMessage: (messageId: number) => void;
    setCurrentChat: (chat: string) => void;
    setActiveTab: (tab: ChatState["activeTab"]) => void;
    setDmUsers: (users: User[]) => void;
    setActiveDm: (dm: ChatState["activeDm"]) => void;
    clearMessages: () => void;
    setActivePanel: (panel: MessagePanel | null) => void;
    setPendingPanel: (panel: MessagePanel | null) => void;
    applyPendingPanel: () => void;
    switchToGroup: (groupId: number) => Promise<void>;
    switchToChannel: (channelId: number) => Promise<void>;
    switchToDM: (dmData: DMPanelData) => Promise<void>;
    setJoinedGroups: (groups: Group[]) => void;
    setSubscribedChannels: (channels: Channel[]) => void;

    // Call state
    startCall: (userId: number, username: string) => void;
    endCall: () => void;
    setCallStatus: (status: CallStatus) => void;
    toggleMute: () => void;
    toggleCallMinimize: () => void;
    receiveCall: (userId: number, username: string) => void;
    setCallEncryption: (sessionKeyHash: string, encryptionEmojis: string[]) => void;
    setCallSessionKeyHash: (sessionKeyHash: string) => void;
    toggleVideo: () => void;
    toggleScreenShare: () => void;
    setRemoteVideoEnabled: (enabled: boolean) => void;
    setRemoteScreenSharing: (enabled: boolean) => void;
    toggleCallMinimized: () => void;

    // User state
    user: UserState;
    setUser: (token: string, user: User) => void;
    logout: () => void;
    restoreUserFromStorage: () => Promise<void>;
    setSuspended: (reason: string) => void;

    // Profile dialog state
    setProfileDialog: (data: ProfileDialogData | null) => void;
    closeProfileDialog: () => void;

    // Online status and typing state
    updateOnlineStatus: (userId: number, online: boolean, lastSeen: string) => void;
    addTypingUser: (userId: number, username: string) => void;
    removeTypingUser: (userId: number) => void;
    setDmTypingUser: (userId: number, isTyping: boolean) => void;
}

export const useAppState = create<AppState>((set, get) => ({
    // Chat state
    chat: {
        messages: [],
        currentChat: "Общий чат",
        activeTab: "chats",
        dmUsers: [],
        activeDm: null,
        isSwitching: false,
        setIsSwitching: (value: boolean) => set((state) => ({
            chat: {
                ...state.chat,
                isSwitching: value
            }
        })),
        activePanel: null,
        dmPanel: null,
        groupPanel: null,
        channelPanel: null,
        pendingPanel: null,
        joinedGroups: [],
        subscribedChannels: [],
        profileDialog: null,
        call: {
            isActive: false,
            status: "ended",
            startTime: null,
            isMuted: false,
            remoteUserId: null,
            remoteUsername: null,
            isInitiator: false,
            isMinimized: false,
            sessionKeyHash: null,
            encryptionEmojis: [],
            isVideoEnabled: false,
            isRemoteVideoEnabled: false,
            isSharingScreen: false,
            isRemoteScreenSharing: false
        },
        onlineStatuses: new Map(),
        typingUsers: new Map(),
        dmTypingUsers: new Map()
    },
    addMessage: (message: Message) => set((state) => {
        // Check if message already exists to prevent duplicates
        const messageExists = state.chat.messages.some(msg => msg.id === message.id);
        if (messageExists) {
            return state; // Return unchanged state if message already exists
        }

        return {
            chat: {
                ...state.chat,
                messages: [...state.chat.messages, message]
            }
        };
    }),
    updateMessage: (messageId: number, updatedMessage: Partial<Message>) => set((state) => ({
        chat: {
            ...state.chat,
            messages: state.chat.messages.map(msg =>
                msg.id === messageId ? { ...msg, ...updatedMessage } : msg
            )
        }
    })),
    removeMessage: (messageId: number) => set((state) => ({
        chat: {
            ...state.chat,
            messages: state.chat.messages.filter(msg => msg.id !== messageId)
        }
    })),
    clearMessages: () => set((state) => ({
        chat: {
            ...state.chat,
            messages: []
        }
    })),
    setCurrentChat: (chat: string) => set((state) => ({
        chat: {
            ...state.chat,
            currentChat: chat
        }
    })),
    setActiveTab: (tab: ChatState["activeTab"]) => set((state) => ({
        chat: {
            ...state.chat,
            activeTab: tab
        }
    })),
    setDmUsers: (users: User[]) => set((state) => ({
        chat: {
            ...state.chat,
            dmUsers: users
        }
    })),
    setActiveDm: (dm: ChatState["activeDm"]) => set((state) => ({
        chat: {
            ...state.chat,
            activeDm: dm
        }
    })),

    // User state
    user: {
        currentUser: null,
        authToken: null,
        isSuspended: false,
        suspensionReason: null
    },
    setUser: async (token: string, user: User) => {
        set(() => ({
            user: {
                currentUser: user,
                authToken: token,
                isSuspended: user.suspended || false,
                suspensionReason: user.suspension_reason || null
            }
        }));

        // Initialize managers with auth token
        onlineStatusManager.setAuthToken(token);
        typingManager.setAuthToken(token);

        // Store credentials in localStorage
        try {
            localStorage.setItem('authToken', token);
            localStorage.setItem('currentUser', JSON.stringify(user));
        } catch (error) {
            console.error('Failed to store credentials in localStorage:', error);
        }

        try {
            request({
                type: "ping",
                credentials: {
                    scheme: "Bearer",
                    credentials: token
                },
                data: {}
            })
        } catch {}

        // Load joined groups and subscribed channels
        try {
            const { getMyGroups } = await import("@/core/api/groupsApi");
            const { getMyChannels } = await import("@/core/api/channelsApi");
            const { setJoinedGroups, setSubscribedChannels } = get();
            
            const joinedGroups = await getMyGroups(token);
            setJoinedGroups(joinedGroups);
            
            const subscribedChannels = await getMyChannels(token);
            setSubscribedChannels(subscribedChannels);
        } catch (e) {
            console.error("Failed to load groups/channels:", e);
        }
    },
    logout: () => {
        // Clear localStorage
        try {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
        } catch (error) {
            console.error('Failed to clear localStorage:', error);
        }

        // Cleanup managers
        onlineStatusManager.setAuthToken(null);
        typingManager.setAuthToken(null);
        onlineStatusManager.cleanup();
        typingManager.cleanup();

        set(() => ({
            user: {
                currentUser: null,
                authToken: null,
                isSuspended: false,
                suspensionReason: null
            }
        }));
    },
    restoreUserFromStorage: async () => {
        try {
            const token = localStorage.getItem('authToken');

            if (token) {
                const response = await fetch(`${API_BASE_URL}/user/profile`, {
                    headers: getAuthHeaders(token)
                });

                if (response.ok) {
                    const user: User = await response.json();
                    restoreKeys();

                    // Check if user is suspended
                    if (user.suspended) {
                        set(() => ({
                            user: {
                                currentUser: user,
                                authToken: token,
                                isSuspended: true,
                                suspensionReason: user.suspension_reason || null
                            }
                        }));
                        return; // Don't initialize managers or notifications for suspended users
                    }

                    set(() => ({
                        user: {
                            currentUser: user,
                            authToken: token,
                            isSuspended: false,
                            suspensionReason: null
                        }
                    }));

                    // Initialize managers with auth token
                    onlineStatusManager.setAuthToken(token);
                    typingManager.setAuthToken(token);

                    try {
                        request({
                            type: "ping",
                            credentials: {
                                scheme: "Bearer",
                                credentials: token
                            },
                            data: {}
                        })
                    } catch {}

                    // Initialize notifications after successful credential restoration
                    try {
                        if (isSupported()) {
                            const initialized = await initialize();
                            if (initialized) {
                                await subscribe(token);

                                // For Electron, start the notification receiver
                                if (isElectron) {
                                    await startElectronReceiver();
                                }
                            }
                        }
                    } catch (e) {
                        console.error("Notification setup failed (restored):", e);
                    }

                    // Load joined groups and subscribed channels
                    try {
                        const { getMyGroups } = await import("@/core/api/groupsApi");
                        const { getMyChannels } = await import("@/core/api/channelsApi");
                        const { setJoinedGroups, setSubscribedChannels } = get();
                        
                        const joinedGroups = await getMyGroups(token);
                        setJoinedGroups(joinedGroups);
                        
                        const subscribedChannels = await getMyChannels(token);
                        setSubscribedChannels(subscribedChannels);
                    } catch (e) {
                        console.error("Failed to load groups/channels:", e);
                    }
                } else {
                    throw new Error("Unable to authenticate");
                }
            }
        } catch (error) {
            console.error('Failed to restore user from localStorage:', error);
            // Clear invalid data
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
        }
    },

    // Panel management
    setActivePanel: (panel: MessagePanel | null) => {
        const state = get();
        // Deactivate the current panel before switching
        if (state.chat.activePanel && state.chat.activePanel !== panel) {
            state.chat.activePanel.deactivate();
        }
        return set((state) => ({
            chat: {
                ...state.chat,
                activePanel: panel
            }
        }));
    },
    // Stash a panel to be applied after switch-out animation ends
    setPendingPanel: (panel: MessagePanel | null) => set((state) => ({
        chat: {
            ...state.chat,
            pendingPanel: panel
        }
    })),
    // Apply pending panel atomically and update related fields
    applyPendingPanel: () => {
        const state = get();
        // Deactivate the current panel before switching
        if (state.chat.activePanel) {
            state.chat.activePanel.deactivate();
        }
        const pendingPanel = state.chat.pendingPanel;
        return set((state) => ({
            chat: {
                ...state.chat,
                activePanel: pendingPanel || state.chat.activePanel,
                dmPanel: (pendingPanel instanceof DMPanel) ? (pendingPanel as DMPanel) : state.chat.dmPanel,
                groupPanel: pendingPanel && pendingPanel.getId().startsWith("group-") ? pendingPanel : state.chat.groupPanel,
                channelPanel: pendingPanel && pendingPanel.getId().startsWith("channel-") ? pendingPanel : state.chat.channelPanel,
                // update currentChat from panel title if available
                currentChat: pendingPanel ? pendingPanel.getState().title || state.chat.currentChat : state.chat.currentChat,
                pendingPanel: null
            }
        }));
    },

    switchToGroup: async (groupId: number) => {
        const { user, chat } = get();

        if (!user.authToken) return;

        // Start chat switching animation
        chat.setIsSwitching(true);

        // Import GroupPanel dynamically to avoid circular dependencies
        const { GroupPanel } = await import("./ui/right/panels/GroupPanel");

        // Create or get group panel
        let groupPanel = chat.groupPanel;
        if (!groupPanel || groupPanel.getId() !== `group-${groupId}`) {
            groupPanel = new GroupPanel(groupId, user);
          } else {
              groupPanel.setAuthToken(user.authToken);
              groupPanel.clearMessagesPublic();
          }

        // Activate panel
        await groupPanel.activate();

        // Defer panel swap until animation switch-out completes
        set((state) => ({
            chat: {
                ...state.chat,
                pendingPanel: groupPanel,
                groupPanel: groupPanel,
                activeTab: "chats"
            }
        }));
    },

    switchToChannel: async (channelId: number) => {
        const { user, chat } = get();

        if (!user.authToken) return;

        // Start chat switching animation
        chat.setIsSwitching(true);

        // Import ChannelPanel dynamically to avoid circular dependencies
        const { ChannelPanel } = await import("./ui/right/panels/ChannelPanel");

        // Create or get channel panel
        let channelPanel = chat.channelPanel;
        if (!channelPanel || channelPanel.getId() !== `channel-${channelId}`) {
            channelPanel = new ChannelPanel(channelId, user);
          } else {
              channelPanel.setAuthToken(user.authToken);
              channelPanel.clearMessagesPublic();
          }

        // Activate panel
        await channelPanel.activate();

        // Defer panel swap until animation switch-out completes
        set((state) => ({
            chat: {
                ...state.chat,
                pendingPanel: channelPanel,
                channelPanel: channelPanel,
                activeTab: "chats"
            }
        }));
    },

    setJoinedGroups: (groups: Group[]) => set((state) => ({
        chat: {
            ...state.chat,
            joinedGroups: groups
        }
    })),

    setSubscribedChannels: (channels: Channel[]) => set((state) => ({
        chat: {
            ...state.chat,
            subscribedChannels: channels
        }
    })),

    switchToDM: async (dmData: DMPanelData) => {
        const { user, chat } = get();

        if (!user.authToken) return;

        // Start chat switching animation
        chat.setIsSwitching(true);

        // Create or get DM panel
        let dmPanel = chat.dmPanel;
        if (!dmPanel) {
            dmPanel = new DMPanel(user);
        } else {
            dmPanel.setAuthToken(user.authToken);
            // Reset messages for the new DM
            dmPanel.clearMessages();
        }

        // Set DM data
        dmPanel.setDMData(dmData);

        // Activate panel
        await dmPanel.activate();

        // Defer panel swap until animation switch-out completes
        set((state) => ({
            chat: {
                ...state.chat,
                pendingPanel: dmPanel,
                activeDm: {
                    userId: dmData.userId,
                    username: dmData.username,
                    publicKey: dmData.publicKey
                },
                activeTab: "chats"
            }
        }));

        // Let MessagePanelRenderer handle the animation timing completely
        // It will set isChatSwitching to false when the fadeInDown animation completes
    },

    // Call state management
    startCall: (userId: number, username: string) => set((state) => ({
        chat: {
            ...state.chat,
            call: {
                isActive: true,
                status: "calling",
                startTime: null,
                isMuted: false,
                remoteUserId: userId,
                remoteUsername: username,
                isInitiator: true,
                isMinimized: false,
                sessionKeyHash: null,
                encryptionEmojis: [],
                isVideoEnabled: false,
                isRemoteVideoEnabled: false,
                isSharingScreen: false,
                isRemoteScreenSharing: false
            }
        }
    })),

    endCall: () => set((state) => ({
        chat: {
            ...state.chat,
            call: {
                isActive: false,
                status: "ended",
                startTime: null,
                isMuted: false,
                remoteUserId: null,
                remoteUsername: null,
                isInitiator: false,
                isMinimized: false,
                sessionKeyHash: null,
                encryptionEmojis: [],
                isVideoEnabled: false,
                isRemoteVideoEnabled: false,
                isSharingScreen: false,
                isRemoteScreenSharing: false
            }
        }
    })),

    setCallStatus: (status: CallStatus) => set((state) => ({
        chat: {
            ...state.chat,
            call: {
                ...state.chat.call,
                status,
                startTime: status === "active" && !state.chat.call.startTime ? Date.now() : state.chat.call.startTime
            }
        }
    })),

    toggleMute: () => set((state) => ({
        chat: {
            ...state.chat,
            call: {
                ...state.chat.call,
                isMuted: !state.chat.call.isMuted
            }
        }
    })),

    toggleCallMinimize: () => set((state) => ({
        chat: {
            ...state.chat,
            call: {
                ...state.chat.call,
                isMinimized: !state.chat.call.isMinimized
            }
        }
    })),

    receiveCall: (userId: number, username: string) => set((state) => ({
        chat: {
            ...state.chat,
            call: {
                isActive: true,
                status: "calling",
                startTime: null,
                isMuted: false,
                remoteUserId: userId,
                remoteUsername: username,
                isInitiator: false,
                isMinimized: false,
                sessionKeyHash: null,
                encryptionEmojis: [],
                isVideoEnabled: false,
                isRemoteVideoEnabled: false,
                isSharingScreen: false,
                isRemoteScreenSharing: false
            }
        }
    })),

    setCallEncryption: (sessionKeyHash: string, encryptionEmojis: string[]) => set((state) => ({
        chat: {
            ...state.chat,
            call: {
                ...state.chat.call,
                sessionKeyHash,
                encryptionEmojis
            }
        }
    })),

    setCallSessionKeyHash: (sessionKeyHash: string) => set((state) => ({
        chat: {
            ...state.chat,
            call: {
                ...state.chat.call,
                sessionKeyHash
            }
        }
    })),

    toggleVideo: () => set((state) => ({
        chat: {
            ...state.chat,
            call: {
                ...state.chat.call,
                isVideoEnabled: !state.chat.call.isVideoEnabled
            }
        }
    })),

    toggleScreenShare: () => set((state) => ({
        chat: {
            ...state.chat,
            call: {
                ...state.chat.call,
                isSharingScreen: !state.chat.call.isSharingScreen
            }
        }
    })),

    setRemoteVideoEnabled: (enabled: boolean) => set((state) => ({
        chat: {
            ...state.chat,
            call: {
                ...state.chat.call,
                isRemoteVideoEnabled: enabled
            }
        }
    })),

    setRemoteScreenSharing: (enabled: boolean) => set((state) => ({
        chat: {
            ...state.chat,
            call: {
                ...state.chat.call,
                isRemoteScreenSharing: enabled
            }
        }
    })),
    toggleCallMinimized: () => set((state) => ({
        chat: {
            ...state.chat,
            call: {
                ...state.chat.call,
                isMinimized: !state.chat.call.isMinimized
            }
        }
    })),

    // Profile dialog state management
    setProfileDialog: (data: ProfileDialogData | null) => set((state) => ({
        chat: {
            ...state.chat,
            profileDialog: data
        }
    })),

    closeProfileDialog: () => set((state) => ({
        chat: {
            ...state.chat,
            profileDialog: null
        }
    })),

    // Online status and typing state management
    updateOnlineStatus: (userId: number, online: boolean, lastSeen: string) => set((state) => ({
        chat: {
            ...state.chat,
            onlineStatuses: new Map(state.chat.onlineStatuses).set(userId, { online, lastSeen })
        }
    })),

    addTypingUser: (userId: number, username: string) => set((state) => ({
        chat: {
            ...state.chat,
            typingUsers: new Map(state.chat.typingUsers).set(userId, username)
        }
    })),

    removeTypingUser: (userId: number) => set((state) => {
        const newTypingUsers = new Map(state.chat.typingUsers);
        newTypingUsers.delete(userId);
        return {
            chat: {
                ...state.chat,
                typingUsers: newTypingUsers
            }
        };
    }),

    setDmTypingUser: (userId: number, isTyping: boolean) => set((state) => {
        const newDmTypingUsers = new Map(state.chat.dmTypingUsers);
        if (isTyping) {
            newDmTypingUsers.set(userId, true);
        } else {
            newDmTypingUsers.delete(userId);
        }
        return {
            chat: {
                ...state.chat,
                dmTypingUsers: newDmTypingUsers
            }
        };
    }),

    setSuspended: (reason: string) => set((state) => ({
        user: {
            ...state.user,
            isSuspended: true,
            suspensionReason: reason
        }
    }))
}));