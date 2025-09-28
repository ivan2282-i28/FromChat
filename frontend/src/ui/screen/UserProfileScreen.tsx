import { useAppState } from "../state";
import { formatTime } from "../../utils/utils";
import defaultAvatar from "../../resources/images/default-avatar.png";
import type { UserProfile } from "../../core/types";

interface UserProfileScreenProps {
    userProfile: UserProfile | null;
}

export function UserProfileScreen({ userProfile }: UserProfileScreenProps) {
    const { setCurrentPage } = useAppState();

    const handleBack = () => {
        setCurrentPage("chat");
    };

    const handleSendMessage = () => {
        // TODO: Implement send message functionality
        console.log("Send message to:", userProfile?.username);
        setCurrentPage("chat");
    };

    if (!userProfile) {
        return (
            <div className="user-profile-screen">
                <div className="profile-header">
                    <mdui-button-icon icon="arrow_back" onClick={handleBack}></mdui-button-icon>
                    <h2>Профиль</h2>
                    <div></div>
                </div>
                <div className="profile-content">
                    <div className="error-message">
                        <p>Профиль пользователя не найден</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="user-profile-screen">
            <div className="profile-header">
                <mdui-button-icon icon="arrow_back" onClick={handleBack}></mdui-button-icon>
                <h2>Профиль</h2>
                <div></div>
            </div>

            <div className="profile-content">
                <div className="profile-picture-section">
                    <img 
                        className="profile-picture" 
                        alt="Profile Picture" 
                        src={userProfile.profile_picture || defaultAvatar}
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = defaultAvatar;
                        }}
                    />
                </div>

                <div className="profile-info">
                    <div className="username-section">
                        <h3 className="username">{userProfile.username}</h3>
                        <div className={`online-status ${userProfile.online ? "online" : "offline"}`}>
                            {userProfile.online ? (
                                <>
                                    <span className="online-indicator"></span> Онлайн
                                </>
                            ) : (
                                <>
                                    <span className="offline-indicator"></span> Последний заход {formatTime(userProfile.last_seen)}
                                </>
                            )}
                        </div>
                    </div>

                    <div className="bio-section">
                        <label>О себе:</label>
                        <div className="bio-display">
                            {userProfile.bio || "Информация отсутствует"}
                        </div>
                    </div>

                    <div className="profile-stats">
                        <div className="stat">
                            <span className="stat-label">Зарегистрирован:</span>
                            <span className="stat-value member-since">{formatTime(userProfile.created_at)}</span>
                        </div>
                        <div className="stat">
                            <span className="stat-label">Последний заход:</span>
                            <span className="stat-value last-seen">{formatTime(userProfile.last_seen)}</span>
                        </div>
                    </div>

                    <div className="profile-actions">
                        <mdui-button id="dm-button" variant="filled" onClick={handleSendMessage}>
                            <mdui-icon slot="icon" name="chat--filled"></mdui-icon>
                            Написать сообщение
                        </mdui-button>
                    </div>
                </div>
            </div>
        </div>
    );
}
