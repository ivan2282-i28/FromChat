from datetime import datetime
import logging
from pathlib import Path
import os
import re
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from dependencies import get_current_user, get_db
from .account import convert_user
from models import (
    Channel, ChannelSubscriber, ChannelMessage, ChannelMessageFile, ChannelAdmin, 
    ChannelReaction, User, generate_invite_link
)
from permissions import (
    check_is_admin_channel, check_is_subscribed_channel, check_can_send_message_channel,
    check_can_delete_message_channel, check_can_modify_profile_channel,
    check_can_assign_admins_channel, check_can_react_channel, check_username_unique
)
from .messaging import filter_profanity, messagingManager, FILES_NORMAL_DIR, MAX_TOTAL_SIZE
from push_service import push_service
from PIL import Image
import io
import json

router = APIRouter()
logger = logging.getLogger("uvicorn.error")


def convert_channel_message(msg: ChannelMessage) -> dict:
    """Convert ChannelMessage to dict with anonymous reactions (no user info)"""
    reactions_dict = {}
    if msg.reactions:
        for reaction in msg.reactions:
            emoji = reaction.emoji
            if emoji not in reactions_dict:
                reactions_dict[emoji] = {
                    "emoji": emoji,
                    "count": 0,
                    "users": []  # Empty for anonymous reactions in channels
                }
            reactions_dict[emoji]["count"] += 1
            # Don't add user info for channels - reactions are anonymous
    
    # Handle deleted users
    if msg.author.deleted:
        username = f"Deleted User #{msg.author.id}"
        profile_picture = None
        verified = False
    else:
        username = msg.author.display_name
        profile_picture = msg.author.profile_picture
        verified = msg.author.verified
    
    return {
        "id": msg.id,
        "user_id": msg.author.id,
        "content": msg.content,
        "timestamp": msg.timestamp.isoformat(),
        "is_edited": msg.is_edited,
        "username": username,
        "profile_picture": profile_picture,
        "verified": verified,
        "reply_to": convert_channel_message(msg.reply_to) if msg.reply_to else None,
        "reactions": list(reactions_dict.values()),
        "files": [
            {
                "path": f"/api/uploads/files/normal/{Path(f.path).name}",
                "id": f.id,
                "name": f.name,
                "message_id": f.message_id
            }
            for f in (msg.files or [])
        ]
    }


def convert_channel(channel: Channel, current_user_id: int = None, db: Session = None) -> dict:
    """Convert Channel to dict"""
    is_subscribed = False
    is_admin = False
    
    if current_user_id and db:
        is_subscribed = check_is_subscribed_channel(channel.id, current_user_id, db)
        is_admin = check_is_admin_channel(channel.id, current_user_id, db)
    
    return {
        "id": channel.id,
        "name": channel.name,
        "username": channel.username,
        "owner_id": channel.owner_id,
        "access_type": channel.access_type,
        "invite_link": channel.invite_link,
        "description": channel.description,
        "profile_picture": channel.profile_picture,
        "subscriber_count": channel.subscriber_count,
        "created_at": channel.created_at.isoformat() if channel.created_at else None,
        "is_subscribed": is_subscribed,
        "is_admin": is_admin
    }


# Request models
class CreateChannelRequest(BaseModel):
    name: str
    username: str | None = None
    access_type: str = "public"
    description: str | None = None


class SendChannelMessageRequest(BaseModel):
    content: str
    reply_to_id: int | None = None


class EditChannelMessageRequest(BaseModel):
    content: str


class AssignChannelAdminRequest(BaseModel):
    user_id: int
    admin_name: str | None = None
    can_send_messages: bool = True
    can_send_images: bool = True
    can_send_files: bool = True
    can_delete_messages: bool = True
    can_assign_admins: bool = True
    can_modify_profile: bool = True


class UpdateChannelProfileRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    username: str | None = None


class ChannelReactionRequest(BaseModel):
    message_id: int
    emoji: str


