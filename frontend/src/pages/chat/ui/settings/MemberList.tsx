import { useState } from "react";
import { MaterialList, MaterialListItem } from "@/utils/material";
import { GlassmorphicContextMenu, type ContextMenuItem } from "@/core/components/GlassmorphicContextMenu";
import type { GroupMember, ChannelSubscriber, Size2D } from "@/core/types";
import defaultAvatar from "@/images/default-avatar.png";
import styles from "@/pages/chat/css/settings-dialog.module.scss";

interface MemberListProps {
    members?: GroupMember[];
    subscribers?: ChannelSubscriber[];
    onBan?: (userId: number) => void;
    onRestrict?: (userId: number) => void;
    onMakeAdmin?: (userId: number) => void;
    onRemoveAdmin?: (userId: number) => void;
    onRemoveMember?: (userId: number) => void;
    currentUserId?: number;
    isOwner?: boolean;
    isAdmin?: boolean;
}

export function MemberList({
    members,
    subscribers,
    onBan,
    onRestrict,
    onMakeAdmin,
    onRemoveAdmin,
    onRemoveMember,
    currentUserId,
    isOwner = false,
    isAdmin = false
}: MemberListProps) {
    const [contextMenu, setContextMenu] = useState<{
        open: boolean;
        position: Size2D;
        userId: number;
        isMember: boolean;
        isOwnerUser: boolean;
        isAdminUser: boolean;
        isBanned: boolean;
    } | null>(null);

    function handleContextMenu(
        e: React.MouseEvent,
        userId: number,
        isMember: boolean,
        isOwnerUser: boolean,
        isAdminUser: boolean,
        isBanned: boolean
    ) {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            open: true,
            position: { x: e.clientX, y: e.clientY },
            userId,
            isMember,
            isOwnerUser,
            isAdminUser,
            isBanned
        });
    }

    function formatRole(role?: string, isAdminUser?: boolean): string {
        if (role === "owner") return "Owner";
        if (isAdminUser) return "Admin";
        return "Member";
    }

    const items = members || subscribers || [];

    const menuItems: ContextMenuItem[] = [];
    
    if (contextMenu) {
        const { userId, isOwnerUser, isAdminUser, isBanned } = contextMenu;
        const canModify = isOwner || (isAdmin && !isOwnerUser);

        if (canModify && !isOwnerUser && userId !== currentUserId) {
            if (isBanned) {
                menuItems.push({
                    label: "Unban",
                    icon: "lock_open",
                    onClick: () => {
                        if (onBan) onBan(userId);
                        setContextMenu(null);
                    },
                    show: true
                });
            } else {
                menuItems.push({
                    label: "Ban",
                    icon: "block",
                    onClick: () => {
                        if (onBan) onBan(userId);
                        setContextMenu(null);
                    },
                    show: true
                });
            }

            menuItems.push({
                label: "Restrict",
                icon: "gavel",
                onClick: () => {
                    if (onRestrict) onRestrict(userId);
                    setContextMenu(null);
                },
                show: true
            });

            if (isAdminUser) {
                menuItems.push({
                    label: "Remove Admin",
                    icon: "admin_panel_settings",
                    onClick: () => {
                        if (onRemoveAdmin) onRemoveAdmin(userId);
                        setContextMenu(null);
                    },
                    show: true
                });
            } else {
                menuItems.push({
                    label: "Make Admin",
                    icon: "admin_panel_settings",
                    onClick: () => {
                        if (onMakeAdmin) onMakeAdmin(userId);
                        setContextMenu(null);
                    },
                    show: true
                });
            }

            menuItems.push({
                label: "Remove Member",
                icon: "person_remove",
                onClick: () => {
                    if (onRemoveMember) onRemoveMember(userId);
                    setContextMenu(null);
                },
                show: true
            });
        }
    }

    return (
        <>
            <MaterialList>
                {items.map((item) => {
                    const user = "user" in item ? item.user : item;
                    const isOwnerUser = "role" in item && item.role === "owner";
                    const isAdminUser = "role" in item && item.role === "admin" || ("admin" in item && item.admin !== null);
                    const isBanned = "is_banned" in item && item.is_banned === true;
                    const role = "role" in item ? item.role : undefined;

                    return (
                        <MaterialListItem
                            key={user.id}
                            headline={user.display_name || user.username}
                            description={formatRole(role, isAdminUser)}
                            onContextMenu={(e) => handleContextMenu(e, user.id, "role" in item, isOwnerUser, isAdminUser, isBanned)}
                            className={styles.clickableItem}
                        >
                            <img
                                slot="icon"
                                src={user.profile_picture || defaultAvatar}
                                alt={user.display_name || user.username}
                                style={{
                                    width: "40px",
                                    height: "40px",
                                    borderRadius: "50%",
                                    objectFit: "cover"
                                }}
                                onError={(e) => {
                                    e.currentTarget.src = defaultAvatar;
                                }}
                            />
                        </MaterialListItem>
                    );
                })}
            </MaterialList>
            {contextMenu && (
                <GlassmorphicContextMenu
                    items={menuItems}
                    position={contextMenu.position}
                    isOpen={contextMenu.open}
                    onOpenChange={(open) => {
                        if (!open) setContextMenu(null);
                    }}
                />
            )}
        </>
    );
}

