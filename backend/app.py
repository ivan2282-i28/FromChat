from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import subprocess
import sys
import os
from constants import DATABASE_URL
from routes import account, messaging, profile, push, webrtc, devices, groups, channels
import logging
from models import User, Group, GroupMember, GroupMessage, Message, generate_invite_link
from constants import OWNER_USERNAME
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger("uvicorn.error")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup - run migration in separate process to avoid logging interference
    try:
        logger.info("Starting database migration check...")
        # Run migration in a separate process
        subprocess.run(
            [
                sys.executable, 
                "-c", 
                "import sys; sys.path.append('.'); from migration import run_migrations; run_migrations()"
            ], 
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
    except Exception as e:
        logger.error(f"Failed to run database migrations: {e}")
        raise
    
    try:
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        with SessionLocal() as db:
            # Find the owner user
            owner = db.query(User).filter(User.username == OWNER_USERNAME).first()
            if owner and not owner.verified:
                owner.verified = True
                db.commit()
                logger.info(f"Owner user '{OWNER_USERNAME}' has been verified")
            elif owner and owner.verified:
                logger.info(f"Owner user '{OWNER_USERNAME}' is already verified")
            else:
                logger.warning(f"Owner user '{OWNER_USERNAME}' not found")
            
            # Auto-create default group if it doesn't exist
            from sqlalchemy import or_
            default_group = db.query(Group).filter(or_(Group.username == "general", Group.name == "Общий чат")).first()
            if not default_group:
                logger.info("Creating default group 'Общий чат'...")
                # Get first user as owner, or owner user
                group_owner = owner if owner else db.query(User).first()
                if group_owner:
                    default_group = Group(
                        name="Общий чат",
                        username="general",
                        owner_id=group_owner.id,
                        access_type="public"
                    )
                    db.add(default_group)
                    db.commit()
                    db.refresh(default_group)
                    logger.info(f"Default group created with ID {default_group.id}")
                    
                    # Add all existing users as members
                    all_users = db.query(User).all()
                    for user in all_users:
                        member = GroupMember(
                            group_id=default_group.id,
                            user_id=user.id,
                            role="owner" if user.id == group_owner.id else "member"
                        )
                        db.add(member)
                    db.commit()
                    logger.info(f"Added {len(all_users)} users as members of default group")
                    
                    # Migrate existing messages to group messages
                    existing_messages = db.query(Message).all()
                    if existing_messages:
                        logger.info(f"Migrating {len(existing_messages)} existing messages to group messages...")
                        for msg in existing_messages:
                            group_msg = GroupMessage(
                                group_id=default_group.id,
                                user_id=msg.user_id,
                                content=msg.content,
                                timestamp=msg.timestamp,
                                reply_to_id=None,  # Can't migrate reply_to easily
                                is_edited=msg.is_edited
                            )
                            db.add(group_msg)
                        db.commit()
                        logger.info(f"Migrated {len(existing_messages)} messages to group messages")
                else:
                    logger.warning("No users found, cannot create default group")
            else:
                logger.info(f"Default group already exists (ID: {default_group.id})")
                
    except Exception as e:
        logger.error(f"Failed to ensure owner verification or create default group: {e}")
    
    # Start the messaging cleanup task
    try:
        from routes.messaging import messagingManager
        messagingManager.start_cleanup_task()
        logger.info("Messaging cleanup task started")
    except Exception as e:
        logger.error(f"Failed to start messaging cleanup task: {e}")
    
    yield
    
    # Shutdown (if needed in the future)

# Инициализация FastAPI
app = FastAPI(title="FromChat", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://fromchat.ru",
        "https://beta.fromchat.ru",
        "https://www.fromchat.ru",
        "http://127.0.0.1:8301",
        "http://127.0.0.1:8300",
        "http://localhost:8301",
        "http://localhost:8300",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(account.router)
app.include_router(messaging.router)
app.include_router(profile.router)
app.include_router(push.router, prefix="/push")
app.include_router(webrtc.router, prefix="/webrtc")
app.include_router(devices.router, prefix="/devices")
app.include_router(groups.router, prefix="/api")
app.include_router(channels.router, prefix="/api")