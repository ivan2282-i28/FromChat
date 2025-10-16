import type { Message, Messages } from '../../../shared/types.d';
import { getAuthHeaders } from '../../../shared/api/auth';
import { API_BASE_URL } from '../config/config';
import { ApiError } from './authApi';

/**
 * Fetch public chat messages
 */
export async function fetchPublicMessages(token: string): Promise<Message[]> {
  const response = await fetch(`${API_BASE_URL}/get_messages`, {
    headers: getAuthHeaders(token)
  });

  if (!response.ok) {
    throw new ApiError('Failed to fetch messages', response.status);
  }

  const data: Messages = await response.json();
  return data.messages || [];
}

/**
 * Fetch DM messages (for future use)
 */
export async function fetchDMMessages(token: string, recipientId: number): Promise<Message[]> {
  // This will be implemented when we add DM support
  throw new ApiError('DM messages not implemented yet');
}
