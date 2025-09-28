import { useAppState } from "../../state";
import { MessagePanelRenderer } from "./MessagePanelRenderer";

export function RightPanel() {
    const { activePanel, isChatSwitching } = useAppState().chat;

    return (
        <MessagePanelRenderer 
            panel={activePanel} 
            isChatSwitching={isChatSwitching} 
        />
    );
}
