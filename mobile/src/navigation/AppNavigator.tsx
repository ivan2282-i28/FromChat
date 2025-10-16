import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import MainTabsScreen from '../screens/MainTabsScreen';
import ChatScreen from '../screens/ChatScreen';

export type RootStackParamList = {
    Login: undefined;
    Register: undefined;
    MainTabs: undefined;
    ChatScreen: {
        chatType: string;
        chatId: string;
        chatName: string;
    };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
    const { isAuthenticated } = useAuthStore();

    return (
        <Stack.Navigator
            initialRouteName={isAuthenticated ? 'MainTabs' : 'Login'}
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                animationDuration: 200
            }}
        >
            {!isAuthenticated ? (
                // Auth screens
                <>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Register" component={RegisterScreen} />
                </>
            ) : (
                // Main app screens
                <>
                    <Stack.Screen name="MainTabs" component={MainTabsScreen} />
                    <Stack.Screen 
                        name="ChatScreen" 
                        component={ChatScreen}
                        options={{
                            headerShown: true,
                            headerBackTitleVisible: false,
                            headerTitle: ''
                        }}
                    />
                </>
            )}
        </Stack.Navigator>
    );
}
