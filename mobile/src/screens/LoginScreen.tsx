import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { 
    TextInput, 
    Button, 
    Text, 
    Surface, 
    Snackbar,
    ActivityIndicator
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { loginUser, ApiError } from '../api/authApi';
import type { RootStackParamList } from '../navigation/AppNavigator';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
    const navigation = useNavigation<LoginScreenNavigationProp>();
    const { login } = useAuthStore();
    
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    const showError = (message: string) => {
        setSnackbarMessage(message);
        setSnackbarVisible(true);
    };

    const handleLogin = async () => {
        if (!username.trim() || !password.trim()) {
            showError('Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            const response = await loginUser(username, password);
            login(response.token, response.user);
            navigation.navigate('MainTabs');
        } catch (error) {
            if (error instanceof ApiError) {
                showError(error.message);
            } else {
                showError('Connection error. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Surface style={styles.surface} elevation={2}>
                <Text variant="headlineMedium" style={styles.title}>
                    Welcome Back!
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                    Sign in to your account
                </Text>

                <TextInput
                    label="Username"
                    value={username}
                    onChangeText={setUsername}
                    mode="outlined"
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    disabled={loading}
                />

                <TextInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    mode="outlined"
                    secureTextEntry
                    style={styles.input}
                    disabled={loading}
                />

                <Button
                    mode="contained"
                    onPress={handleLogin}
                    style={styles.button}
                    disabled={loading}
                    contentStyle={styles.buttonContent}
                >
                    {loading ? <ActivityIndicator size="small" color="white" /> : 'Sign In'}
                </Button>

                <Button
                    mode="text"
                    onPress={() => navigation.navigate('Register')}
                    style={styles.linkButton}
                    disabled={loading}
                >
                    Don't have an account? Sign up
                </Button>
            </Surface>

            <Snackbar
                visible={snackbarVisible}
                onDismiss={() => setSnackbarVisible(false)}
                duration={4000}
            >
                {snackbarMessage}
            </Snackbar>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#f5f5f5'
    },
    surface: {
        padding: 24,
        borderRadius: 12
    },
    title: {
        textAlign: 'center',
        marginBottom: 8,
        fontWeight: 'bold'
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: 32,
        opacity: 0.7
    },
    input: {
        marginBottom: 16
    },
    button: {
        marginTop: 8,
        marginBottom: 16
    },
    buttonContent: {
        paddingVertical: 8
    },
    linkButton: {
        alignSelf: 'center'
    }
});
