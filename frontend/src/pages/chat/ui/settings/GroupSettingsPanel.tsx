import { useState, useEffect } from "react";
import { useImmer } from "use-immer";
import { MaterialTextField, MaterialButton, MaterialCircularProgress, MaterialIconButton } from "@/utils/material";
import { useAppState } from "@/pages/chat/state";
import { 
    getGroup, getGroupMembers, updateGroupProfile, 
    assignGroupAdmin, restrictGroupMember, banGroupMember,
    generateInviteLink, type AssignGroupAdminRequest, type RestrictMemberRequest
} from "@/core/api/groupsApi";
import type { Group, GroupMember } from "@/core/types";
import { MemberList } from "./MemberList";
import { AdminRightsDialog, type AdminRights } from "./AdminRightsDialog";
import { RestrictionDialog, type RestrictionData } from "./RestrictionDialog";
import { confirm } from "mdui/functions/confirm";
import { alert } from "mdui/functions/alert";
import styles from "@/pages/chat/css/settings-dialog.module.scss";

interface GroupSettingsPanelProps {
    groupId: number;
}

export function GroupSettingsPanel({ groupId }: GroupSettingsPanelProps) {
    const { user } = useAppState();
    const authToken = user?.authToken ?? null;
    
    const [group, setGroup] = useState<Group | null>(null);
    const [members, updateMembers] = useImmer<GroupMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingProfile, setEditingProfile] = useState(false);
    
    const [groupName, setGroupName] = useState("");
    const [groupDescription, setGroupDescription] = useState("");
    const [groupUsername, setGroupUsername] = useState("");
    
    const [adminDialogOpen, setAdminDialogOpen] = useState(false);
    const [restrictionDialogOpen, setRestrictionDialogOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
    const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
    const [inviteLink, setInviteLink] = useState<string | null>(null);

    useEffect(() => {
        if (authToken && groupId) {
            loadData();
        }
    }, [authToken, groupId]);

    async function loadData() {
        if (!authToken) return;
        setLoading(true);
        try {
            const [groupData, membersData] = await Promise.all([
                getGroup(groupId, authToken),
                getGroupMembers(groupId, authToken)
            ]);
            setGroup(groupData);
            setGroupName(groupData.name);
            setGroupDescription(groupData.description || "");
            setGroupUsername(groupData.username || "");
            setInviteLink(groupData.invite_link);
            updateMembers(membersData);
        } catch (error) {
            console.error("Failed to load group settings:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveProfile() {
        if (!authToken || !group) return;
        try {
            const updated = await updateGroupProfile(groupId, {
                name: groupName,
                description: groupDescription || null,
                username: groupUsername || null
            }, authToken);
            setGroup(updated);
            setEditingProfile(false);
        } catch (error) {
            console.error("Failed to update profile:", error);
            alert({
                headline: "Error",
                description: "Failed to update group profile"
            });
        }
    }

    async function handleBan(userId: number) {
        if (!authToken) return;
        try {
            const member = members.find(m => m.user.id === userId);
            if (!member) return;

            if (member.is_banned) {
                await confirm({
                    headline: "Unban Member?",
                    description: `Are you sure you want to unban ${member.user.display_name || member.user.username}?`,
                    confirmText: "Unban",
                    cancelText: "Cancel"
                });
                await banGroupMember(groupId, userId, authToken); // Unban if no banned_until
            } else {
                await banGroupMember(groupId, userId, authToken);
            }
            await loadData();
        } catch (error) {
            if (error !== "cancelled") {
                console.error("Failed to ban member:", error);
            }
        }
    }

    async function handleRestrict(userId: number) {
        const member = members.find(m => m.user.id === userId);
        if (member) {
            setSelectedUserId(userId);
            setSelectedUsername(member.user.display_name || member.user.username);
            setSelectedMember(member);
            setRestrictionDialogOpen(true);
        }
    }

    async function handleSaveRestriction(restriction: RestrictionData) {
        if (!authToken || !selectedUserId) return;
        try {
            const request: RestrictMemberRequest = {
                user_id: selectedUserId,
                can_send_messages: restriction.can_send_messages,
                can_send_images: restriction.can_send_images,
                can_send_files: restriction.can_send_files,
                can_react: restriction.can_react,
                expires_at: restriction.expires_at || null
            };
            await restrictGroupMember(groupId, request, authToken);
            await loadData();
        } catch (error) {
            console.error("Failed to restrict member:", error);
        }
    }

    async function handleMakeAdmin(userId: number) {
        const member = members.find(m => m.user.id === userId);
        if (member) {
            setSelectedUserId(userId);
            setSelectedUsername(member.user.display_name || member.user.username);
            setSelectedMember(null);
            setAdminDialogOpen(true);
        }
    }

    async function handleSaveAdmin(rights: AdminRights) {
        if (!authToken || !selectedUserId) return;
        try {
            const request: AssignGroupAdminRequest = {
                user_id: selectedUserId,
                admin_name: rights.admin_name,
                can_send_messages: rights.can_send_messages,
                can_send_images: rights.can_send_images,
                can_send_files: rights.can_send_files,
                can_delete_messages: rights.can_delete_messages,
                can_assign_admins: rights.can_assign_admins,
                can_modify_profile: rights.can_modify_profile
            };
            await assignGroupAdmin(groupId, request, authToken);
            await loadData();
        } catch (error) {
            console.error("Failed to assign admin:", error);
        }
    }

    async function handleRemoveAdmin(_userId: number) {
        if (!authToken) return;
        try {
            await confirm({
                headline: "Remove Admin?",
                description: "Are you sure you want to remove this user's admin privileges?",
                confirmText: "Remove",
                cancelText: "Cancel"
            });
            // TODO: Implement remove admin API call
            await loadData();
        } catch (error) {
            if (error !== "cancelled") {
                console.error("Failed to remove admin:", error);
            }
        }
    }

    async function handleRemoveMember(userId: number) {
        if (!authToken) return;
        try {
            const member = members.find(m => m.user.id === userId);
            await confirm({
                headline: "Remove Member?",
                description: `Are you sure you want to remove ${member?.user.display_name || member?.user.username} from this group?`,
                confirmText: "Remove",
                cancelText: "Cancel"
            });
            // TODO: Implement remove member API call
            await loadData();
        } catch (error) {
            if (error !== "cancelled") {
                console.error("Failed to remove member:", error);
            }
        }
    }

    async function handleGenerateInviteLink() {
        if (!authToken) return;
        try {
            const link = await generateInviteLink(groupId, authToken);
            setInviteLink(link);
            await navigator.clipboard.writeText(`${window.location.origin}/join/${link}`);
            alert({
                headline: "Invite Link Generated",
                description: "The invite link has been copied to your clipboard."
            });
        } catch (error) {
            console.error("Failed to generate invite link:", error);
        }
    }

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <MaterialCircularProgress />
            </div>
        );
    }

    if (!group) {
        return <div>Group not found</div>;
    }

    const isOwner = group.owner_id === user.currentUser?.id;
    const isAdmin = group.is_admin || isOwner;

    return (
        <>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", padding: "1rem" }}>
                {/* Profile Section */}
                <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <h3 className={styles.panelTitle}>Profile</h3>
                        {isAdmin && (
                            <MaterialIconButton
                                icon={editingProfile ? "check" : "edit"}
                                onClick={() => {
                                    if (editingProfile) {
                                        handleSaveProfile();
                                    } else {
                                        setEditingProfile(true);
                                    }
                                }}
                            />
                        )}
                    </div>
                    
                    {editingProfile && isAdmin ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            <MaterialTextField
                                label="Group Name"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                            />
                            <MaterialTextField
                                label="Description"
                                value={groupDescription}
                                onChange={(e) => setGroupDescription(e.target.value)}
                            />
                            <MaterialTextField
                                label="Username (optional)"
                                value={groupUsername}
                                onChange={(e) => setGroupUsername(e.target.value)}
                                placeholder="unique-username"
                            />
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <MaterialButton variant="filled" onClick={handleSaveProfile}>
                                    Save
                                </MaterialButton>
                                <MaterialButton variant="text" onClick={() => {
                                    setEditingProfile(false);
                                    setGroupName(group.name);
                                    setGroupDescription(group.description || "");
                                    setGroupUsername(group.username || "");
                                }}>
                                    Cancel
                                </MaterialButton>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <p><strong>Name:</strong> {group.name}</p>
                            {group.description && <p><strong>Description:</strong> {group.description}</p>}
                            {group.username && <p><strong>Username:</strong> @{group.username}</p>}
                            <p><strong>Members:</strong> {group.member_count}</p>
                        </div>
                    )}
                </div>

                {/* Invite Link Section */}
                {isAdmin && (
                    <div>
                        <h3 className={styles.panelTitle}>Invite Link</h3>
                        {inviteLink ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                <MaterialTextField
                                    value={`${window.location.origin}/join/${inviteLink}`}
                                    readonly
                                />
                                <MaterialButton variant="tonal" onClick={handleGenerateInviteLink}>
                                    Generate New Link
                                </MaterialButton>
                            </div>
                        ) : (
                            <MaterialButton variant="filled" onClick={handleGenerateInviteLink}>
                                Generate Invite Link
                            </MaterialButton>
                        )}
                    </div>
                )}

                {/* Members Section */}
                {(isAdmin || isOwner) && (
                    <div>
                        <h3 className={styles.panelTitle}>Members ({members.length})</h3>
                        <MemberList
                            members={members}
                            onBan={handleBan}
                            onRestrict={handleRestrict}
                            onMakeAdmin={handleMakeAdmin}
                            onRemoveAdmin={handleRemoveAdmin}
                            onRemoveMember={handleRemoveMember}
                            currentUserId={user.currentUser?.id}
                            isOwner={isOwner}
                            isAdmin={isAdmin}
                        />
                    </div>
                )}
            </div>

            <AdminRightsDialog
                isOpen={adminDialogOpen}
                onOpenChange={setAdminDialogOpen}
                onSave={handleSaveAdmin}
                existingAdmin={selectedMember?.admin || null}
                username={selectedUsername || undefined}
            />

            <RestrictionDialog
                isOpen={restrictionDialogOpen}
                onOpenChange={setRestrictionDialogOpen}
                onSave={handleSaveRestriction}
                existingRestriction={null}
                username={selectedUsername || undefined}
            />
        </>
    );
}

