import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAppState } from "@/pages/chat/state";
import { MessagePanel, type MessagePanelState } from "./panels/MessagePanel";
import { ChatMessages } from "./ChatMessages";
import { ChatInputWrapper } from "./ChatInputWrapper";
import { ProfileDialog } from "@/pages/chat/ui/ProfileDialog";
import { setGlobalMessageHandler } from "@/core/websocket";
import type { Message, WebSocketMessage } from "@/core/types";
import defaultAvatar from "@/images/default-avatar.png";
import { DMPanel } from "./panels/DMPanel";
import { ChannelPanel } from "./panels/ChannelPanel";
import useCall from "@/pages/chat/hooks/useCall";
import { TypingIndicator } from "./TypingIndicator";
import { OnlineStatus } from "./OnlineStatus";
import { typingManager } from "@/core/typingManager";
import { MaterialIcon, MaterialIconButton, MaterialButton } from "@/utils/material";
import styles from "@/pages/chat/css/layout.module.scss";
import rightPanelStyles from "@/pages/chat/css/right-panel.module.scss";

interface MessagePanelRendererProps {
    panel: MessagePanel | null;
}

function ChatHeaderText({ panel }: { panel: MessagePanel | null }) {
    const { chat, user } = useAppState();
    const otherTypingUsers = useMemo(() => {
        return Array
            .from(chat.typingUsers.entries())
            .filter(([userId, username]) => userId !== user.currentUser?.id && username)
            .map(([, username]) => username!);
    }, [chat.typingUsers, user.currentUser?.id]);

    let content: ReactNode;

    if (panel instanceof DMPanel) {
        const recipientId = panel.getRecipientId()!;
        const isTyping = chat.dmTypingUsers.get(recipientId);

        content = isTyping ? <TypingIndicator typingUsers={[]} /> : <OnlineStatus userId={recipientId} />;
    } else if (panel && !panel.isDm() && otherTypingUsers.length > 0) {
        // For groups and channels, show typing indicator
        content = <TypingIndicator typingUsers={otherTypingUsers} />;
    } else {
        return null;
    }

    return <div>{content}</div>;
}

