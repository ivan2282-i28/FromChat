import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
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
import { registerUser, ApiError } from '../api/authApi';
import type { RootStackParamList } from '../navigation/AppNavigator';

type RegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

export default function RegisterScreen() {
    const navigation = useNavigation<RegisterScreenNavigationProp>();
    const { login } = useAuthStore();
    
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    const showError = (message: string) => {
        setSnackbarMessage(message);
        setSnackbarVisible(true);
    };

    const validateForm = (): boolean => {
        if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
            showError('Please fill in all fields');
            return false;
        }

        if (username.length < 3 || username.length > 20) {
            showError('Username must be between 3 and 20 characters');
            return false;
        }

        if (password.length < 5 || password.length > 50) {
            showError('Password must be between 5 and 50 characters');
            return false;
        }

        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return false;
        }

        return true;
    };

    const handleRegister = async () => {
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            const response = await registerUser(username, password, confirmPassword);
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
                    Create Account
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                    Sign up for a new account
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
                    maxLength={20}
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

                <TextInput
                    label="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    mode="outlined"
                    secureTextEntry
                    style={styles.input}
                    disabled={loading}
                />

                <Button
                    mode="contained"
                    onPress={handleRegister}
                    style={styles.button}
                    disabled={loading}
                    contentStyle={styles.buttonContent}
                >
                    {loading ? <ActivityIndicator size="small" color="white" /> : 'Sign Up'}
                </Button>

                <Button
                    mode="text"
                    onPress={() => navigation.navigate('Login')}
                    style={styles.linkButton}
                    disabled={loading}
                >
                    Already have an account? Sign in
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
