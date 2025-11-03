"""
Permission checking utilities for groups and channels
"""
from sqlalchemy.orm import Session
from models import (
    Group, Channel, GroupMember, ChannelSubscriber, GroupAdmin, ChannelAdmin, 
    GroupMemberRestriction, GroupMessage, ChannelMessage, User
)
from datetime import datetime


def check_is_admin_group(group_id: int, user_id: int, db: Session) -> bool:
    """Check if user is an admin in the group"""
    admin = db.query(GroupAdmin).filter(
        GroupAdmin.group_id == group_id,
        GroupAdmin.user_id == user_id
    ).first()
    if admin:
        return True
    
    # Check if user is owner
    group = db.query(Group).filter(Group.id == group_id).first()
    if group and group.owner_id == user_id:
        return True
    
    return False


def check_is_admin_channel(channel_id: int, user_id: int, db: Session) -> bool:
    """Check if user is an admin in the channel"""
    admin = db.query(ChannelAdmin).filter(
        ChannelAdmin.channel_id == channel_id,
        ChannelAdmin.user_id == user_id
    ).first()
    if admin:
        return True
    
    # Check if user is owner
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if channel and channel.owner_id == user_id:
        return True
    
    return False


def check_is_member_group(group_id: int, user_id: int, db: Session) -> bool:
    """Check if user is a member of the group"""
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id,
        GroupMember.is_banned == False
    ).first()
    return member is not None


def check_is_subscribed_channel(channel_id: int, user_id: int, db: Session) -> bool:
    """Check if user is subscribed to the channel"""
    subscriber = db.query(ChannelSubscriber).filter(
        ChannelSubscriber.channel_id == channel_id,
        ChannelSubscriber.user_id == user_id
    ).first()
    return subscriber is not None


def check_can_send_message_group(group_id: int, user_id: int, db: Session) -> tuple[bool, str]:
    """Check if user can send messages in group. Returns (can_send, reason)"""
    # Check if user is a member
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id
    ).first()
    
    if not member:
        return False, "Not a member"
    
    if member.is_banned:
        if member.banned_until and member.banned_until > datetime.now():
            return False, "Banned until " + member.banned_until.isoformat()
        elif not member.banned_until:
            return False, "Permanently banned"
        else:
            # Ban expired, remove it
            member.is_banned = False
            member.banned_until = None
            db.commit()
    
    # Check restrictions
    restriction = db.query(GroupMemberRestriction).filter(
        GroupMemberRestriction.group_id == group_id,
        GroupMemberRestriction.user_id == user_id
    ).first()
    
    if restriction:
        # Check if restriction expired
        if restriction.expires_at and restriction.expires_at < datetime.now():
            # Restriction expired, remove it
            db.delete(restriction)
            db.commit()
        elif not restriction.expires_at or restriction.expires_at > datetime.now():
            # Restriction is active
            if not restriction.can_send_messages:
                return False, "Sending messages restricted"
    
    # Check admin rights if user is admin
    if member.role in ["admin", "owner"] or check_is_admin_group(group_id, user_id, db):
        admin = db.query(GroupAdmin).filter(
            GroupAdmin.group_id == group_id,
            GroupAdmin.user_id == user_id
        ).first()
        if admin and not admin.can_send_messages:
            return False, "Admin rights: cannot send messages"
    
    return True, ""


def check_can_send_message_channel(channel_id: int, user_id: int, db: Session) -> tuple[bool, str]:
    """Check if user can send messages in channel. Returns (can_send, reason).
    Only admins can send in channels."""
    if not check_is_admin_channel(channel_id, user_id, db):
        return False, "Only admins can send messages in channels"
    
    # Check admin rights
    admin = db.query(ChannelAdmin).filter(
        ChannelAdmin.channel_id == channel_id,
        ChannelAdmin.user_id == user_id
    ).first()
    
    if admin and not admin.can_send_messages:
        return False, "Admin rights: cannot send messages"
    
    return True, ""


def check_can_delete_message_group(group_id: int, message_id: int, user_id: int, db: Session) -> tuple[bool, str]:
    """Check if user can delete a message in group. Returns (can_delete, reason)"""
    message = db.query(GroupMessage).filter(GroupMessage.id == message_id).first()
    if not message:
        return False, "Message not found"
    
    if message.group_id != group_id:
        return False, "Message does not belong to this group"
    
    # Author can always delete their own messages
    if message.user_id == user_id:
        return True, ""
    
    # Check if user is admin with delete permission
    if check_is_admin_group(group_id, user_id, db):
        admin = db.query(GroupAdmin).filter(
            GroupAdmin.group_id == group_id,
            GroupAdmin.user_id == user_id
        ).first()
        
        # Owner has all rights
        group = db.query(Group).filter(Group.id == group_id).first()
        if group and group.owner_id == user_id:
            return True, ""
        
        if admin and not admin.can_delete_messages:
            return False, "Admin rights: cannot delete messages"
        
        return True, ""
    
    return False, "Not authorized to delete this message"


