import { useState, useEffect, useRef } from "react";
import type { Size2D } from "@/core/types";
import { EmojiMenu } from "@/pages/chat/ui/right/EmojiMenu";
import styles from "@/pages/chat/css/MessageContextMenu.module.scss";

interface GlassmorphicReactionBarProps {
    quickReactions: string[];
    position: Size2D;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onReactionClick: (emoji: string) => Promise<void> | void;
    onClose?: () => void;
    zIndex?: number;
}

export function GlassmorphicReactionBar({
    quickReactions,
    position,
    isOpen,
    onOpenChange,
    onReactionClick,
    onClose,
    zIndex = 1001
}: GlassmorphicReactionBarProps) {
    const [isClosing, setIsClosing] = useState(false);
    const [reactionBarPosition, setReactionBarPosition] = useState<Size2D>(position);
    const [animationClass, setAnimationClass] = useState<keyof typeof styles>(styles.entering);
    const [isEmojiMenuExpanded, setIsEmojiMenuExpanded] = useState(false);
    const [initialDimensions, setInitialDimensions] = useState<{ width: number; height: number } | null>(null);
    const [expandUpward, setExpandUpward] = useState(false);

    const reactionBarRef = useRef<HTMLDivElement>(null);
    const emojiMenuRef = useRef<HTMLDivElement>(null);

    // Calculate smart positioning when component opens
    useEffect(() => {
        if (isOpen) {
            const frameId = requestAnimationFrame(() => {
                if (reactionBarRef.current) {
                    const reactionBarRect = reactionBarRef.current.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;

                    let reactionX = position.x;
                    let reactionY = position.y;
                    let animation: keyof typeof styles = styles.entering;

                    // Check if reaction bar would overflow at the top
                    if (reactionY < 0) {
                        // Position reaction bar to the right side
                        reactionX = position.x + 10;
                        reactionY = position.y;
                        animation = styles.enteringRight;
                    }

                    // Check if would overflow horizontally
                    if (reactionX + reactionBarRect.width > viewportWidth) {
                        reactionX = position.x - reactionBarRect.width - 10;
                        if (animation !== styles.enteringRight) {
                            animation = styles.enteringLeft;
                        }
                    }

                    // Check if would overflow bottom
                    if (reactionY + reactionBarRect.height > viewportHeight) {
                        reactionY = viewportHeight - reactionBarRect.height;
                        animation = styles.enteringUp;
                    }

                    // Ensure doesn't go off edges
                    if (reactionX < 0) reactionX = 0;
                    if (reactionX + reactionBarRect.width > viewportWidth) {
                        reactionX = viewportWidth - reactionBarRect.width;
                    }

                    setReactionBarPosition({ x: reactionX, y: reactionY });
                    setAnimationClass(animation);
                }
            });

            return () => cancelAnimationFrame(frameId);
        }
    }, [isOpen, position]);

    // Effect to handle clicks outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (isOpen && !isClosing) {
                const target = event.target as Element;
                if ((!reactionBarRef.current || !reactionBarRef.current.contains(target))) {
                    handleClose();
                }
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape' && isOpen && !isClosing) {
                handleClose();
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, isClosing]);

    function handleClose() {
        setIsClosing(true);
        setAnimationClass(styles.closing);

        setTimeout(() => {
            onOpenChange(false);
            setIsClosing(false);
            setAnimationClass(styles.entering);
            setIsEmojiMenuExpanded(false);
            setInitialDimensions(null);
            setExpandUpward(false);
            if (onClose) onClose();
        }, 200);
    }

    function handleExpandClick() {
        if (!reactionBarRef.current) return;

        const reactionBarRect = reactionBarRef.current.getBoundingClientRect();
        setInitialDimensions({ width: reactionBarRect.width, height: reactionBarRect.height });

        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - reactionBarRect.bottom;
        const emojiMenuHeight = 400;

        const shouldExpandUpward = spaceBelow < emojiMenuHeight;
        setExpandUpward(shouldExpandUpward);

        requestAnimationFrame(() => {
            setIsEmojiMenuExpanded(true);
        });
    }

    function handleEmojiSelect(emoji: string) {
        onReactionClick(emoji);
        handleClose();
    }

    if (!isOpen) return null;

    return (
        <div
            ref={reactionBarRef}
            className={`${styles.contextMenuReactionBar} ${animationClass} ${isEmojiMenuExpanded ? styles.expanded : ""} ${expandUpward ? styles.expandUpward : ""}`}
            style={{
                position: 'fixed',
                ...(isEmojiMenuExpanded && expandUpward
                    ? {
                        bottom: `${window.innerHeight - reactionBarPosition.y - (initialDimensions?.height || 0)}px`,
                        left: `${reactionBarPosition.x}px`,
                    }
                    : {
                        top: `${reactionBarPosition.y}px`,
                        left: `${reactionBarPosition.x}px`,
                    }
                ),
                width: isEmojiMenuExpanded ? '320px' : initialDimensions?.width || 'auto',
                height: isEmojiMenuExpanded ? '400px' : initialDimensions?.height || 'auto',
                zIndex
            }}
            onClick={(e) => e.stopPropagation()}>
            {!isEmojiMenuExpanded ? (
                <div className={styles.reactionBarContent}>
                    {quickReactions.map((emoji, index) => (
                        <button
                            key={index}
                            className={styles.reactionEmojiButton}
                            onClick={async () => await onReactionClick(emoji)}
                            title={emoji}
                        >
                            {emoji}
                        </button>
                    ))}
                    <button
                        className={styles.reactionExpandButton}
                        onClick={handleExpandClick}
                        title="More emojis"
                    >
                        <span className="material-symbols">add</span>
                    </button>
                </div>
            ) : (
                <div
                    ref={emojiMenuRef}
                    className={styles.emojiMenuWrapper}>
                    <EmojiMenu
                        isOpen={true}
                        onClose={handleClose}
                        onEmojiSelect={handleEmojiSelect}
                        mode="integrated"
                    />
                </div>
            )}
        </div>
    );
}

