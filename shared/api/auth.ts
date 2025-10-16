import type { BackupBlob, Headers, PublicKeyResponse, UploadPublicKeyRequest } from "../types.d";
import { b64, ub64 } from "../utils";

/**
 * Generates authentication headers for API requests
 * @param {boolean} json - Whether to include JSON content type header
 * @returns {Headers} Headers object with authentication and content type
 */
export function getAuthHeaders(token: string | null, json: boolean = true): Headers {
    const headers: Headers = {};

    if (json) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

export async function fetchPublicKey(API_BASE_URL: string, token: string): Promise<Uint8Array | null> {
	const headers = getAuthHeaders(token, true);
	const res = await fetch(`${API_BASE_URL}/crypto/public-key`, { method: "GET", headers });
	if (!res.ok) return null;
	const data = await res.json() as PublicKeyResponse;
	if (!data?.publicKey) return null;
	return ub64(data.publicKey);
}

export async function uploadPublicKey(API_BASE_URL: string, publicKey: Uint8Array, token: string): Promise<void> {
	const payload: UploadPublicKeyRequest = { 
		publicKey: b64(publicKey) 
	}

	const headers = getAuthHeaders(token, true);
	await fetch(`${API_BASE_URL}/crypto/public-key`, {
		method: "POST",
		headers,
		body: JSON.stringify(payload)
	});
}

export async function fetchBackupBlob(API_BASE_URL: string, token: string): Promise<string | null> {
	const headers = getAuthHeaders(token, true);
	const res = await fetch(`${API_BASE_URL}/crypto/backup`, { 
		method: "GET",
		headers 
	});
	if (res.ok) {
		const response = await res.json() as BackupBlob;
		return response.blob;
	} else {
		return null;
	}
}

export async function uploadBackupBlob(API_BASE_URL: string, blobJson: string, token: string): Promise<void> {
	const payload: BackupBlob = { blob: blobJson }

	const headers = getAuthHeaders(token, true);
	await fetch(`${API_BASE_URL}/crypto/backup`, {
		method: "POST",
		headers,
		body: JSON.stringify(payload)
	});
}