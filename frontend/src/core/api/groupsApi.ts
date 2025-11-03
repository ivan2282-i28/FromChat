import { API_BASE_URL } from "@/core/config";
import { getAuthHeaders } from "./authApi";
import type { Group, GroupMessage, GroupMember } from "@/core/types";

export interface CreateGroupRequest {
    name: string;
    username?: string | null;
    access_type: "public" | "private";
    description?: string | null;
}

export interface SendGroupMessageRequest {
    content: string;
    reply_to_id?: number | null;
}

export interface AssignGroupAdminRequest {
    user_id: number;
    admin_name?: string | null;
    can_send_messages: boolean;
    can_send_images: boolean;
    can_send_files: boolean;
    can_delete_messages: boolean;
    can_assign_admins: boolean;
    can_modify_profile: boolean;
}

export interface RestrictMemberRequest {
    user_id: number;
    can_send_messages: boolean;
    can_send_images: boolean;
    can_send_files: boolean;
    can_react: boolean;
    expires_at?: string | null;
}

export interface UpdateGroupProfileRequest {
    name?: string;
    description?: string | null;
    username?: string | null;
}

export async function createGroup(token: string, request: CreateGroupRequest): Promise<Group> {
    const res = await fetch(`${API_BASE_URL}/groups/create`, {
        method: "POST",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify(request)
    });
    if (!res.ok) throw new Error("Failed to create group");
    const data = await res.json();
    return data.group;
}

export async function getGroup(groupId: number, token: string): Promise<Group> {
    const res = await fetch(`${API_BASE_URL}/groups/${groupId}`, {
        headers: getAuthHeaders(token, true)
    });
    if (!res.ok) throw new Error("Failed to get group");
    const data = await res.json();
    return data.group;
}

export async function getGroupByUsername(username: string, token: string): Promise<Group> {
    const res = await fetch(`${API_BASE_URL}/groups/by-username/${username}`, {
        headers: getAuthHeaders(token, true)
    });
    if (!res.ok) throw new Error("Failed to get group");
    const data = await res.json();
    return data.group;
}

export async function joinGroup(groupId: number, token: string, inviteLink?: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/groups/${groupId}/join`, {
        method: "POST",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify({ invite_link: inviteLink })
    });
    if (!res.ok) throw new Error("Failed to join group");
}

export async function leaveGroup(groupId: number, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/groups/${groupId}/leave`, {
        method: "POST",
        headers: getAuthHeaders(token, true)
    });
    if (!res.ok) throw new Error("Failed to leave group");
}

export async function generateInviteLink(groupId: number, token: string): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/groups/${groupId}/invite-link`, {
        method: "POST",
        headers: getAuthHeaders(token, true)
    });
    if (!res.ok) throw new Error("Failed to generate invite link");
    const data = await res.json();
    return data.invite_link;
}

export async function getGroupMembers(groupId: number, token: string): Promise<GroupMember[]> {
    const res = await fetch(`${API_BASE_URL}/groups/${groupId}/members`, {
        headers: getAuthHeaders(token, true)
    });
    if (!res.ok) throw new Error("Failed to get group members");
    const data = await res.json();
    return data.members;
}

export async function banGroupMember(groupId: number, userId: number, token: string, bannedUntil?: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/groups/${groupId}/ban`, {
        method: "POST",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify({ user_id: userId, banned_until: bannedUntil })
    });
    if (!res.ok) throw new Error("Failed to ban member");
}

export async function restrictGroupMember(groupId: number, request: RestrictMemberRequest, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/groups/${groupId}/restrict`, {
        method: "POST",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify(request)
    });
    if (!res.ok) throw new Error("Failed to restrict member");
}

export async function assignGroupAdmin(groupId: number, request: AssignGroupAdminRequest, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/groups/${groupId}/admin`, {
        method: "POST",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify(request)
    });
    if (!res.ok) throw new Error("Failed to assign admin");
}

export async function updateGroupAdmin(groupId: number, adminId: number, request: AssignGroupAdminRequest, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/groups/${groupId}/admin/${adminId}`, {
        method: "PUT",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify(request)
    });
    if (!res.ok) throw new Error("Failed to update admin");
}

export async function sendGroupMessage(groupId: number, request: SendGroupMessageRequest, token: string, files: File[] = []): Promise<GroupMessage> {
    if (files.length === 0) {
        const res = await fetch(`${API_BASE_URL}/groups/${groupId}/messages`, {
            method: "POST",
            headers: getAuthHeaders(token, true),
            body: JSON.stringify(request)
        });
        if (!res.ok) throw new Error("Failed to send message");
        const data = await res.json();
        return data.message;
    } else {
        const form = new FormData();
        form.append("payload", JSON.stringify(request));
        for (const f of files) form.append("files", f, f.name);
        
        const res = await fetch(`${API_BASE_URL}/groups/${groupId}/messages`, {
            method: "POST",
            headers: getAuthHeaders(token, false),
            body: form
        });
        if (!res.ok) throw new Error("Failed to send message");
        const data = await res.json();
        return data.message;
    }
}

export async function getGroupMessages(groupId: number, token: string): Promise<GroupMessage[]> {
    const res = await fetch(`${API_BASE_URL}/groups/${groupId}/messages`, {
        headers: getAuthHeaders(token, true)
    });
    if (!res.ok) throw new Error("Failed to get messages");
    const data = await res.json();
    return data.messages;
}

export async function updateGroupProfile(groupId: number, request: UpdateGroupProfileRequest, token: string): Promise<Group> {
    const res = await fetch(`${API_BASE_URL}/groups/${groupId}`, {
        method: "PUT",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify(request)
    });
    if (!res.ok) throw new Error("Failed to update group profile");
    const data = await res.json();
    return data.group;
}

export async function deleteGroupMessage(groupId: number, messageId: number, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/groups/${groupId}/messages/${messageId}`, {
        method: "DELETE",
        headers: getAuthHeaders(token, true)
    });
    if (!res.ok) throw new Error("Failed to delete message");
}

export async function addGroupReaction(groupId: number, messageId: number, emoji: string, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/groups/${groupId}/add_reaction`, {
        method: "POST",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify({ message_id: messageId, emoji })
    });
    if (!res.ok) throw new Error("Failed to add reaction");
}

export async function listGroups(token: string): Promise<Group[]> {
    const res = await fetch(`${API_BASE_URL}/groups`, {
        headers: getAuthHeaders(token, true)
    });
    if (!res.ok) throw new Error("Failed to list groups");
    const data = await res.json();
    return data.groups || [];
}

