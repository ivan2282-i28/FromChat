import type { WebSocketMessage, SendMessageRequest } from '../../../shared/types.d';
import { request, onError } from '../../../shared/websocket';
import { WS_BASE_URL } from '../config/config';

class WebSocketService {
    private websocket: WebSocket | null = null;
    private messageHandler: ((message: WebSocketMessage<any>) => void) | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;

    /**
     * Connect to WebSocket server
     */
    connect(token: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const wsUrl = `${WS_BASE_URL}/chat/ws`;
                this.websocket = new WebSocket(wsUrl);

                this.websocket.onopen = () => {
                    console.log('WebSocket connected');
                    this.reconnectAttempts = 0;
                    resolve();
                };

                this.websocket.onmessage = (event) => {
                    try {
                        const message: WebSocketMessage<any> = JSON.parse(event.data);
                        if (this.messageHandler) {
                            this.messageHandler(message);
                        }
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };

                this.websocket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                };

                this.websocket.onclose = () => {
                    console.log('WebSocket disconnected');
                    this.websocket = null;
                    this.attemptReconnect(token);
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect(): void {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
    }

    /**
     * Send a public chat message
     */
    async sendPublicMessage(content: string, token: string): Promise<void> {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }

        const payload: SendMessageRequest = {
            type: 'sendMessage',
            credentials: {
                scheme: 'Bearer',
                credentials: token
            },
            data: {
                content: content.trim(),
                reply_to_id: null
            }
        };

        try {
            await request(this.websocket, payload);
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    /**
     * Set message handler for incoming messages
     */
    setMessageHandler(handler: (message: WebSocketMessage<any>) => void): void {
        this.messageHandler = handler;
    }

    /**
     * Check if WebSocket is connected
     */
    isConnected(): boolean {
        return this.websocket !== null && this.websocket.readyState === WebSocket.OPEN;
    }

    /**
     * Attempt to reconnect with exponential backoff
     */
    private async attemptReconnect(token: string): Promise<void> {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Max 30 seconds

        console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(async () => {
            try {
                await this.connect(token);
            } catch (error) {
                console.error('Reconnection failed:', error);
            }
        }, delay);
    }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
