// Mobile storage utilities using AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../../../shared/types.d';

export class MobileStorage {
    static async getItem(key: string): Promise<string | null> {
        try {
            return await AsyncStorage.getItem(key);
        } catch (error) {
            console.error('Error getting item from storage:', error);
            return null;
        }
    }

    static async setItem(key: string, value: string): Promise<void> {
        try {
            await AsyncStorage.setItem(key, value);
        } catch (error) {
            console.error('Error setting item in storage:', error);
        }
    }

    static async removeItem(key: string): Promise<void> {
        try {
            await AsyncStorage.removeItem(key);
        } catch (error) {
            console.error('Error removing item from storage:', error);
        }
    }

    static async clear(): Promise<void> {
        try {
            await AsyncStorage.clear();
        } catch (error) {
            console.error('Error clearing storage:', error);
        }
    }

    // Auth-specific storage methods
    static async getAuthToken(): Promise<string | null> {
        return await this.getItem('authToken');
    }

    static async setAuthToken(token: string): Promise<void> {
        await this.setItem('authToken', token);
    }

    static async getUser(): Promise<User | null> {
        try {
            const userJson = await this.getItem('user');
            if (!userJson) return null;
            return JSON.parse(userJson) as User;
        } catch (error) {
            console.error('Error parsing user from storage:', error);
            return null;
        }
    }

    static async setUser(user: User): Promise<void> {
        await this.setItem('user', JSON.stringify(user));
    }

    static async clearAuth(): Promise<void> {
        await Promise.all([
            this.removeItem('authToken'),
            this.removeItem('user')
        ]);
    }
}