export function MessagePanelRenderer({ panel }: MessagePanelRendererProps) {
    const { applyPendingPanel, chat, setProfileDialog } = useAppState();
    const messagePanelRef = useRef<HTMLDivElement>(null);
    const [panelState, setPanelState] = useState<MessagePanelState | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const previousMessageCountRef = useRef(0);
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [replyToVisible, setReplyToVisible] = useState(Boolean(replyTo));
    const [editMessage, setEditMessage] = useState<Message | null>(null);
    const [editVisible, setEditVisible] = useState(Boolean(editMessage));
    const [pendingAction, setPendingAction] = useState<null | { type: "reply" | "edit"; message: Message }>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const { initiateCall } = useCall();


    // Drag & drop
    const [isDragging, setIsDragging] = useState(false);
    const dragCounterRef = useRef(0);
    const addFilesRef = useRef<null | ((files: File[]) => void)>(null);

    useEffect(() => {
        if (!panel || !panelState) return;

        return () => {
            dragCounterRef.current = 0;
            setIsDragging(false);
        };
    }, [panel, panelState]);

    useEffect(() => {
        if (replyTo) {
            setReplyToVisible(true);
        }
    }, [replyTo]);

    useEffect(() => {
        if (editMessage) {
            setEditVisible(true);
        }
    }, [editMessage]);

    // Handle panel state changes
    useEffect(() => {
        if (panel) {
            setPanelState(panel.getState());

            // Store the handler for cleanup
            panel.onStateChange = (newState: MessagePanelState) => {
                setPanelState(newState);
            };

            // Set up WebSocket message handler for this panel
            if (panel.handleWebSocketMessage) {
                setGlobalMessageHandler((message: WebSocketMessage<any>) => panel.handleWebSocketMessage(message));
            }
        } else {
            setPanelState(null);
            setGlobalMessageHandler(null);
        }

        return () => {
            if (panel) {
                if (panel.onStateChange) {
                    panel.onStateChange = null;
                }

                if (typeof panel.destroy === 'function') {
                    panel.destroy();
                }
            }
        };
    }, [panel]);

    // Handle chat switching animation
    useEffect(() => {
        if (chat.isSwitching && chat.pendingPanel) {
            // Apply pending panel when animation starts
            applyPendingPanel();
            // End switching state after a brief delay to allow animation
            setTimeout(() => {
                chat.setIsSwitching(false);
            }, 200);
        }
    }, [chat.isSwitching, chat.pendingPanel, applyPendingPanel]);

    // Load messages when panel changes and animation is not running
    useEffect(() => {
        if (!chat.activePanel || chat.isSwitching) return;

        const panelState = chat.activePanel.getState();

        if (panelState.messages.length === 0 && !panelState.isLoading) {
            chat.activePanel.loadMessages();
        }
    }, [chat.activePanel, chat.isSwitching]);

    // Scroll to bottom only when new messages are added
    useEffect(() => {
        if (!panelState || chat.isSwitching) return;

        const currentMessageCount = panelState.messages.length;
        const previousMessageCount = previousMessageCountRef.current;

        const el = messagesEndRef.current;
        if (!el) return;

        // Scroll without animation when messages are initially loaded
        if (previousMessageCount === 0 && currentMessageCount > 0 && !panelState.isLoading) {
            el.scrollIntoView({ behavior: "instant", block: "end" });
        }
        // Scroll with animation when a new message is added
        else if (currentMessageCount > previousMessageCount && previousMessageCount > 0) {
            // Defer to next frame to ensure layout is stable
            const id = requestAnimationFrame(() => {
                el.scrollIntoView({ behavior: "smooth", block: "end" });
            });

            return () => cancelAnimationFrame(id);
        }

        // Update the previous message count
        previousMessageCountRef.current = currentMessageCount;
    }, [panelState?.messages, panelState?.isLoading, chat.isSwitching]);

    function handleCallClick() {
        if (panel && panelState && panel.isDm()) {
            const dmPanel = panel as DMPanel;
            const userId = dmPanel.getDMUserId();
            const username = dmPanel.getDMUsername();

            if (userId && username) {
                initiateCall(userId, username);
            }
        }
    };

    async function handleProfileClick() {
        if (!panel) return;

        try {
            const profileData = await panel.getProfile();
            if (profileData) {
                setProfileDialog(profileData);
            }
        } catch (error) {
            console.error("Failed to get profile:", error);
        }
    }

    const panelKey = chat.activePanel?.getState().title || "empty";

    return (
        <div className={styles.chatContainer}>
            <AnimatePresence mode="wait">
                <motion.div
                    key={panelKey}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className={rightPanelStyles.chatWrapper}
                >
                    <div
                        ref={messagePanelRef}
                        className={rightPanelStyles.chatMain}
                        onDragEnter={panel ? (e) => {
                            if (!e.dataTransfer) return;
                            e.preventDefault();
                            e.stopPropagation();
                            dragCounterRef.current += 1;
                            // Only show overlay when actual files are dragged
                            const hasFiles = Array.from(e.dataTransfer.types || []).includes("Files");
                            if (hasFiles) setIsDragging(true);
                        } : undefined}
                        onDragOver={panel ? (e) => {
                            if (!e.dataTransfer) return;
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = "copy";
                        } : undefined}
                        onDragLeave={panel ? (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
                            if (dragCounterRef.current === 0) setIsDragging(false);
                        } : undefined}
                        onDrop={panel ? (e) => {
                            if (!e.dataTransfer) return;
                            e.preventDefault();
                            e.stopPropagation();
                            const files = Array.from(e.dataTransfer.files || []);
                            if (files.length > 0 && addFilesRef.current) {
                                addFilesRef.current(files);
                            }
                            setIsDragging(false);
                            dragCounterRef.current = 0;
                        } : undefined}>
                        <div className={rightPanelStyles.chatHeader}>
                            <img
                                src={panelState?.profilePicture || defaultAvatar}
                                alt="Avatar"
                                className={rightPanelStyles.chatHeaderAvatar}
                                onClick={handleProfileClick}
                                style={{ cursor: panel ? "pointer" : "default" }}
                            />
                            <div className={rightPanelStyles.chatHeaderInfo}>
                                <div className={rightPanelStyles.infoChat}>
                                    <h4 id="chat-name">{panelState?.title || "Выбор чата"}</h4>
                                    <ChatHeaderText panel={panel} />
                                </div>
                                {panel?.isDm() && (
                                    <MaterialIconButton onClick={handleCallClick} icon="call--filled" />
                                )}
                                {!panel?.isDm() && (panel instanceof ChannelPanel || panel?.getId().startsWith("group-")) && (
                                    <MaterialIconButton 
                                        onClick={() => setSettingsOpen(true)} 
                                        icon="settings--filled" 
                                    />
                                )}
                            </div>
                        </div>

                        {panelState?.isLoading ? (
                            <div className={rightPanelStyles.chatMessages} id="chat-messages">
                                <div style={{
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    height: "100%",
                                    color: "var(--mdui-color-on-surface-variant)"
                                }}>
                                    Загрузка сообщений...
                                </div>
                            </div>
                        ) : panelState && panel ? (
                            <ChatMessages
                                messages={panelState.messages}
                                isDm={panel.isDm()}
                                dmRecipientPublicKey={(panel as DMPanel).dmData?.publicKey}
                                onReplySelect={(message) => {
                                    if (editMessage || editVisible) {
                                        setPendingAction({ type: "reply", message: message });
                                        setEditVisible(false); // onCloseEdit will apply pending
                                    } else {
                                        setReplyTo(message);
                                    }
                                }}
                                onEditSelect={(message) => {
                                    if (replyTo || replyToVisible) {
                                        setPendingAction({ type: "edit", message: message });
                                        setReplyToVisible(false); // onCloseReply will apply pending
                                    } else {
                                        setEditMessage(message);
                                    }
                                }}
                                onDelete={(id) => panel.handleDeleteMessage(id)}
                                onRetryMessage={(id) => panel.retryMessage(id)}
                            >
                                <div ref={messagesEndRef} />
                            </ChatMessages>
                        ) : (
                            <div className={rightPanelStyles.chatMessages} id="chat-messages">
                                <div style={{
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    height: "100%",
                                    color: "var(--mdui-color-on-surface-variant)"
                                }}>
                                    Выберите чат на боковой панели, чтобы начать переписку
                                </div>
                            </div>
                        )}

                        {panel && (
                            (panel instanceof ChannelPanel && !panel.isSubscribed()) ? (
                                <div style={{
                                    padding: "1rem",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    color: "var(--mdui-color-on-surface-variant)"
                                }}>
                                    <p style={{ margin: 0, textAlign: "center" }}>
                                        {panel.getChannel()?.subscriber_count || 0} подписчиков
                                    </p>
                                    <MaterialButton
                                        variant="filled"
                                        onClick={async () => {
                                            try {
                                                await panel.subscribe();
                                                // Reload messages after subscribing
                                                await panel.loadMessages();
                                            } catch (error) {
                                                console.error("Failed to subscribe:", error);
                                            }
                                        }}
                                    >
                                        Подписаться
                                    </MaterialButton>
                                </div>
                            ) : (panel instanceof ChannelPanel && !panel.canSend()) ? (
                                <div style={{
                                    padding: "1rem",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    color: "var(--mdui-color-on-surface-variant)"
                                }}>
                                    <p style={{ margin: 0, textAlign: "center" }}>
                                        Только администраторы могут отправлять сообщения в каналы
                                    </p>
                                </div>
                            ) : (
                                <ChatInputWrapper
                                    onSendMessage={(text, files) => {
                                        panel.handleSendMessage(text, replyTo?.id, files);
                                        setReplyTo(null);
                                    }}
                                    onSaveEdit={(content) => {
                                        if (editMessage) {
                                            panel.handleEditMessage(editMessage.id, content);
                                            setEditMessage(null);
                                        }
                                    }}
                                    replyTo={replyTo}
                                    replyToVisible={replyToVisible}
                                    onClearReply={() => {
                                        setPendingAction(null);
                                        setReplyToVisible(false);
                                    }}
                                    onCloseReply={() => {
                                        setReplyTo(null);
                                        if (pendingAction && pendingAction.type === "edit") {
                                            setEditMessage(pendingAction.message);
                                            setPendingAction(null);
                                        }
                                    }}
                                    editingMessage={editMessage}
                                    editVisible={editVisible}
                                    onClearEdit={() => {
                                        setPendingAction(null);
                                        setEditVisible(false);
                                    }}
                                    onCloseEdit={() => {
                                        setEditMessage(null);
                                        if (pendingAction && pendingAction.type === "reply") {
                                            setReplyTo(pendingAction.message);
                                            setPendingAction(null);
                                        }
                                    }}
                                    onProvideFileAdder={(adder) => { addFilesRef.current = adder; }}
                                    messagePanelRef={messagePanelRef}
                                    onTyping={() => {
                                        if (panel.isDm()) {
                                            const dmPanel = panel as DMPanel;
                                            dmPanel.handleTyping();
                                        } else {
                                            typingManager.sendTyping();
                                        }
                                    }}
                                    onStopTyping={() => {
                                        if (panel.isDm()) {
                                            const dmPanel = panel as DMPanel;
                                            typingManager.stopDmTypingOnMessage(dmPanel.getRecipientId()!);
                                        } else {
                                            typingManager.stopTypingOnMessage();
                                        }
                                    }}
                                />
                            )
                        )}
                    </div>

                    {panel && (
                        <AnimatePresence>
                            {isDragging && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.5 }}
                                    className={rightPanelStyles.fileOverlay}
                                >
                                    <div className={rightPanelStyles.fileOverlayWrapper}>
                                        <div className={rightPanelStyles.fileOverlayInner}>
                                            <MaterialIcon name="upload_file" />
                                            <span>Отпустите файл(ы) для добавления</span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Profile Dialog */}
            <ProfileDialog />

            {/* Settings Dialog */}
            {panel && settingsOpen && (
                <GroupChannelSettingsDialog
                    panel={panel}
                    isOpen={settingsOpen}
                    onOpenChange={setSettingsOpen}
                />
            )}
        </div>
    );
}

