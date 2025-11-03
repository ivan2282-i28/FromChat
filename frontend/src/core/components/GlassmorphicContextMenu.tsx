import { useState, useEffect, useRef } from "react";
import type { Size2D } from "@/core/types";
import styles from "@/pages/chat/css/MessageContextMenu.module.scss";

export interface ContextMenuItem {
    label: string;
    icon?: string;
    onClick: () => void;
    show?: boolean;
}

interface GlassmorphicContextMenuProps {
    items: ContextMenuItem[];
    position: Size2D;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    className?: string;
    zIndex?: number;
}

export function GlassmorphicContextMenu({
    items,
    position,
    isOpen,
    onOpenChange,
    className = "",
    zIndex = 1000
}: GlassmorphicContextMenuProps) {
    const [isClosing, setIsClosing] = useState(false);
    const [menuPosition, setMenuPosition] = useState<Size2D>(position);
    const [animationClass, setAnimationClass] = useState<keyof typeof styles>(styles.entering);
    const contextMenuRef = useRef<HTMLDivElement>(null);

    // Calculate smart positioning when component opens
    useEffect(() => {
        if (isOpen) {
            const frameId = requestAnimationFrame(() => {
                if (contextMenuRef.current) {
                    const menuRect = contextMenuRef.current.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;

                    let menuX = position.x;
                    let menuY = position.y;
                    let animation: keyof typeof styles = styles.entering;

                    // Check if menu would overflow horizontally
                    if (menuX + menuRect.width > viewportWidth) {
                        menuX = position.x - menuRect.width;
                        animation = styles.enteringLeft;
                    }

                    // Ensure menu doesn't go off the left edge
                    if (menuX < 0) {
                        menuX = 0;
                    }

                    // Check if menu would overflow bottom edge
                    if (menuY + menuRect.height > viewportHeight) {
                        menuY = viewportHeight - menuRect.height;
                        animation = styles.enteringUp;
                    }

                    // Ensure menu doesn't go off the right edge
                    if (menuX + menuRect.width > viewportWidth) {
                        menuX = viewportWidth - menuRect.width;
                    }

                    setMenuPosition({ x: menuX, y: menuY });
                    setAnimationClass(animation);
                }
            });

            return () => cancelAnimationFrame(frameId);
        }
    }, [isOpen, position]);

    // Effect to handle clicks outside the context menu
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (isOpen && !isClosing) {
                const target = event.target as Element;
                if (!contextMenuRef.current || !contextMenuRef.current.contains(target)) {
                    handleClose();
                }
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape' && isOpen && !isClosing) {
                handleClose();
            }
        }

        function handleWindowBlur() {
            if (isOpen && !isClosing) {
                handleClose();
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('blur', handleWindowBlur);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('blur', handleWindowBlur);
        };
    }, [isOpen, isClosing]);

    function handleClose() {
        setIsClosing(true);
        setAnimationClass(styles.closing);

        setTimeout(() => {
            onOpenChange(false);
            setIsClosing(false);
            setAnimationClass(styles.entering);
        }, 200);
    }

    if (!isOpen) return null;

    return (
        <div
            ref={contextMenuRef}
            className={`${styles.contextMenu} ${animationClass} ${className}`}
            style={{
                position: 'fixed',
                top: `${menuPosition.y}px`,
                left: `${menuPosition.x}px`,
                zIndex
            }}
            onClick={(e) => e.stopPropagation()}>
            {items
                .filter(item => item.show !== false)
                .map((item, i) => (
                    <div
                        className={styles.contextMenuItem}
                        onClick={() => {
                            item.onClick();
                            handleClose();
                        }}
                        key={i}>
                        {item.icon && <span className="material-symbols">{item.icon}</span>}
                        {item.label}
                    </div>
                ))}
        </div>
    );
}

