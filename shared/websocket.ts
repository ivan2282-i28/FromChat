import type { WebSocketMessage } from "./types.d";
import { delay } from "./utils";

export function request<Request, Response = any>(
    websocket: WebSocket, 
    payload: WebSocketMessage<Request>
): Promise<WebSocketMessage<Response>> {
    console.log("WebSocket request:", payload);
    return new Promise((resolve, reject) => {
        function requestInner() {
            let listener: ((e: MessageEvent) => void) | null = null;
            listener = (e) => {
                resolve(JSON.parse(e.data));
                websocket.removeEventListener("message", listener!);
            }
            websocket.addEventListener("message", listener);
            websocket.send(JSON.stringify(payload));
        }

        if (websocket.readyState == 0) {
            websocket.addEventListener("open", requestInner);
        } else {
            requestInner();
        }

        setTimeout(() => reject("Request timed out"), 10000);
    })
}

/**
 * This function will wait 3 seconds and them attempts to reconnect the WebSocket.
 * If it fails, tries again in an endless loop until the connection is established
 * again.
 * 
 * @private
 */
export const onError = (recreate: () => void, websocket: WebSocket) => async function onError() {
    console.warn("WebSocket disconnected, retrying in 3 seconds...");
    await delay(3000);
    recreate();

    let listener: () => void | null;
    listener = () => {
        console.log("WebSocket successfully reconnected!");
        websocket.removeEventListener("open", listener);
    }

    websocket.addEventListener("open", listener);
    websocket.addEventListener("error", onError);
}