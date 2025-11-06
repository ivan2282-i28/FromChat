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
    Group, GroupMember, GroupMessage, GroupMessageFile, GroupAdmin, 
    GroupMemberRestriction, GroupReaction, User, generate_invite_link
)
from permissions import (
    check_is_admin_group, check_is_member_group, check_can_send_message_group,
    check_can_delete_message_group, check_can_modify_profile_group,
    check_can_assign_admins_group, check_can_react_group, check_username_unique
)
from .messaging import filter_profanity, messagingManager, FILES_NORMAL_DIR, MAX_TOTAL_SIZE
from push_service import push_service
from PIL import Image
import io
import json

router = APIRouter()
logger = logging.getLogger("uvicorn.error")


def convert_group_message(msg: GroupMessage) -> dict:
    """Convert GroupMessage to dict with reactions"""
    reactions_dict = {}
    if msg.reactions:
        for reaction in msg.reactions:
            emoji = reaction.emoji
            if emoji not in reactions_dict:
                reactions_dict[emoji] = {
                    "emoji": emoji,
                    "count": 0,
                    "users": []
                }
            reactions_dict[emoji]["count"] += 1
            reactions_dict[emoji]["users"].append({
                "id": reaction.user_id,
                "username": reaction.user.display_name
            })
    
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
        "reply_to": convert_group_message(msg.reply_to) if msg.reply_to else None,
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


def convert_group(group: Group, current_user_id: int = None, db: Session = None) -> dict:
    """Convert Group to dict"""
    member_count = len(group.members) if group.members else 0
    is_member = False
    is_admin = False
    
    if current_user_id and db:
        is_member = check_is_member_group(group.id, current_user_id, db)
        is_admin = check_is_admin_group(group.id, current_user_id, db)
    
    return {
        "id": group.id,
        "name": group.name,
        "username": group.username,
        "owner_id": group.owner_id,
        "access_type": group.access_type,
        "invite_link": group.invite_link,
        "description": group.description,
        "profile_picture": group.profile_picture,
        "created_at": group.created_at.isoformat() if group.created_at else None,
        "member_count": member_count,
        "is_member": is_member,
        "is_admin": is_admin
    }


# Request models
class CreateGroupRequest(BaseModel):
    name: str
    username: str | None = None
    access_type: str = "public"  # "public" or "private"
    description: str | None = None


class SendGroupMessageRequest(BaseModel):
    content: str
    reply_to_id: int | None = None


class EditGroupMessageRequest(BaseModel):
    content: str


class AssignAdminRequest(BaseModel):
    user_id: int
    admin_name: str | None = None
    can_send_messages: bool = True
    can_send_images: bool = True
    can_send_files: bool = True
    can_delete_messages: bool = True
    can_assign_admins: bool = True
    can_modify_profile: bool = True


class RestrictMemberRequest(BaseModel):
    user_id: int
    can_send_messages: bool = False
    can_send_images: bool = False
    can_send_files: bool = False
    can_react: bool = True
    expires_at: datetime | None = None


class UpdateGroupProfileRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    username: str | None = None


class GroupReactionRequest(BaseModel):
    message_id: int
    emoji: str


