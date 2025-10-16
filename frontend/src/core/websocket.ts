/**
 * @fileoverview WebSocket connection management for real-time chat
 * @description Handles WebSocket connections, message processing, and auto-reconnection
 * @author Cursor
 * @version 1.0.0
 */

import { API_WS_BASE_URL } from "./config";
import type { WebSocketMessage } from "@fromchat/shared/types";
import { CallSignalingHandler } from "./calls/signaling";
import { onError as sharedOnError, request as sharedRequest } from "@fromchat/shared/websocket";

/**
 * Creates a new WebSocket connection to the chat server
 * @returns {WebSocket} New WebSocket instance
 * @private
 */
function create(): WebSocket {
    let prefix = "ws://";
    if (location.protocol.includes("https")) {
        prefix = "wss://";
    }

    return new WebSocket(`${prefix}${API_WS_BASE_URL}/chat/ws`);
}

/**
 * Global WebSocket instance
 * @type {WebSocket}
 */
export let websocket: WebSocket = create();

/**
 * Global WebSocket message handler reference
 * This will be set by the active panel to handle incoming messages
 */
let globalMessageHandler: ((response: WebSocketMessage<any>) => void) | null = null;

/**
 * Call signaling handler
 */
let callSignalingHandler: CallSignalingHandler | null = null;

/**
 * Set the global WebSocket message handler
 * @param handler - Function to handle WebSocket messages
 */
export function setGlobalMessageHandler(handler: ((response: WebSocketMessage<any>) => void) | null): void {
    globalMessageHandler = handler;
}

/**
 * Set the call signaling handler
 * @param handler - Call signaling handler instance
 */
export function setCallSignalingHandler(handler: CallSignalingHandler | null): void {
    callSignalingHandler = handler;
}

export function request<Request, Response = any>(payload: WebSocketMessage<Request>): Promise<WebSocketMessage<Response>> {
    return sharedRequest(websocket, payload);
}

export const onError = sharedOnError(() => websocket = create(), websocket);

// --------------
// Initialization
// --------------

websocket.addEventListener("message", (e) => {
    try {
        const response: WebSocketMessage<any> = JSON.parse(e.data);
        
        // Handle call signaling messages
        if (callSignalingHandler && response.type === "call_signaling" && response.data) {
            callSignalingHandler.handleWebSocketMessage(response.data);
        }
        
        // Route message to global handler if set
        if (globalMessageHandler) {
            globalMessageHandler(response);
        }
    } catch (error) {
        console.error("Error parsing WebSocket message:", error);
    }
});
websocket.addEventListener("error", onError);