import { useState, useEffect } from "react";
import { useImmer } from "use-immer";
import { MaterialTextField, MaterialButton, MaterialCircularProgress, MaterialIconButton } from "@/utils/material";
import { useAppState } from "@/pages/chat/state";
import { 
    getChannel, getChannelSubscribers, updateChannelProfile,
    assignChannelAdmin, type AssignChannelAdminRequest
} from "@/core/api/channelsApi";
import type { Channel, ChannelSubscriber } from "@/core/types";
import { MemberList } from "./MemberList";
import { AdminRightsDialog, type AdminRights } from "./AdminRightsDialog";
import { confirm } from "mdui/functions/confirm";
import { alert } from "mdui/functions/alert";
import styles from "@/pages/chat/css/settings-dialog.module.scss";

interface ChannelSettingsPanelProps {
    channelId: number;
}

export function ChannelSettingsPanel({ channelId }: ChannelSettingsPanelProps) {
    const { user } = useAppState();
    const authToken = user?.authToken ?? null;
    
    const [channel, setChannel] = useState<Channel | null>(null);
    const [subscribers, updateSubscribers] = useImmer<ChannelSubscriber[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingProfile, setEditingProfile] = useState(false);
    
    const [channelName, setChannelName] = useState("");
    const [channelDescription, setChannelDescription] = useState("");
    const [channelUsername, setChannelUsername] = useState("");
    
    const [adminDialogOpen, setAdminDialogOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [selectedUsername, setSelectedUsername] = useState<string | null>(null);

    useEffect(() => {
        if (authToken && channelId) {
            loadData();
        }
    }, [authToken, channelId]);

    async function loadData() {
        if (!authToken) return;
        setLoading(true);
        try {
            const [channelData, subscribersData] = await Promise.all([
                getChannel(channelId, authToken),
                getChannelSubscribers(channelId, authToken)
            ]);
            setChannel(channelData);
            setChannelName(channelData.name);
            setChannelDescription(channelData.description || "");
            setChannelUsername(channelData.username || "");
            updateSubscribers(subscribersData.subscribers);
        } catch (error) {
            console.error("Failed to load channel settings:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveProfile() {
        if (!authToken || !channel) return;
        try {
            const updated = await updateChannelProfile(channelId, {
                name: channelName,
                description: channelDescription || null,
                username: channelUsername || null
            }, authToken);
            setChannel(updated);
            setEditingProfile(false);
        } catch (error) {
            console.error("Failed to update profile:", error);
            alert({
                headline: "Error",
                description: "Failed to update channel profile"
            });
        }
    }

    async function handleMakeAdmin(userId: number) {
        const subscriber = subscribers.find(s => s.user.id === userId);
        if (subscriber) {
            setSelectedUserId(userId);
            setSelectedUsername(subscriber.user.display_name || subscriber.user.username);
            setAdminDialogOpen(true);
        }
    }

    async function handleSaveAdmin(rights: AdminRights) {
        if (!authToken || !selectedUserId) return;
        try {
            const request: AssignChannelAdminRequest = {
                user_id: selectedUserId,
                admin_name: rights.admin_name,
                can_send_messages: rights.can_send_messages,
                can_send_images: rights.can_send_images,
                can_send_files: rights.can_send_files,
                can_delete_messages: rights.can_delete_messages,
                can_assign_admins: rights.can_assign_admins,
                can_modify_profile: rights.can_modify_profile
            };
            await assignChannelAdmin(channelId, request, authToken);
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
            const subscriber = subscribers.find(s => s.user.id === userId);
            await confirm({
                headline: "Remove Subscriber?",
                description: `Are you sure you want to remove ${subscriber?.user.display_name || subscriber?.user.username} from this channel?`,
                confirmText: "Remove",
                cancelText: "Cancel"
            });
            // TODO: Implement remove subscriber API call
            await loadData();
        } catch (error) {
            if (error !== "cancelled") {
                console.error("Failed to remove subscriber:", error);
            }
        }
    }

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <MaterialCircularProgress />
            </div>
        );
    }

    if (!channel) {
        return <div>Channel not found</div>;
    }

    const isOwner = channel.owner_id === user.currentUser?.id;
    const isAdmin = channel.is_admin || isOwner;

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
                                label="Channel Name"
                                value={channelName}
                                onChange={(e) => setChannelName(e.target.value)}
                            />
                            <MaterialTextField
                                label="Description"
                                value={channelDescription}
                                onChange={(e) => setChannelDescription(e.target.value)}
                            />
                            <MaterialTextField
                                label="Username (optional)"
                                value={channelUsername}
                                onChange={(e) => setChannelUsername(e.target.value)}
                                placeholder="unique-username"
                            />
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <MaterialButton variant="filled" onClick={handleSaveProfile}>
                                    Save
                                </MaterialButton>
                                <MaterialButton variant="text" onClick={() => {
                                    setEditingProfile(false);
                                    setChannelName(channel.name);
                                    setChannelDescription(channel.description || "");
                                    setChannelUsername(channel.username || "");
                                }}>
                                    Cancel
                                </MaterialButton>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <p><strong>Name:</strong> {channel.name}</p>
                            {channel.description && <p><strong>Description:</strong> {channel.description}</p>}
                            {channel.username && <p><strong>Username:</strong> @{channel.username}</p>}
                            <p><strong>Subscribers:</strong> {channel.subscriber_count}</p>
                        </div>
                    )}
                </div>

                {/* Subscribers Section */}
                {(isAdmin || isOwner) && (
                    <div>
                        <h3 className={styles.panelTitle}>Subscribers ({subscribers.length})</h3>
                        <MemberList
                            subscribers={subscribers}
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
                username={selectedUsername || undefined}
            />
        </>
    );
}