# Routes
@router.post("/groups/create")
async def create_group(
    request: CreateGroupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new group"""
    # Validate access type
    if request.access_type not in ["public", "private"]:
        raise HTTPException(status_code=400, detail="Invalid access_type. Must be 'public' or 'private'")
    
    # Validate username if provided
    if request.access_type == "public":
        if not request.username:
            raise HTTPException(status_code=400, detail="Username required for public groups")
        
        # Check username uniqueness
        is_unique, entity_type = check_username_unique(request.username, db)
        if not is_unique:
            raise HTTPException(status_code=400, detail=f"Username already taken by {entity_type}")
    
    # Generate invite link for private groups
    invite_link = None
    if request.access_type == "private":
        invite_link = generate_invite_link()
        # Ensure uniqueness
        while db.query(Group).filter(Group.invite_link == invite_link).first():
            invite_link = generate_invite_link()
    
    # Create group
    group = Group(
        name=request.name,
        username=request.username,
        owner_id=current_user.id,
        access_type=request.access_type,
        invite_link=invite_link,
        description=request.description
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    
    # Add owner as member and admin
    member = GroupMember(
        group_id=group.id,
        user_id=current_user.id,
        role="owner"
    )
    db.add(member)
    
    admin = GroupAdmin(
        group_id=group.id,
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
    
    return {"status": "success", "group": convert_group(group, current_user.id, db)}


@router.get("/groups/my")
async def get_my_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get groups the current user has joined"""
    members = db.query(GroupMember).filter(
        GroupMember.user_id == current_user.id,
        GroupMember.is_banned == False
    ).all()
    
    result = []
    for member in members:
        group = db.query(Group).filter(Group.id == member.group_id).first()
        if group:
            result.append(convert_group(group, current_user.id, db))
    
    return {"status": "success", "groups": result}


@router.get("/groups/{group_id}")
async def get_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get group info"""
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    return {"status": "success", "group": convert_group(group, current_user.id, db)}


@router.get("/groups/by-username/{username}")
async def get_group_by_username(
    username: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Find group by username"""
    group = db.query(Group).filter(Group.username == username).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    return {"status": "success", "group": convert_group(group, current_user.id, db)}


@router.post("/groups/{group_id}/join")
async def join_group(
    group_id: int,
    invite_link: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Join a group (public or via invite link)"""
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if already a member
    existing_member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id
    ).first()
    
    if existing_member:
        if existing_member.is_banned:
            raise HTTPException(status_code=403, detail="You are banned from this group")
        return {"status": "success", "message": "Already a member"}
    
    # Check access
    if group.access_type == "private":
        if not invite_link or invite_link != group.invite_link:
            raise HTTPException(status_code=403, detail="Invalid invite link")
    
    # Add as member
    member = GroupMember(
        group_id=group_id,
        user_id=current_user.id,
        role="member"
    )
    db.add(member)
    db.commit()
    
    # Notify via WebSocket
    try:
        await messagingManager.broadcast({
            "type": "groupMemberAdded",
            "data": {
                "group_id": group_id,
                "user_id": current_user.id,
                "username": current_user.username
            }
        })
    except Exception:
        pass
    
    return {"status": "success", "message": "Joined group"}


@router.post("/groups/{group_id}/leave")
async def leave_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Leave a group"""
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if owner
    if group.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="Owner cannot leave group")
    
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="Not a member of this group")
    
    # Remove admin rights if any
    admin = db.query(GroupAdmin).filter(
        GroupAdmin.group_id == group_id,
        GroupAdmin.user_id == current_user.id
    ).first()
    if admin:
        db.delete(admin)
    
    # Remove restrictions
    restriction = db.query(GroupMemberRestriction).filter(
        GroupMemberRestriction.group_id == group_id,
        GroupMemberRestriction.user_id == current_user.id
    ).first()
    if restriction:
        db.delete(restriction)
    
    db.delete(member)
    db.commit()
    
    # Notify via WebSocket
    try:
        await messagingManager.broadcast({
            "type": "groupMemberRemoved",
            "data": {
                "group_id": group_id,
                "user_id": current_user.id,
                "username": current_user.username
            }
        })
    except Exception:
        pass
    
    return {"status": "success", "message": "Left group"}