def check_can_delete_message_channel(channel_id: int, message_id: int, user_id: int, db: Session) -> tuple[bool, str]:
    """Check if user can delete a message in channel. Returns (can_delete, reason)"""
    message = db.query(ChannelMessage).filter(ChannelMessage.id == message_id).first()
    if not message:
        return False, "Message not found"
    
    if message.channel_id != channel_id:
        return False, "Message does not belong to this channel"
    
    # Author can always delete their own messages
    if message.user_id == user_id:
        return True, ""
    
    # Check if user is admin with delete permission
    if check_is_admin_channel(channel_id, user_id, db):
        admin = db.query(ChannelAdmin).filter(
            ChannelAdmin.channel_id == channel_id,
            ChannelAdmin.user_id == user_id
        ).first()
        
        # Owner has all rights
        channel = db.query(Channel).filter(Channel.id == channel_id).first()
        if channel and channel.owner_id == user_id:
            return True, ""
        
        if admin and not admin.can_delete_messages:
            return False, "Admin rights: cannot delete messages"
        
        return True, ""
    
    return False, "Not authorized to delete this message"


def check_can_modify_profile_group(group_id: int, user_id: int, db: Session) -> bool:
    """Check if user can modify group profile"""
    if not check_is_admin_group(group_id, user_id, db):
        return False
    
    admin = db.query(GroupAdmin).filter(
        GroupAdmin.group_id == group_id,
        GroupAdmin.user_id == user_id
    ).first()
    
    # Owner has all rights
    group = db.query(Group).filter(Group.id == group_id).first()
    if group and group.owner_id == user_id:
        return True
    
    if admin and not admin.can_modify_profile:
        return False
    
    return True


def check_can_modify_profile_channel(channel_id: int, user_id: int, db: Session) -> bool:
    """Check if user can modify channel profile"""
    if not check_is_admin_channel(channel_id, user_id, db):
        return False
    
    admin = db.query(ChannelAdmin).filter(
        ChannelAdmin.channel_id == channel_id,
        ChannelAdmin.user_id == user_id
    ).first()
    
    # Owner has all rights
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if channel and channel.owner_id == user_id:
        return True
    
    if admin and not admin.can_modify_profile:
        return False
    
    return True


def check_can_assign_admins_group(group_id: int, user_id: int, db: Session) -> bool:
    """Check if user can assign admins in group"""
    if not check_is_admin_group(group_id, user_id, db):
        return False
    
    admin = db.query(GroupAdmin).filter(
        GroupAdmin.group_id == group_id,
        GroupAdmin.user_id == user_id
    ).first()
    
    # Owner has all rights
    group = db.query(Group).filter(Group.id == group_id).first()
    if group and group.owner_id == user_id:
        return True
    
    if admin and not admin.can_assign_admins:
        return False
    
    return True


def check_can_assign_admins_channel(channel_id: int, user_id: int, db: Session) -> bool:
    """Check if user can assign admins in channel"""
    if not check_is_admin_channel(channel_id, user_id, db):
        return False
    
    admin = db.query(ChannelAdmin).filter(
        ChannelAdmin.channel_id == channel_id,
        ChannelAdmin.user_id == user_id
    ).first()
    
    # Owner has all rights
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if channel and channel.owner_id == user_id:
        return True
    
    if admin and not admin.can_assign_admins:
        return False
    
    return True


def check_can_react_group(group_id: int, user_id: int, db: Session) -> bool:
    """Check if user can react to messages in group"""
    # Check if user is a member
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id
    ).first()
    
    if not member or member.is_banned:
        return False
    
    # Check restrictions
    restriction = db.query(GroupMemberRestriction).filter(
        GroupMemberRestriction.group_id == group_id,
        GroupMemberRestriction.user_id == user_id
    ).first()
    
    if restriction:
        # Check if restriction expired
        if restriction.expires_at and restriction.expires_at < datetime.now():
            # Restriction expired
            db.delete(restriction)
            db.commit()
            return True
        elif not restriction.expires_at or restriction.expires_at > datetime.now():
            # Restriction is active
            return restriction.can_react
    
    return True


def check_can_react_channel(channel_id: int, user_id: int, db: Session) -> bool:
    """Check if user can react to messages in channel"""
    # Check if user is subscribed
    subscriber = db.query(ChannelSubscriber).filter(
        ChannelSubscriber.channel_id == channel_id,
        ChannelSubscriber.user_id == user_id
    ).first()
    
    # Subscribers can always react (unless we add restrictions later)
    return subscriber is not None


def check_username_unique(username: str, db: Session, exclude_user_id: int = None, exclude_group_id: int = None, exclude_channel_id: int = None) -> tuple[bool, str]:
    """Check if username is unique across users, groups, and channels.
    Returns (is_unique, entity_type) where entity_type is 'user', 'group', 'channel', or '' if unique"""
    # Check users
    query = db.query(User).filter(User.username == username)
    if exclude_user_id:
        query = query.filter(User.id != exclude_user_id)
    if query.first():
        return False, "user"
    
    # Check groups
    query = db.query(Group).filter(Group.username == username)
    if exclude_group_id:
        query = query.filter(Group.id != exclude_group_id)
    if query.first():
        return False, "group"
    
    # Check channels
    query = db.query(Channel).filter(Channel.username == username)
    if exclude_channel_id:
        query = query.filter(Channel.id != exclude_channel_id)
    if query.first():
        return False, "channel"
    
    return True, ""

