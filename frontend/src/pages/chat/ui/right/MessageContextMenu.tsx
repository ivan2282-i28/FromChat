import { useState } from "react";
import type { Message, Size2D } from "@/core/types";
import { useAppState } from "@/pages/chat/state";
import { GlassmorphicContextMenu, type ContextMenuItem } from "@/core/components/GlassmorphicContextMenu";
import { GlassmorphicReactionBar } from "@/core/components/GlassmorphicReactionBar";

interface MessageContextMenuProps {
    message: Message;
    isAuthor: boolean;
    onEdit: (message: Message) => void;
    onReply: (message: Message) => void;
    onDelete: (message: Message) => void;
    onRetry?: (message: Message) => void;
    onReactionClick?: (messageId: number, emoji: string) => Promise<void>;
    position: Size2D;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export interface ContextMenuState {
    isOpen: boolean;
    message: Message | null;
    position: Size2D;
}

export function MessageContextMenu({
    message,
    isAuthor,
    onEdit,
    onReply,
    onDelete,
    onRetry,
    onReactionClick,
    position,
    isOpen,
    onOpenChange
}: MessageContextMenuProps) {
    const { user } = useAppState();
    const [reactionBarOpen, setReactionBarOpen] = useState(true);

    // Check if message is sending or failed
    const isSending = message.runtimeData?.sendingState?.status === 'sending';
    const isFailed = message.runtimeData?.sendingState?.status === 'failed';
    const isSendingOrFailed = isSending || isFailed;

    // Quick reactions for the reaction bar
    const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

    const menuItems: ContextMenuItem[] = [
        {
            label: "Reply",
            icon: "reply",
            onClick: () => {
                onReply(message);
            },
            show: !isSendingOrFailed
        },
        {
            label: "Edit",
            icon: "edit",
            onClick: () => {
                onEdit(message);
            },
            show: isAuthor && !isSendingOrFailed
        },
        {
            label: "Retry",
            icon: "refresh",
            onClick: () => {
                if (onRetry) {
                    onRetry(message);
                }
            },
            show: isAuthor && isFailed && !!onRetry
        },
        {
            label: "Delete",
            icon: "delete",
            onClick: () => {
                onDelete(message);
            },
            show: isAuthor || user.currentUser?.id === 1
        },
        {
            label: "Copy",
            icon: "content_copy",
            onClick: () => {
                navigator.clipboard.writeText(message.content);
            },
            show: true
        }
    ];

    async function handleReactionClick(emoji: string) {
        if (onReactionClick) {
            await onReactionClick(message.id, emoji);
        }
    }

    // Calculate reaction bar position (above context menu)
    const reactionBarPosition: Size2D = {
        x: position.x,
        y: position.y - 60 // Position above menu
    };

    return (
        <>
            <GlassmorphicReactionBar
                quickReactions={QUICK_REACTIONS}
                position={reactionBarPosition}
                isOpen={isOpen && reactionBarOpen}
                onOpenChange={setReactionBarOpen}
                onReactionClick={handleReactionClick}
                onClose={() => {
                    if (!reactionBarOpen) {
                        onOpenChange(false);
                    }
                }}
            />
            <GlassmorphicContextMenu
                items={menuItems}
                position={position}
                isOpen={isOpen}
                onOpenChange={onOpenChange}
            />
        </>
    );
}
