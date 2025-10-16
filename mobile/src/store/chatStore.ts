import { create } from 'zustand';
import type { Message } from '../../../shared/types.d';

interface ChatState {
    messages: Message[];
    isLoading: boolean;
    wsConnected: boolean;
    currentChatType: string | null;
    currentChatId: string | null;
}

interface ChatActions {
    addMessage: (message: Message) => void;
    setMessages: (messages: Message[]) => void;
    clearMessages: () => void;
    setWsConnected: (connected: boolean) => void;
    setCurrentChat: (type: string, id: string) => void;
    setLoading: (loading: boolean) => void;
}

export const useChatStore = create<ChatState & ChatActions>((set) => ({
    // State
    messages: [],
    isLoading: false,
    wsConnected: false,
    currentChatType: null,
    currentChatId: null,

    // Actions
    addMessage: (message: Message) => {
        set((state) => {
            // Check if message already exists to prevent duplicates
            const messageExists = state.messages.some(msg => msg.id === message.id);
            if (messageExists) {
                return state;
            }
            
            return {
                messages: [...state.messages, message]
            };
        });
    },

    setMessages: (messages: Message[]) => {
        set({ messages });
    },

    clearMessages: () => {
        set({ messages: [] });
    },

    setWsConnected: (connected: boolean) => {
        set({ wsConnected: connected });
    },

    setCurrentChat: (type: string, id: string) => {
        set({ 
            currentChatType: type,
            currentChatId: id,
            messages: [] // Clear messages when switching chats
        });
    },

    setLoading: (loading: boolean) => {
        set({ isLoading: loading });
    }
}));
