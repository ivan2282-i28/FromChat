import json
import logging
import os
from typing import List, Optional
from sqlalchemy.orm import Session
from pywebpush import webpush, WebPushException
from models import PushSubscription, User, Message, DMEnvelope, Group, Channel, GroupMessage, ChannelMessage

logger = logging.getLogger("uvicorn.error")

class PushNotificationService:
    def __init__(self):
        self.vapid_private_key = os.getenv("VAPID_PRIVATE_KEY")
        self.vapid_public_key = os.getenv("VAPID_PUBLIC_KEY")

        if (not self.vapid_public_key) or (not self.vapid_private_key):
            raise ValueError("VAPID public or private key is None")

        self.vapid_claims = {
            "sub": "mailto:support@fromchat.ru",
            "aud": "https://fcm.googleapis.com"
        }

    async def subscribe_user(self, db: Session, user_id: int, endpoint: str, p256dh_key: str, auth_key: str) -> bool:
        """Subscribe a user to push notifications"""
        try:
            # Check if user already has a subscription
            existing_sub = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).first()
            
            if existing_sub:
                # Update existing subscription
                existing_sub.endpoint = endpoint
                existing_sub.p256dh_key = p256dh_key
                existing_sub.auth_key = auth_key
            else:
                # Create new subscription
                new_sub = PushSubscription(
                    user_id=user_id,
                    endpoint=endpoint,
                    p256dh_key=p256dh_key,
                    auth_key=auth_key
                )
                db.add(new_sub)
            
            db.commit()
            logger.info(f"Push subscription saved for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to save push subscription for user {user_id}: {e}")
            db.rollback()
            return False

    async def send_public_message_notification(self, db: Session, message: Message, exclude_user_id: Optional[int] = None):
        """Send push notification for a new public chat message"""
        try:
            # Get all users except the sender
            users = db.query(User).filter(User.id != message.user_id)
            if exclude_user_id:
                users = users.filter(User.id != exclude_user_id)
            
            for user in users:
                # Check if user has push subscription before trying to send
                subscription = db.query(PushSubscription).filter(PushSubscription.user_id == user.id).first()
                if not subscription:
                    continue
                    
                await self._send_notification_to_user(
                    db, user.id, 
                    f"New message from {message.author.username}",
                    message.content[:100] + ("..." if len(message.content) > 100 else ""),
                    message.author.profile_picture,
                    {
                        "type": "public_message",
                        "message_id": message.id,
                        "sender_id": message.user_id,
                        "sender_username": message.author.username
                    }
                )
        except Exception as e:
            logger.error(f"Failed to send public message notifications: {e}")

    async def send_dm_notification(self, db: Session, dm_envelope: DMEnvelope, sender: User):
        """Send push notification for a new DM"""
        try:
            await self._send_notification_to_user(
                db, dm_envelope.recipient_id,
                f"New message from {sender.username}",
                "You have a new direct message",
                sender.profile_picture,
                {
                    "type": "dm",
                    "dm_id": dm_envelope.id,
                    "sender_id": sender.id,
                    "sender_username": sender.username
                }
            )
        except Exception as e:
            logger.error(f"Failed to send DM notification: {e}")

    async def _send_notification_to_user(self, db: Session, user_id: int, title: str, body: str, icon: Optional[str], data: dict):
        """Send a push notification to a specific user"""
        try:
            subscription = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).first()
            if not subscription:
                return

            payload = {
                "title": title,
                "body": body,
                "icon": icon or "/logo.png",
                "tag": f"message_{user_id}",
                "data": data
            }

            subscription_info = {
                "endpoint": subscription.endpoint,
                "keys": {
                    "p256dh": subscription.p256dh_key,
                    "auth": subscription.auth_key
                }
            }

            webpush(
                subscription_info=subscription_info,
                data=json.dumps(payload),
                vapid_private_key=self.vapid_private_key,
                vapid_claims=self.vapid_claims
            )
            
        except WebPushException as e:
            logger.error(f"WebPush error for user {user_id}: {e}")
            # If the subscription is invalid, remove it
            if hasattr(e, 'response') and e.response and e.response.status_code in [410, 404]:
                db.query(PushSubscription).filter(PushSubscription.user_id == user_id).delete()
                db.commit()
        except Exception as e:
            logger.error(f"Failed to send push notification to user {user_id}: {e}")

    async def send_group_message_notification(self, db: Session, message: GroupMessage, group: Group, exclude_user_id: Optional[int] = None):
        """Send push notification for a new group message"""
        try:
            from models import GroupMember
            # Get all group members except the sender
            members = db.query(GroupMember).filter(
                GroupMember.group_id == group.id,
                GroupMember.user_id != message.user_id,
                GroupMember.is_banned == False
            )
            if exclude_user_id:
                members = members.filter(GroupMember.user_id != exclude_user_id)
            
            for member in members.all():
                user = db.query(User).filter(User.id == member.user_id).first()
                if user:
                    await self._send_notification_to_user(
                        db, member.user_id,
                        f"New message in {group.name}",
                        message.content[:100] + ("..." if len(message.content) > 100 else ""),
                        message.author.profile_picture,
                        {
                            "type": "group_message",
                            "group_id": group.id,
                            "message_id": message.id,
                            "sender_id": message.user_id,
                            "sender_username": message.author.username
                        }
                    )
        except Exception as e:
            logger.error(f"Failed to send group message notifications: {e}")

    async def send_channel_message_notification(self, db: Session, message: ChannelMessage, channel: Channel, exclude_user_id: Optional[int] = None):
        """Send push notification for a new channel message"""
        try:
            from models import ChannelSubscriber
            # Get all subscribers except the sender
            subscribers = db.query(ChannelSubscriber).filter(
                ChannelSubscriber.channel_id == channel.id,
                ChannelSubscriber.user_id != message.user_id
            )
            if exclude_user_id:
                subscribers = subscribers.filter(ChannelSubscriber.user_id != exclude_user_id)
            
            for subscriber in subscribers.all():
                user = db.query(User).filter(User.id == subscriber.user_id).first()
                if user:
                    await self._send_notification_to_user(
                        db, subscriber.user_id,
                        f"New message in {channel.name}",
                        message.content[:100] + ("..." if len(message.content) > 100 else ""),
                        message.author.profile_picture,
                        {
                            "type": "channel_message",
                            "channel_id": channel.id,
                            "message_id": message.id,
                            "sender_id": message.user_id,
                            "sender_username": message.author.username
                        }
                    )
        except Exception as e:
            logger.error(f"Failed to send channel message notifications: {e}")

    async def unsubscribe_user(self, db: Session, user_id: int) -> bool:
        """Unsubscribe a user from push notifications"""
        try:
            db.query(PushSubscription).filter(PushSubscription.user_id == user_id).delete()
            db.commit()
            logger.info(f"Push subscription removed for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to remove push subscription for user {user_id}: {e}")
            db.rollback()
            return False

# Global instance
push_service = PushNotificationService()
