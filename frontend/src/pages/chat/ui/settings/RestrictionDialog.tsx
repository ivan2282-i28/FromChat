import { useState, useEffect } from "react";
import { StyledDialog } from "@/core/components/StyledDialog";
import { MaterialTextField, MaterialButton, MaterialSwitch } from "@/utils/material";
import type { MemberRestriction } from "@/core/types";

interface RestrictionDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (restriction: RestrictionData) => void;
    existingRestriction?: MemberRestriction | null;
    username?: string;
}

export interface RestrictionData {
    can_send_messages: boolean;
    can_send_images: boolean;
    can_send_files: boolean;
    can_react: boolean;
    expires_at?: string | null;
    duration?: string | null; // For UI: "permanent", "1h", "1d", "1w", etc.
}

export function RestrictionDialog({
    isOpen,
    onOpenChange,
    onSave,
    existingRestriction,
    username
}: RestrictionDialogProps) {
    const [canSendMessages, setCanSendMessages] = useState(false);
    const [canSendImages, setCanSendImages] = useState(false);
    const [canSendFiles, setCanSendFiles] = useState(false);
    const [canReact, setCanReact] = useState(true);
    const [restrictionType, setRestrictionType] = useState<"permanent" | "temporary">("permanent");
    const [duration, setDuration] = useState("1h");
    const [customDate, setCustomDate] = useState("");

    useEffect(() => {
        if (isOpen) {
            if (existingRestriction) {
                setCanSendMessages(existingRestriction.can_send_messages);
                setCanSendImages(existingRestriction.can_send_images);
                setCanSendFiles(existingRestriction.can_send_files);
                setCanReact(existingRestriction.can_react);
                
                if (existingRestriction.expires_at) {
                    setRestrictionType("temporary");
                    const expiresDate = new Date(existingRestriction.expires_at);
                    const now = new Date();
                    const diffMs = expiresDate.getTime() - now.getTime();
                    const diffHours = diffMs / (1000 * 60 * 60);
                    if (diffHours < 24) {
                        setDuration(`${Math.round(diffHours)}h`);
                    } else {
                        setCustomDate(expiresDate.toISOString().slice(0, 16));
                    }
                } else {
                    setRestrictionType("permanent");
                }
            } else {
                // Reset to defaults
                setCanSendMessages(false);
                setCanSendImages(false);
                setCanSendFiles(false);
                setCanReact(true);
                setRestrictionType("permanent");
                setDuration("1h");
                setCustomDate("");
            }
        }
    }, [isOpen, existingRestriction]);

    function calculateExpiresAt(): string | null {
        if (restrictionType === "permanent") {
            return null;
        }

        if (customDate) {
            return new Date(customDate).toISOString();
        }

        const now = new Date();
        let expiresAt = new Date(now);

        if (duration === "1h") {
            expiresAt.setHours(now.getHours() + 1);
        } else if (duration === "6h") {
            expiresAt.setHours(now.getHours() + 6);
        } else if (duration === "1d") {
            expiresAt.setDate(now.getDate() + 1);
        } else if (duration === "3d") {
            expiresAt.setDate(now.getDate() + 3);
        } else if (duration === "1w") {
            expiresAt.setDate(now.getDate() + 7);
        } else if (duration === "1m") {
            expiresAt.setMonth(now.getMonth() + 1);
        }

        return expiresAt.toISOString();
    }

    function handleSave() {
        const expiresAt = calculateExpiresAt();
        onSave({
            can_send_messages: canSendMessages,
            can_send_images: canSendImages,
            can_send_files: canSendFiles,
            can_react: canReact,
            expires_at: expiresAt,
            duration: restrictionType === "permanent" ? "permanent" : duration
        });
        onOpenChange(false);
    }

    return (
        <StyledDialog
            open={isOpen}
            onOpenChange={onOpenChange}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <h2 style={{ margin: 0 }}>{existingRestriction ? "Edit Restriction" : "Restrict Member"}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: "400px" }}>
                {username && (
                    <p style={{ margin: 0, color: "var(--mdui-color-on-surface-variant)" }}>
                        Restricting: <strong>{username}</strong>
                    </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <h4 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>Restrictions</h4>
                    
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
                        <span>React to Messages</span>
                        <MaterialSwitch
                            checked={canReact}
                            onChange={(e) => setCanReact(e.target.checked)}
                        />
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <h4 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>Duration</h4>
                    
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <MaterialButton
                            variant={restrictionType === "permanent" ? "filled" : "outlined"}
                            onClick={() => setRestrictionType("permanent")}
                        >
                            Permanent
                        </MaterialButton>
                        <MaterialButton
                            variant={restrictionType === "temporary" ? "filled" : "outlined"}
                            onClick={() => setRestrictionType("temporary")}
                        >
                            Temporary
                        </MaterialButton>
                    </div>

                    {restrictionType === "temporary" && (
                        <>
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                {["1h", "6h", "1d", "3d", "1w", "1m"].map((dur) => (
                                    <MaterialButton
                                        key={dur}
                                        variant={duration === dur ? "filled" : "outlined"}
                                        onClick={() => {
                                            setDuration(dur);
                                            setCustomDate("");
                                        }}
                                    >
                                        {dur}
                                    </MaterialButton>
                                ))}
                            </div>
                            
                            <MaterialTextField
                                label="Custom Date & Time"
                                type="datetime-local"
                                value={customDate}
                                onChange={(e) => {
                                    setCustomDate(e.target.value);
                                    if (e.target.value) setDuration("");
                                }}
                            />
                        </>
                    )}
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
                        {existingRestriction ? "Save" : "Restrict"}
                    </MaterialButton>
                </div>
            </div>
            </div>
        </StyledDialog>
    );
}

