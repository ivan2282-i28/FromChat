import { useState, useEffect } from "react";
import { StyledDialog } from "@/core/components/StyledDialog";
import { MaterialTextField, MaterialButton, MaterialSwitch } from "@/utils/material";
import type { GroupAdmin, ChannelAdmin } from "@/core/types";

interface AdminRightsDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (rights: AdminRights) => void;
    existingAdmin?: GroupAdmin | ChannelAdmin | null;
    username?: string;
}

export interface AdminRights {
    admin_name?: string | null;
    can_send_messages: boolean;
    can_send_images: boolean;
    can_send_files: boolean;
    can_delete_messages: boolean;
    can_assign_admins: boolean;
    can_modify_profile: boolean;
}

export function AdminRightsDialog({
    isOpen,
    onOpenChange,
    onSave,
    existingAdmin,
    username
}: AdminRightsDialogProps) {
    const [adminName, setAdminName] = useState("");
    const [canSendMessages, setCanSendMessages] = useState(true);
    const [canSendImages, setCanSendImages] = useState(true);
    const [canSendFiles, setCanSendFiles] = useState(true);
    const [canDeleteMessages, setCanDeleteMessages] = useState(true);
    const [canAssignAdmins, setCanAssignAdmins] = useState(true);
    const [canModifyProfile, setCanModifyProfile] = useState(true);

    useEffect(() => {
        if (isOpen) {
            if (existingAdmin) {
                setAdminName(existingAdmin.admin_name || "");
                setCanSendMessages(existingAdmin.can_send_messages);
                setCanSendImages(existingAdmin.can_send_images);
                setCanSendFiles(existingAdmin.can_send_files);
                setCanDeleteMessages(existingAdmin.can_delete_messages);
                setCanAssignAdmins(existingAdmin.can_assign_admins);
                setCanModifyProfile(existingAdmin.can_modify_profile);
            } else {
                // Reset to defaults
                setAdminName("");
                setCanSendMessages(true);
                setCanSendImages(true);
                setCanSendFiles(true);
                setCanDeleteMessages(true);
                setCanAssignAdmins(true);
                setCanModifyProfile(true);
            }
        }
    }, [isOpen, existingAdmin]);

    function handleSave() {
        onSave({
            admin_name: adminName.trim() || null,
            can_send_messages: canSendMessages,
            can_send_images: canSendImages,
            can_send_files: canSendFiles,
            can_delete_messages: canDeleteMessages,
            can_assign_admins: canAssignAdmins,
            can_modify_profile: canModifyProfile
        });
        onOpenChange(false);
    }

    return (
        <StyledDialog
            open={isOpen}
            onOpenChange={onOpenChange}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <h2 style={{ margin: 0 }}>{existingAdmin ? "Edit Admin Rights" : "Make Admin"}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: "400px" }}>
                {username && (
                    <p style={{ margin: 0, color: "var(--mdui-color-on-surface-variant)" }}>
                        Configuring admin rights for: <strong>{username}</strong>
                    </p>
                )}

                <MaterialTextField
                    label="Custom Admin Name (optional)"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g., Moderator, Helper"
                />

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <h4 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>Permissions</h4>
                    
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>Send Messages</span>
                        <MaterialSwitch
                            checked={canSendMessages}
                            onChange={(e) => setCanSendMessages(e.target.checked)}
                        />
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>Send Images</span>
                        <MaterialSwitch
                            checked={canSendImages}
                            onChange={(e) => setCanSendImages(e.target.checked)}
                        />
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>Send Files</span>
                        <MaterialSwitch
                            checked={canSendFiles}
                            onChange={(e) => setCanSendFiles(e.target.checked)}
                        />
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>Delete Messages</span>
                        <MaterialSwitch
                            checked={canDeleteMessages}
                            onChange={(e) => setCanDeleteMessages(e.target.checked)}
                        />
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>Assign Admins</span>
                        <MaterialSwitch
                            checked={canAssignAdmins}
                            onChange={(e) => setCanAssignAdmins(e.target.checked)}
                        />
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>Modify Profile</span>
                        <MaterialSwitch
                            checked={canModifyProfile}
                            onChange={(e) => setCanModifyProfile(e.target.checked)}
                        />
                    </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                    <MaterialButton
                        variant="text"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </MaterialButton>
                    <MaterialButton
                        variant="filled"
                        onClick={handleSave}
                    >
                        {existingAdmin ? "Save" : "Make Admin"}
                    </MaterialButton>
                </div>
            </div>
            </div>
        </StyledDialog>
    );
}

