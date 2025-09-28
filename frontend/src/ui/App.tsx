import { ElectronTitleBar } from "./components/Electron";
import ChatScreen from "./screen/ChatScreen";
import LoginScreen from "./screen/LoginScreen";
import RegisterScreen from "./screen/RegisterScreen";
import { ProfileScreen } from "./screen/ProfileScreen";
import { UserProfileScreen } from "./screen/UserProfileScreen";
import { SettingsScreen } from "./screen/SettingsScreen";
import { useAppState } from "./state";
import { useEffect, useState } from "react";
import useWindowSize from "./hooks/useWindowSize";

export default function App() {
    const { currentPage, restoreUserFromStorage, chat } = useAppState();
    const { width } = useWindowSize();
    const isMobile = width < 800;
    const [previousPage, setPreviousPage] = useState(currentPage);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Restore user from localStorage on app initialization
    useEffect(() => {
        restoreUserFromStorage();
    }, [restoreUserFromStorage]);

    // Handle page transitions on mobile
    useEffect(() => {
        if (isMobile && currentPage !== previousPage) {
            setIsTransitioning(true);
            
            const endTimer = setTimeout(() => {
                setIsTransitioning(false);
                setPreviousPage(currentPage);
            }, 300);
            
            return () => {
                clearTimeout(endTimer);
            };
        } else if (!isMobile) {
            setPreviousPage(currentPage);
        }
    }, [currentPage, previousPage, isMobile]);

    function getPageComponent(pageType: typeof currentPage): React.ReactNode {
        switch (pageType) {
            case "login": {
                return <LoginScreen />
            }
            case "register": {
                return <RegisterScreen />
            }
            case "chat": {
                return <ChatScreen />
            }
            case "profile": {
                return <ProfileScreen />
            }
            case "user-profile": {
                return <UserProfileScreen userProfile={chat.mobileScreenData.userProfile} />
            }
            case "settings": {
                return <SettingsScreen />
            }
            default: {
                return <LoginScreen />
            }
        }
    };

    // Determine transition direction
    function getTransitionDirection() {
        const pageOrder = ["login", "register", "chat", "profile", "user-profile", "settings"];
        const currentIndex = pageOrder.indexOf(currentPage);
        const previousIndex = pageOrder.indexOf(previousPage);
        
        if (currentIndex > previousIndex) {
            return "slide-left"; // Going forward
        } else {
            return "slide-right"; // Going back
        }
    };

    return (
        <>
            <ElectronTitleBar />
            <div id="main-wrapper">
                {isMobile ? (
                    <div className="mobile-screen-container">
                        <div className={`screen-wrapper current-screen ${isTransitioning ? getTransitionDirection() : ''}`}>
                            {getPageComponent(currentPage)}
                        </div>
                        {isTransitioning && (
                            <div className={`screen-wrapper previous-screen ${getTransitionDirection()}`}>
                                {getPageComponent(previousPage)}
                            </div>
                        )}
                    </div>
                ) : (
                    getPageComponent(currentPage)
                )}
            </div>
        </>
    )
}