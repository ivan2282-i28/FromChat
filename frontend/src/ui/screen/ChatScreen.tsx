import { useEffect } from "react";
import { LeftPanel } from "../components/chat/LeftPanel";
import { RightPanel } from "../components/chat/RightPanel";
import { useAppState } from "../state";
import useWindowSize from "../hooks/useWindowSize";

export default function ChatScreen() {
    const { width } = useWindowSize();
    const { chat, setIsMobileView, setShowChatList } = useAppState();
    const isMobile = width < 800;

    // Debug logging
    console.log("Screen width:", width, "isMobile:", isMobile);

    // Update mobile view state when screen size changes
    useEffect(() => {
        setIsMobileView(isMobile);
        if (!isMobile) {
            // On desktop, always show both panels
            setShowChatList(true);
        }
    }, [isMobile, setIsMobileView, setShowChatList]);

    // Handle browser back button
    useEffect(() => {
        const handlePopState = () => {
            if (chat.isMobileView && chat.activePanel) {
                setShowChatList(true);
            }
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [chat.isMobileView, chat.activePanel, setShowChatList]);

    return (
        <div id="chat-interface">
            <div className={`all-container ${isMobile ? "mobile" : ""}`}>
                <LeftPanel />
                <RightPanel />
            </div>
        </div>
    );
}