# Routes
@router.post("/channels/create")
async def create_channel(
    request: CreateChannelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new channel"""
    if request.access_type not in ["public", "private"]:
        raise HTTPException(status_code=400, detail="Invalid access_type")
    
    if request.access_type == "public":
        if not request.username:
            raise HTTPException(status_code=400, detail="Username required for public channels")
        
        is_unique, entity_type = check_username_unique(request.username, db)
        if not is_unique:
            raise HTTPException(status_code=400, detail=f"Username already taken by {entity_type}")
    
    invite_link = None
    if request.access_type == "private":
        invite_link = generate_invite_link()
        while db.query(Channel).filter(Channel.invite_link == invite_link).first():
            invite_link = generate_invite_link()
    
    channel = Channel(
        name=request.name,
        username=request.username,
        owner_id=current_user.id,
        access_type=request.access_type,
        invite_link=invite_link,
        description=request.description,
        subscriber_count=0
    )
    db.add(channel)
    db.commit()
    db.refresh(channel)
    
    # Add owner as admin
    admin = ChannelAdmin(
        channel_id=channel.id,
        user_id=current_user.id,
        admin_name="owner",
        can_send_messages=True,
        can_send_images=True,
        can_send_files=True,
        can_delete_messages=True,
        can_assign_admins=True,
        can_modify_profile=True
    )
    db.add(admin)
    db.commit()
    
    return {"status": "success", "channel": convert_channel(channel, current_user.id, db)}


@router.get("/channels/{channel_id}")
async def get_channel(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get channel info"""
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    return {"status": "success", "channel": convert_channel(channel, current_user.id, db)}


@router.get("/channels/by-username/{username}")
async def get_channel_by_username(
    username: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Find channel by username"""
    channel = db.query(Channel).filter(Channel.username == username).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    return {"status": "success", "channel": convert_channel(channel, current_user.id, db)}


@router.post("/channels/{channel_id}/subscribe")
async def subscribe_to_channel(
    channel_id: int,
    invite_link: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Subscribe to a channel"""
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    existing_sub = db.query(ChannelSubscriber).filter(
        ChannelSubscriber.channel_id == channel_id,
        ChannelSubscriber.user_id == current_user.id
    ).first()
    
    if existing_sub:
        return {"status": "success", "message": "Already subscribed"}
    
    if channel.access_type == "private":
        if not invite_link or invite_link != channel.invite_link:
            raise HTTPException(status_code=403, detail="Invalid invite link")
    
    subscriber = ChannelSubscriber(
        channel_id=channel_id,
        user_id=current_user.id
    )
    db.add(subscriber)
    
    # Update subscriber count
    channel.subscriber_count = db.query(ChannelSubscriber).filter(
        ChannelSubscriber.channel_id == channel_id
    ).count()
    db.commit()
    
    try:
        await messagingManager.broadcast({
            "type": "channelSubscribed",
            "data": {
                "channel_id": channel_id,
                "user_id": current_user.id,
                "username": current_user.username,
                "subscriber_count": channel.subscriber_count
            }
        })
    except Exception:
        pass
    
    return {"status": "success", "message": "Subscribed"}


@router.post("/channels/{channel_id}/unsubscribe")
async def unsubscribe_from_channel(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unsubscribe from a channel"""
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    subscriber = db.query(ChannelSubscriber).filter(
        ChannelSubscriber.channel_id == channel_id,
        ChannelSubscriber.user_id == current_user.id
    ).first()
    
    if not subscriber:
        raise HTTPException(status_code=404, detail="Not subscribed to this channel")
    
    db.delete(subscriber)
    
    # Update subscriber count
    channel.subscriber_count = db.query(ChannelSubscriber).filter(
        ChannelSubscriber.channel_id == channel_id
    ).count()
    db.commit()
    
    try:
        await messagingManager.broadcast({
            "type": "channelUnsubscribed",
            "data": {
                "channel_id": channel_id,
                "user_id": current_user.id,
                "username": current_user.username,
                "subscriber_count": channel.subscriber_count
            }
        })
    except Exception:
        pass
    
    return {"status": "success", "message": "Unsubscribed"}


@router.get("/channels/{channel_id}/subscribers")
async def get_channel_subscribers(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get channel subscribers (admin only for full list)"""
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    is_admin = check_is_admin_channel(channel_id, current_user.id, db)
    
    if is_admin:
        subscribers = db.query(ChannelSubscriber).filter(ChannelSubscriber.channel_id == channel_id).all()
        result = []
        for sub in subscribers:
            user = db.query(User).filter(User.id == sub.user_id).first()
            if user:
                result.append({
                    "user": convert_user(user),
                    "subscribed_at": sub.subscribed_at.isoformat() if sub.subscribed_at else None
                })
        return {"status": "success", "subscribers": result, "count": channel.subscriber_count}
    else:
        return {"status": "success", "count": channel.subscriber_count, "subscribers": []}


@router.post("/channels/{channel_id}/admin")
async def assign_channel_admin(
    channel_id: int,
    request: AssignChannelAdminRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Assign admin to channel"""
    if not check_can_assign_admins_channel(channel_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # User should be subscribed first
    if not check_is_subscribed_channel(channel_id, request.user_id, db):
        raise HTTPException(status_code=400, detail="User must be subscribed first")
    
    admin = db.query(ChannelAdmin).filter(
        ChannelAdmin.channel_id == channel_id,
        ChannelAdmin.user_id == request.user_id
    ).first()
    
    if admin:
        admin.admin_name = request.admin_name
        admin.can_send_messages = request.can_send_messages
        admin.can_send_images = request.can_send_images
        admin.can_send_files = request.can_send_files
        admin.can_delete_messages = request.can_delete_messages
        admin.can_assign_admins = request.can_assign_admins
        admin.can_modify_profile = request.can_modify_profile
    else:
        admin = ChannelAdmin(
            channel_id=channel_id,
            user_id=request.user_id,
            admin_name=request.admin_name,
            can_send_messages=request.can_send_messages,
            can_send_images=request.can_send_images,
            can_send_files=request.can_send_files,
            can_delete_messages=request.can_delete_messages,
            can_assign_admins=request.can_assign_admins,
            can_modify_profile=request.can_modify_profile
        )
        db.add(admin)
    
    db.commit()
    
    return {"status": "success", "message": "Admin assigned"}


@router.put("/channels/{channel_id}/admin/{admin_id}")
async def update_channel_admin(
    channel_id: int,
    admin_id: int,
    request: AssignChannelAdminRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update channel admin rights"""
    if not check_can_assign_admins_channel(channel_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    admin = db.query(ChannelAdmin).filter(
        ChannelAdmin.id == admin_id,
        ChannelAdmin.channel_id == channel_id
    ).first()
    
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    admin.admin_name = request.admin_name
    admin.can_send_messages = request.can_send_messages
    admin.can_send_images = request.can_send_images
    admin.can_send_files = request.can_send_files
    admin.can_delete_messages = request.can_delete_messages
    admin.can_assign_admins = request.can_assign_admins
    admin.can_modify_profile = request.can_modify_profile
    db.commit()
    
    return {"status": "success", "message": "Admin updated"}


@router.post("/channels/{channel_id}/messages")
async def send_channel_message(
    channel_id: int,
    request: SendChannelMessageRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    payload: str | None = Form(default=None),
    files: list[UploadFile] = File(default=[]),
):
    """Send a message to a channel (admin only)"""
    can_send, reason = check_can_send_message_channel(channel_id, current_user.id, db)
    if not can_send:
        raise HTTPException(status_code=403, detail=reason)
    
    if payload and request is None:
        try:
            obj = json.loads(payload)
            content = obj.get("content", "")
            reply_to_id = obj.get("reply_to_id", None)
            request = SendChannelMessageRequest(content=content, reply_to_id=reply_to_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid payload JSON")
    
    if request.reply_to_id:
        original_message = db.query(ChannelMessage).filter(ChannelMessage.id == request.reply_to_id).first()
        if not original_message:
            raise HTTPException(status_code=404, detail="Original message not found")
    
    if not request.content.strip() and not files:
        raise HTTPException(status_code=400, detail="No content provided")
    
    filtered_content = filter_profanity(request.content.strip()) if request.content else ""
    
    if filtered_content and len(filtered_content) > 4096:
        raise HTTPException(status_code=400, detail="Message too long")
    
    new_message = ChannelMessage(
        content=filtered_content,
        user_id=current_user.id,
        channel_id=channel_id,
        reply_to_id=request.reply_to_id,
        timestamp=datetime.now()
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    # Handle files
    if files:
        total_size = 0
        for up in files:
            if hasattr(up, "size") and up.size is not None:
                total_size += int(up.size)
            else:
                data = await up.read()
                up.file.seek(0)
                total_size += len(data)
            if total_size > MAX_TOTAL_SIZE:
                raise HTTPException(status_code=400, detail="Total attachments size exceeds 4GB")
        
        for up in files:
            original_name = Path(up.filename or "file").name
            ext = Path(original_name).suffix.lower()
            uid = uuid.uuid4().hex
            safe_name = f"{new_message.id}_{uid}{ext or ''}"
            out_path = FILES_NORMAL_DIR / safe_name
            
            content = await up.read()
            up.file.seek(0)
            
            try:
                if up.content_type and up.content_type.startswith("image/"):
                    image = Image.open(io.BytesIO(content))
                    img_format = image.format or ("PNG" if ext == ".png" else "JPEG")
                    buf = io.BytesIO()
                    save_kwargs = {"optimize": True}
                    if img_format.upper() == "JPEG":
                        save_kwargs["quality"] = 95
                    image.save(buf, format=img_format, **save_kwargs)
                    buf.seek(0)
                    content = buf.read()
            except Exception:
                pass
            
            with open(out_path, "wb") as f:
                f.write(content)
            
            mf = ChannelMessageFile(
                message_id=new_message.id,
                name=original_name,
                path=str(out_path)
            )
            db.add(mf)
        db.commit()
        db.refresh(new_message)
    
    # Send push notifications to all subscribers
    try:
        channel = db.query(Channel).filter(Channel.id == channel_id).first()
        if channel:
            await push_service.send_channel_message_notification(db, new_message, channel, exclude_user_id=current_user.id)
    except Exception as e:
        logger.error(f"Failed to send push notification for channel message {new_message.id}: {e}")
    
    # Broadcast via WebSocket
    try:
        await messagingManager.broadcast({
            "type": "channelNew",
            "data": {
                "channel_id": channel_id,
                "message": convert_channel_message(new_message)
            }
        })
    except Exception:
        pass
    
    return {"status": "success", "message": convert_channel_message(new_message)}


@router.get("/channels/{channel_id}/messages")
async def get_channel_messages(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get messages from a channel (subscribers only)"""
    if not check_is_subscribed_channel(channel_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Not subscribed to this channel")
    
    messages = db.query(ChannelMessage).filter(ChannelMessage.channel_id == channel_id).order_by(ChannelMessage.timestamp.asc()).all()
    
    messages_data = []
    for msg in messages:
        messages_data.append(convert_channel_message(msg))
    
    return {"status": "success", "messages": messages_data}


@router.put("/channels/{channel_id}")
async def update_channel_profile(
    channel_id: int,
    request: UpdateChannelProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update channel profile"""
    if not check_can_modify_profile_channel(channel_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if request.name:
        channel.name = request.name
    if request.description is not None:
        channel.description = request.description
    if request.username:
        is_unique, entity_type = check_username_unique(request.username, db, exclude_channel_id=channel_id)
        if not is_unique:
            raise HTTPException(status_code=400, detail=f"Username already taken by {entity_type}")
        channel.username = request.username
    
    db.commit()
    db.refresh(channel)
    
    try:
        await messagingManager.broadcast({
            "type": "channelUpdated",
            "data": {
                "channel_id": channel_id,
                "channel": convert_channel(channel, current_user.id, db)
            }
        })
    except Exception:
        pass
    
    return {"status": "success", "channel": convert_channel(channel, current_user.id, db)}


@router.delete("/channels/{channel_id}/messages/{message_id}")
async def delete_channel_message(
    channel_id: int,
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a channel message"""
    can_delete, reason = check_can_delete_message_channel(channel_id, message_id, current_user.id, db)
    if not can_delete:
        raise HTTPException(status_code=403, detail=reason)
    
    message = db.query(ChannelMessage).filter(ChannelMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    db.delete(message)
    db.commit()
    
    try:
        await messagingManager.broadcast({
            "type": "channelMessageDeleted",
            "data": {
                "channel_id": channel_id,
                "message_id": message_id
            }
        })
    except Exception:
        pass
    
    return {"status": "success", "message_id": message_id}


@router.post("/channels/{channel_id}/add_reaction")
async def add_channel_reaction(
    channel_id: int,
    request: ChannelReactionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add reaction to channel message (anonymous)"""
    if not check_can_react_channel(channel_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Cannot react to messages")
    
    message = db.query(ChannelMessage).filter(ChannelMessage.id == request.message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message.channel_id != channel_id:
        raise HTTPException(status_code=400, detail="Message does not belong to this channel")
    
    existing_reaction = db.query(ChannelReaction).filter(
        ChannelReaction.message_id == request.message_id,
        ChannelReaction.user_id == current_user.id,
        ChannelReaction.emoji == request.emoji
    ).first()
    
    if existing_reaction:
        db.delete(existing_reaction)
        action = "removed"
    else:
        new_reaction = ChannelReaction(
            message_id=request.message_id,
            user_id=current_user.id,
            emoji=request.emoji
        )
        db.add(new_reaction)
        action = "added"
    
    db.commit()
    db.refresh(message)
    
    try:
        await messagingManager.broadcast({
            "type": "channelReactionUpdate",
            "data": {
                "channel_id": channel_id,
                "message_id": request.message_id,
                "emoji": request.emoji,
                "action": action,
                "reactions": convert_channel_message(message)["reactions"]
            }
        })
    except Exception:
        pass
    
    return {"status": "success", "action": action, "reactions": convert_channel_message(message)["reactions"]}


@router.get("/channels")
async def list_channels(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all public channels"""
    channels = db.query(Channel).filter(Channel.access_type == "public").all()
    
    result = []
    for channel in channels:
        result.append(convert_channel(channel, current_user.id, db))
    
    return {"status": "success", "channels": result}

