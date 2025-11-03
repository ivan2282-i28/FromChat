import { API_BASE_URL } from "@/core/config";
import { getAuthHeaders } from "./authApi";
import type { Channel, ChannelMessage, ChannelSubscriber } from "@/core/types";

export interface CreateChannelRequest {
    name: string;
    username?: string | null;
    access_type: "public" | "private";
    description?: string | null;
}

export interface SendChannelMessageRequest {
    content: string;
    reply_to_id?: number | null;
}

export interface AssignChannelAdminRequest {
    user_id: number;
    admin_name?: string | null;
    can_send_messages: boolean;
    can_send_images: boolean;
    can_send_files: boolean;
    can_delete_messages: boolean;
    can_assign_admins: boolean;
    can_modify_profile: boolean;
}

export interface UpdateChannelProfileRequest {
    name?: string;
    description?: string | null;
    username?: string | null;
}

export async function createChannel(token: string, request: CreateChannelRequest): Promise<Channel> {
    const res = await fetch(`${API_BASE_URL}/channels/create`, {
        method: "POST",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify(request)
    });
    if (!res.ok) throw new Error("Failed to create channel");
    const data = await res.json();
    return data.channel;
}

export async function getChannel(channelId: number, token: string): Promise<Channel> {
    const res = await fetch(`${API_BASE_URL}/channels/${channelId}`, {
        headers: getAuthHeaders(token, true)
    });
    if (!res.ok) throw new Error("Failed to get channel");
    const data = await res.json();
    return data.channel;
}

export async function getChannelByUsername(username: string, token: string): Promise<Channel> {
    const res = await fetch(`${API_BASE_URL}/channels/by-username/${username}`, {
        headers: getAuthHeaders(token, true)
    });
    if (!res.ok) throw new Error("Failed to get channel");
    const data = await res.json();
    return data.channel;
}

export async function subscribeToChannel(channelId: number, token: string, inviteLink?: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/channels/${channelId}/subscribe`, {
        method: "POST",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify({ invite_link: inviteLink })
    });
    if (!res.ok) throw new Error("Failed to subscribe");
}

export async function unsubscribeFromChannel(channelId: number, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/channels/${channelId}/unsubscribe`, {
        method: "POST",
        headers: getAuthHeaders(token, true)
    });
    if (!res.ok) throw new Error("Failed to unsubscribe");
}

export async function getChannelSubscribers(channelId: number, token: string): Promise<{ subscribers: ChannelSubscriber[], count: number }> {
    const res = await fetch(`${API_BASE_URL}/channels/${channelId}/subscribers`, {
        headers: getAuthHeaders(token, true)
    });
    if (!res.ok) throw new Error("Failed to get subscribers");
    const data = await res.json();
    return { subscribers: data.subscribers || [], count: data.count || 0 };
}

export async function assignChannelAdmin(channelId: number, request: AssignChannelAdminRequest, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/channels/${channelId}/admin`, {
        method: "POST",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify(request)
    });
    if (!res.ok) throw new Error("Failed to assign admin");
}

export async function updateChannelAdmin(channelId: number, adminId: number, request: AssignChannelAdminRequest, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/channels/${channelId}/admin/${adminId}`, {
        method: "PUT",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify(request)
    });
    if (!res.ok) throw new Error("Failed to update admin");
}

export async function sendChannelMessage(channelId: number, request: SendChannelMessageRequest, token: string, files: File[] = []): Promise<ChannelMessage> {
    if (files.length === 0) {
        const res = await fetch(`${API_BASE_URL}/channels/${channelId}/messages`, {
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
        
        const res = await fetch(`${API_BASE_URL}/channels/${channelId}/messages`, {
            method: "POST",
            headers: getAuthHeaders(token, false),
            body: form
        });
        if (!res.ok) throw new Error("Failed to send message");
        const data = await res.json();
        return data.message;
    }
}

export async function getChannelMessages(channelId: number, token: string): Promise<ChannelMessage[]> {
    const res = await fetch(`${API_BASE_URL}/channels/${channelId}/messages`, {
        headers: getAuthHeaders(token, true)
    });
    if (!res.ok) throw new Error("Failed to get messages");
    const data = await res.json();
    return data.messages;
}

export async function updateChannelProfile(channelId: number, request: UpdateChannelProfileRequest, token: string): Promise<Channel> {
    const res = await fetch(`${API_BASE_URL}/channels/${channelId}`, {
        method: "PUT",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify(request)
    });
    if (!res.ok) throw new Error("Failed to update channel profile");
    const data = await res.json();
    return data.channel;
}

export async function deleteChannelMessage(channelId: number, messageId: number, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/channels/${channelId}/messages/${messageId}`, {
        method: "DELETE",
        headers: getAuthHeaders(token, true)
    });
    if (!res.ok) throw new Error("Failed to delete message");
}

export async function addChannelReaction(channelId: number, messageId: number, emoji: string, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/channels/${channelId}/add_reaction`, {
        method: "POST",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify({ message_id: messageId, emoji })
    });
    if (!res.ok) throw new Error("Failed to add reaction");
}

export async function listChannels(token: string): Promise<Channel[]> {
    const res = await fetch(`${API_BASE_URL}/channels`, {
        headers: getAuthHeaders(token, true)
    });
    if (!res.ok) throw new Error("Failed to list channels");
    const data = await res.json();
    return data.channels || [];
}