@router.post("/groups/{group_id}/invite-link")
async def generate_invite_link_for_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate or regenerate invite link for private group"""
    if not check_is_admin_group(group_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if group.access_type != "private":
        raise HTTPException(status_code=400, detail="Only private groups can have invite links")
    
    # Generate new link
    new_link = generate_invite_link()
    while db.query(Group).filter(Group.invite_link == new_link).first():
        new_link = generate_invite_link()
    
    group.invite_link = new_link
    db.commit()
    
    return {"status": "success", "invite_link": new_link}


@router.get("/groups/{group_id}/members")
async def get_group_members(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List group members"""
    if not check_is_member_group(group_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    members = db.query(GroupMember).filter(GroupMember.group_id == group_id).all()
    
    result = []
    for member in members:
        user = db.query(User).filter(User.id == member.user_id).first()
        if user:
            admin = db.query(GroupAdmin).filter(
                GroupAdmin.group_id == group_id,
                GroupAdmin.user_id == member.user_id
            ).first()
            
            result.append({
                "user": convert_user(user),
                "role": member.role,
                "joined_at": member.joined_at.isoformat() if member.joined_at else None,
                "is_banned": member.is_banned,
                "admin": {
                    "admin_name": admin.admin_name,
                    "can_send_messages": admin.can_send_messages,
                    "can_send_images": admin.can_send_images,
                    "can_send_files": admin.can_send_files,
                    "can_delete_messages": admin.can_delete_messages,
                    "can_assign_admins": admin.can_assign_admins,
                    "can_modify_profile": admin.can_modify_profile
                } if admin else None
            })
    
    return {"status": "success", "members": result}


@router.post("/groups/{group_id}/ban")
async def ban_group_member(
    group_id: int,
    user_id: int,
    banned_until: datetime | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ban a group member"""
    if not check_is_admin_group(group_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Can't ban owner
    if group.owner_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot ban owner")
    
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="User is not a member")
    
    member.is_banned = True
    member.banned_until = banned_until
    db.commit()
    
    return {"status": "success", "message": "Member banned"}


@router.post("/groups/{group_id}/restrict")
async def restrict_group_member(
    group_id: int,
    request: RestrictMemberRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Temporarily restrict member rights"""
    if not check_is_admin_group(group_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == request.user_id
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="User is not a member")
    
    # Update or create restriction
    restriction = db.query(GroupMemberRestriction).filter(
        GroupMemberRestriction.group_id == group_id,
        GroupMemberRestriction.user_id == request.user_id
    ).first()
    
    if restriction:
        restriction.can_send_messages = request.can_send_messages
        restriction.can_send_images = request.can_send_images
        restriction.can_send_files = request.can_send_files
        restriction.can_react = request.can_react
        restriction.expires_at = request.expires_at
        restriction.restricted_by = current_user.id
    else:
        restriction = GroupMemberRestriction(
            group_id=group_id,
            user_id=request.user_id,
            can_send_messages=request.can_send_messages,
            can_send_images=request.can_send_images,
            can_send_files=request.can_send_files,
            can_react=request.can_react,
            expires_at=request.expires_at,
            restricted_by=current_user.id
        )
        db.add(restriction)
    
    db.commit()
    
    # Notify via WebSocket
    try:
        await messagingManager.broadcast({
            "type": "groupMemberRestricted",
            "data": {
                "group_id": group_id,
                "user_id": request.user_id,
                "expires_at": request.expires_at.isoformat() if request.expires_at else None
            }
        })
    except Exception:
        pass
    
    return {"status": "success", "message": "Member restricted"}


@router.post("/groups/{group_id}/admin")
async def assign_group_admin(
    group_id: int,
    request: AssignAdminRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Assign admin to group"""
    if not check_can_assign_admins_group(group_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if user is a member
    if not check_is_member_group(group_id, request.user_id, db):
        raise HTTPException(status_code=400, detail="User must be a member first")
    
    # Update member role
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == request.user_id
    ).first()
    member.role = "admin"
    
    # Create or update admin record
    admin = db.query(GroupAdmin).filter(
        GroupAdmin.group_id == group_id,
        GroupAdmin.user_id == request.user_id
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
        admin = GroupAdmin(
            group_id=group_id,
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


@router.put("/groups/{group_id}/admin/{admin_id}")
async def update_group_admin(
    group_id: int,
    admin_id: int,
    request: AssignAdminRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update admin rights"""
    if not check_can_assign_admins_group(group_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    admin = db.query(GroupAdmin).filter(
        GroupAdmin.id == admin_id,
        GroupAdmin.group_id == group_id
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


@router.post("/groups/{group_id}/messages")
async def send_group_message(
    group_id: int,
    request: SendGroupMessageRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    payload: str | None = Form(default=None),
    files: list[UploadFile] = File(default=[]),
):
    """Send a message to a group"""
    # Check permissions
    can_send, reason = check_can_send_message_group(group_id, current_user.id, db)
    if not can_send:
        raise HTTPException(status_code=403, detail=reason)
    
    if payload and request is None:
        try:
            obj = json.loads(payload)
            content = obj.get("content", "")
            reply_to_id = obj.get("reply_to_id", None)
            request = SendGroupMessageRequest(content=content, reply_to_id=reply_to_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid payload JSON")
    
    # If request is still None, create a default one
    if request is None:
        request = SendGroupMessageRequest(content="", reply_to_id=None)
    
    if request.reply_to_id:
        original_message = db.query(GroupMessage).filter(GroupMessage.id == request.reply_to_id).first()
        if not original_message:
            raise HTTPException(status_code=404, detail="Original message not found")
    
    if not request.content or (not request.content.strip() and not files):
        raise HTTPException(status_code=400, detail="No content provided")
    
    # Apply profanity filter
    filtered_content = filter_profanity(request.content.strip()) if (request.content and request.content.strip()) else ""
    
    if filtered_content and len(filtered_content) > 4096:
        raise HTTPException(status_code=400, detail="Message too long")
    
    new_message = GroupMessage(
        content=filtered_content,
        user_id=current_user.id,
        group_id=group_id,
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
            
            mf = GroupMessageFile(
                message_id=new_message.id,
                name=original_name,
                path=str(out_path)
            )
            db.add(mf)
        db.commit()
        db.refresh(new_message)
    
    # Send push notifications
    try:
        group = db.query(Group).filter(Group.id == group_id).first()
        if group:
            await push_service.send_group_message_notification(db, new_message, group, exclude_user_id=current_user.id)
    except Exception as e:
        logger.error(f"Failed to send push notification for group message {new_message.id}: {e}")
    
    # Broadcast via WebSocket
    try:
        await messagingManager.broadcast({
            "type": "groupNew",
            "data": {
                "group_id": group_id,
                "message": convert_group_message(new_message)
            }
        })
    except Exception:
        pass
    
    return {"status": "success", "message": convert_group_message(new_message)}


@router.get("/groups/{group_id}/messages")
async def get_group_messages(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get messages from a group"""
    if not check_is_member_group(group_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    messages = db.query(GroupMessage).filter(GroupMessage.group_id == group_id).order_by(GroupMessage.timestamp.asc()).all()
    
    messages_data = []
    for msg in messages:
        messages_data.append(convert_group_message(msg))
    
    return {"status": "success", "messages": messages_data}


@router.put("/groups/{group_id}")
async def update_group_profile(
    group_id: int,
    request: UpdateGroupProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update group profile"""
    if not check_can_modify_profile_group(group_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if request.name:
        group.name = request.name
    if request.description is not None:
        group.description = request.description
    if request.username:
        # Check uniqueness
        is_unique, entity_type = check_username_unique(request.username, db, exclude_group_id=group_id)
        if not is_unique:
            raise HTTPException(status_code=400, detail=f"Username already taken by {entity_type}")
        group.username = request.username
    
    db.commit()
    db.refresh(group)
    
    # Notify via WebSocket
    try:
        await messagingManager.broadcast({
            "type": "groupUpdated",
            "data": {
                "group_id": group_id,
                "group": convert_group(group, current_user.id, db)
            }
        })
    except Exception:
        pass
    
    return {"status": "success", "group": convert_group(group, current_user.id, db)}


@router.delete("/groups/{group_id}/messages/{message_id}")
async def delete_group_message(
    group_id: int,
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a group message"""
    can_delete, reason = check_can_delete_message_group(group_id, message_id, current_user.id, db)
    if not can_delete:
        raise HTTPException(status_code=403, detail=reason)
    
    message = db.query(GroupMessage).filter(GroupMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    db.delete(message)
    db.commit()
    
    # Notify via WebSocket
    try:
        await messagingManager.broadcast({
            "type": "groupMessageDeleted",
            "data": {
                "group_id": group_id,
                "message_id": message_id
            }
        })
    except Exception:
        pass
    
    return {"status": "success", "message_id": message_id}


@router.post("/groups/{group_id}/add_reaction")
async def add_group_reaction(
    group_id: int,
    request: GroupReactionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add reaction to group message"""
    if not check_can_react_group(group_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Cannot react to messages")
    
    message = db.query(GroupMessage).filter(GroupMessage.id == request.message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message.group_id != group_id:
        raise HTTPException(status_code=400, detail="Message does not belong to this group")
    
    existing_reaction = db.query(GroupReaction).filter(
        GroupReaction.message_id == request.message_id,
        GroupReaction.user_id == current_user.id,
        GroupReaction.emoji == request.emoji
    ).first()
    
    if existing_reaction:
        db.delete(existing_reaction)
        action = "removed"
    else:
        new_reaction = GroupReaction(
            message_id=request.message_id,
            user_id=current_user.id,
            emoji=request.emoji
        )
        db.add(new_reaction)
        action = "added"
    
    db.commit()
    db.refresh(message)
    
    # Broadcast reaction update
    try:
        await messagingManager.broadcast({
            "type": "groupReactionUpdate",
            "data": {
                "group_id": group_id,
                "message_id": request.message_id,
                "emoji": request.emoji,
                "action": action,
                "user_id": current_user.id,
                "reactions": convert_group_message(message)["reactions"]
            }
        })
    except Exception:
        pass
    
    return {"status": "success", "action": action, "reactions": convert_group_message(message)["reactions"]}


@router.get("/groups")
async def list_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all public groups"""
    groups = db.query(Group).filter(Group.access_type == "public").all()
    
    result = []
    for group in groups:
        result.append(convert_group(group, current_user.id, db))
    
    return {"status": "success", "groups": result}

