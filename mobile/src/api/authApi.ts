import type { LoginRequest, RegisterRequest, LoginResponse, ErrorResponse } from '../../../shared/types.d';
import { getAuthHeaders } from '../../../shared/api/auth';
import { API_BASE_URL } from '../config/config';

export class ApiError extends Error {
    readonly status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.status = status;
    }
}

/**
 * Login user with username and password
 */
export async function loginUser(username: string, password: string): Promise<LoginResponse> {
    const request: LoginRequest = {
        username: username.trim(),
        password: password.trim()
    };

    const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
    });

    if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new ApiError(errorData.message || 'Login failed', response.status);
    }

    return await response.json();
}

/**
 * Register new user
 */
export async function registerUser(
    username: string, 
    password: string, 
    confirmPassword: string
): Promise<LoginResponse> {
    const request: RegisterRequest = {
        username: username.trim(),
        password: password.trim(),
        confirm_password: confirmPassword.trim()
    };

    const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
    });

    if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new ApiError(errorData.message || 'Registration failed', response.status);
    }

    return await response.json();
}

/**
 * Validate auth token by fetching user profile
 */
export async function validateToken(token: string): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE_URL}/user/profile`, {
            headers: getAuthHeaders(token)
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}
