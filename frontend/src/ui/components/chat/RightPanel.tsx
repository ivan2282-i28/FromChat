import { useAppState } from "../../state";
import { MessagePanelRenderer } from "./MessagePanelRenderer";

export function RightPanel() {
    const { chat } = useAppState();
    const isMobile = chat.isMobileView;
    const showChatList = chat.showChatList;

    return (
        <div className={`chat-container ${isMobile && showChatList ? "hidden" : ""}`}>
            <MessagePanelRenderer 
                panel={chat.activePanel} 
                isChatSwitching={chat.isChatSwitching} 
            />
        </div>
    );
}