function GroupChannelSettingsDialog({
    panel,
    isOpen,
    onOpenChange
}: {
    panel: MessagePanel;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [settingsComponent, setSettingsComponent] = useState<React.ReactNode>(null);

    useEffect(() => {
        if (isOpen && panel) {
            (async () => {
                const { StyledDialog } = await import("@/core/components/StyledDialog");
                if (panel.getId().startsWith("group-")) {
                    const groupPanel = panel as any; // GroupPanel type
                    const groupId = groupPanel.getGroupId();
                    const { GroupSettingsPanel } = await import("@/pages/chat/ui/settings/GroupSettingsPanel");
                    setSettingsComponent(
                        <StyledDialog open={isOpen} onOpenChange={onOpenChange}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                <h2 style={{ margin: 0 }}>Group Settings</h2>
                                <GroupSettingsPanel groupId={groupId} />
                            </div>
                        </StyledDialog>
                    );
                } else if (panel.getId().startsWith("channel-")) {
                    const channelPanel = panel as any; // ChannelPanel type
                    const channelId = channelPanel.getChannelId();
                    const { ChannelSettingsPanel } = await import("@/pages/chat/ui/settings/ChannelSettingsPanel");
                    setSettingsComponent(
                        <StyledDialog open={isOpen} onOpenChange={onOpenChange}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                <h2 style={{ margin: 0 }}>Channel Settings</h2>
                                <ChannelSettingsPanel channelId={channelId} />
                            </div>
                        </StyledDialog>
                    );
                }
            })();
        }
    }, [isOpen, panel, onOpenChange]);

    return settingsComponent || null;
}
