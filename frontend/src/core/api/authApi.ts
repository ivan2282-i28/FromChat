import { generateX25519KeyPair } from "@/utils/crypto/asymmetric";
import { encodeBlob, encryptBackupWithPassword, decryptBackupWithPassword, decodeBlob } from "@/utils/crypto/backup";
import { b64, ub64 } from "@/utils/utils";
import { API_BASE_URL } from "@/core/config";
import { 
	fetchBackupBlob as sfetchBackupBlob, 
	uploadBackupBlob as suploadBackupBlob, 
	fetchPublicKey as sfetchPublicKey, 
	uploadPublicKey as suploadPublicKey 
} from "@fromchat/shared/api/auth";

// ----------------
// Shared functions
// ----------------

function fetchBackupBlob(token: string): Promise<string | null> {
	return sfetchBackupBlob(API_BASE_URL, token);
}

function uploadBackupBlob(blobJson: string, token: string): Promise<void> {
	return suploadBackupBlob(API_BASE_URL, blobJson, token);
}

function fetchPublicKey(token: string): Promise<Uint8Array | null> {
	return sfetchPublicKey(API_BASE_URL, token);
}

function uploadPublicKey(publicKey: Uint8Array, token: string): Promise<void> {
	return suploadPublicKey(API_BASE_URL, publicKey, token);
}

export { getAuthHeaders } from "@fromchat/shared/api/auth";

// ---------------------------
// Platform-specific functions
// ---------------------------

let currentPublicKey: Uint8Array | null = null;
let currentPrivateKey: Uint8Array | null = null;

export interface UserKeyPairMemory {
	publicKey: Uint8Array;
	privateKey: Uint8Array;
}

export function getCurrentKeys(): UserKeyPairMemory | null {
	if (currentPublicKey && currentPrivateKey) return { publicKey: currentPublicKey, privateKey: currentPrivateKey };
	return null;
}

function saveKeys(
	publicKey: Uint8Array<ArrayBufferLike>, 
	privateKey: Uint8Array<ArrayBufferLike>
) {
	const encodedPublicKey = b64(publicKey);
	const encodedPrivateKey = b64(privateKey);

	localStorage.setItem("publicKey", encodedPublicKey);
	localStorage.setItem("privateKey", encodedPrivateKey);
}

export async function ensureKeysOnLogin(password: string, token: string): Promise<UserKeyPairMemory> {
	// Try to restore from backup
	const blobJson = await fetchBackupBlob(token);
	if (blobJson) {
		const blob = decodeBlob(blobJson);
		const bundle = await decryptBackupWithPassword(password, blob);
		currentPrivateKey = bundle.privateKey;
		// Ensure public key exists on server; if not, derive from private (not possible via libsafely), so keep previous
		// In our simple scheme, we rely on server having the public key or we reupload generated one on first setup
		const serverPub = await fetchPublicKey(token);
		if (serverPub) {
			currentPublicKey = serverPub;
		} else {
			// We don't have the corresponding public key from server; regenerate pair to resync
			const pair = generateX25519KeyPair();
			currentPublicKey = pair.publicKey;
			currentPrivateKey = pair.privateKey;
			await uploadPublicKey(currentPublicKey, token);
			const newBlob = await encryptBackupWithPassword(password, { version: 1, privateKey: currentPrivateKey });
			await uploadBackupBlob(encodeBlob(newBlob), token);
		}

		saveKeys(currentPublicKey!, currentPrivateKey!);

		return { 
			publicKey: currentPublicKey!, 
			privateKey: currentPrivateKey! 
		};
	}

	// First-time setup: generate keys and upload
	const pair = generateX25519KeyPair();
	currentPublicKey = pair.publicKey;
	currentPrivateKey = pair.privateKey;
	await uploadPublicKey(currentPublicKey, token);
	const encBlob = await encryptBackupWithPassword(password, { version: 1, privateKey: currentPrivateKey });
	await uploadBackupBlob(encodeBlob(encBlob), token);

	saveKeys(pair.publicKey, pair.privateKey);

	return pair;
}

export function restoreKeys() {
	currentPublicKey = ub64(localStorage.getItem("publicKey")!);
	currentPrivateKey = ub64(localStorage.getItem("privateKey")!);
}

export function getAuthToken(): string | null {
	return localStorage.getItem("authToken");
}