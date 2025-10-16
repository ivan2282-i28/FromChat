import { create } from 'zustand';
import type { User } from '../../../shared/types.d';
import { MobileStorage } from '../utils/storage';
import { API_BASE_URL } from '../config/config';
import { getAuthHeaders } from '../../../shared/api/auth';

interface AuthState {
    user: User | null;
    authToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

interface AuthActions {
    login: (token: string, user: User) => void;
    logout: () => void;
    restoreSession: () => Promise<void>;
    setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
    // State
    user: null,
    authToken: null,
    isAuthenticated: false,
    isLoading: false,

    // Actions
    login: (token: string, user: User) => {
        set({
            user,
            authToken: token,
            isAuthenticated: true,
            isLoading: false
        });

        // Persist to storage
        MobileStorage.setAuthToken(token);
        MobileStorage.setUser(user);
    },

    logout: () => {
        set({
            user: null,
            authToken: null,
            isAuthenticated: false,
            isLoading: false
        });

        // Clear from storage
        MobileStorage.clearAuth();
    },

    restoreSession: async () => {
        set({ isLoading: true });

        try {
            const token = await MobileStorage.getAuthToken();
            const user = await MobileStorage.getUser();

            if (!token || !user) {
                set({ isAuthenticated: false, isLoading: false });
                return;
            }

            // Validate token with server
            const response = await fetch(`${API_BASE_URL}/user/profile`, {
                headers: getAuthHeaders(token)
            });

            if (response.ok) {
                // Token is valid, restore session
                set({
                    user,
                    authToken: token,
                    isAuthenticated: true,
                    isLoading: false
                });
            } else {
                // Token is invalid, clear credentials
                console.log('Invalid token, clearing credentials');
                await MobileStorage.clearAuth();
                set({
                    user: null,
                    authToken: null,
                    isAuthenticated: false,
                    isLoading: false
                });
            }
        } catch (error) {
            console.error('Error restoring session:', error);
            // On error, clear credentials and set as not authenticated
            await MobileStorage.clearAuth();
            set({
                user: null,
                authToken: null,
                isAuthenticated: false,
                isLoading: false
            });
        }
    },

    setLoading: (loading: boolean) => {
        set({ isLoading: loading });
    }
}));
