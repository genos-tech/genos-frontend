import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Socket } from "socket.io-client";
import { GlobalStyles, Avatar, Box, Divider, List, ListItem, Sheet, Badge } from "@mui/joy";
import ListItemButton, { listItemButtonClasses } from "@mui/joy/ListItemButton";
import NotificationsIcon from "@mui/icons-material/Notifications";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";

import { ColorSchemeToggle } from "./colorSchemeToggle";
import { useAuth } from "../../context/AuthContext";
import { TeamDropdown } from "../../features/admin/components/teamDropdown";
import { Team, UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";
import { UserProfile } from "../../features/admin/components/modals/UserProfile";
import { PulseDot } from "../../components/utils/PulseDot";

const base_url = import.meta.env.VITE_API_BASE_URL;
const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type SidebarProps = {
    currentTeam: Team;
    setCurrentTeam: (value: Team) => void;
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    openingService: number;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    unReadInboxItemCount: number;
    unReadChatAndActivityCounts: number;
};
export const Sidebar = (props: SidebarProps) => {
    const {
        currentTeam,
        setCurrentTeam,
        teamMemberProfiles,
        socket,
        myself,
        setMyself,
        openingService,
        setOpeningService,
        setCurrentMainChat,
        unReadInboxItemCount,
        unReadChatAndActivityCounts,
    } = props;
    const { setAccessToken } = useAuth();
    const navigate = useNavigate();

    const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);

    const handleLogout = async () => {
        try {
            const response = await fetch(`${base_url}/user/signout/`, {
                method: "POST",
                credentials: "include",
            });

            if (response.ok) {
                // Redirect to home page after successful logout
                localStorage.setItem("isSigningIn", "no");
                localStorage.setItem("userEmail", "");
                localStorage.setItem("userName", "");
                localStorage.setItem("userId", "");
                localStorage.setItem("avatarImgPath", "");
                localStorage.setItem("teamId", "");
                localStorage.setItem("tsJoined", "");
                localStorage.setItem("isOfflineForced", "false");
                localStorage.setItem("role", "");
                localStorage.setItem("baseCountry", "");
                localStorage.setItem("customStatus", "");
                localStorage.setItem("teamName", "");
                localStorage.setItem("lastOpenMyNoteId", "");
                localStorage.setItem("currentNoteType", "");
                setAccessToken(null);
                navigate("/");
            } else {
                console.error("Logout failed");
            }
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    const handleMoveToInbox = (): void => {
        setOpeningService(0);
        localStorage.setItem("openingService", "0");
    };

    const handleMoveToChat = (): void => {
        setOpeningService(1);
        localStorage.setItem("openingService", "1");
    };

    const handleMoveToTasks = (): void => {
        setOpeningService(2);
        localStorage.setItem("openingService", "2");
    };

    const handleMoveToNote = (): void => {
        setOpeningService(3);
        localStorage.setItem("openingService", "3");
    };

    return (
        <Sheet
            className="Sidebar"
            sx={{
                position: { xs: "fixed", md: "sticky" },
                transform: {
                    xs: "translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1)))",
                    md: "none",
                },
                transition: "transform 0.4s, width 0.4s",
                height: "100dvh",
                width: "var(--Sidebar-width)",
                py: 2,
                // flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                borderRight: "1px solid",
                borderColor: "divider",
            }}
        >
            <GlobalStyles
                styles={(theme) => ({
                    ":root": {
                        "--Sidebar-width": "60px",
                        [theme.breakpoints.up("lg")]: {
                            "--Sidebar-width": "60px",
                        },
                    },
                })}
            />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "center" }}>
                <TeamDropdown
                    currentTeam={currentTeam}
                    setCurrentTeam={setCurrentTeam}
                    myself={myself}
                    setMyself={setMyself}
                />
                <ColorSchemeToggle />
            </Box>

            <Box
                sx={{
                    minHeight: 0,
                    overflow: "hidden auto",
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "column",
                    [`& .${listItemButtonClasses.root}`]: {
                        gap: 1.5,
                    },
                    alignItems: "center",
                }}
            >
                <List
                    size="sm"
                    sx={{
                        gap: 0.5,
                        "--List-nestedInsetStart": "30px",
                        "--ListItem-radius": (theme) => theme.vars.radius.sm,
                    }}
                >
                    <ListItem>
                        <ListItemButton onClick={handleMoveToInbox} title="Inbox">
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    p: "5px",
                                }}
                            >
                                {unReadInboxItemCount > 0 && (
                                    <Badge
                                        badgeContent={unReadInboxItemCount}
                                        color="primary"
                                        size="sm"
                                        anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    >
                                        <NotificationsIcon
                                            color={openingService === 0 ? "primary" : "disabled"}
                                            sx={{ fontSize: 24 }}
                                        />
                                    </Badge>
                                )}
                                {unReadInboxItemCount < 1 && (
                                    <NotificationsIcon
                                        color={openingService === 0 ? "primary" : "disabled"}
                                        sx={{ fontSize: 24 }}
                                    />
                                )}
                            </Box>
                        </ListItemButton>
                    </ListItem>
                    <ListItem>
                        <ListItemButton onClick={handleMoveToChat} title="Chats">
                            <Box sx={{ display: "flex", alignItems: "center", p: "5px" }}>
                                {unReadChatAndActivityCounts > 0 && (
                                    <Badge
                                        badgeContent={unReadChatAndActivityCounts}
                                        color="primary"
                                        size="sm"
                                        anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    >
                                        <QuestionAnswerRoundedIcon
                                            color={openingService === 1 ? "primary" : "disabled"}
                                            sx={{ fontSize: 24 }}
                                        />
                                    </Badge>
                                )}
                                {unReadChatAndActivityCounts < 1 && (
                                    <QuestionAnswerRoundedIcon
                                        color={openingService === 1 ? "primary" : "disabled"}
                                        sx={{ fontSize: 24 }}
                                    />
                                )}
                            </Box>
                        </ListItemButton>
                    </ListItem>
                    <ListItem>
                        <ListItemButton onClick={handleMoveToTasks} title="Tasks">
                            <Box sx={{ display: "flex", alignItems: "center", p: "5px" }}>
                                <AssignmentRoundedIcon
                                    color={openingService === 2 ? "primary" : "disabled"}
                                    sx={{ fontSize: 24 }}
                                />
                            </Box>
                        </ListItemButton>
                    </ListItem>
                    <ListItem>
                        <ListItemButton onClick={handleMoveToNote} title="Notes">
                            <Box sx={{ display: "flex", alignItems: "center", p: "5px" }}>
                                <NoteAltIcon
                                    color={openingService === 3 ? "primary" : "disabled"}
                                    sx={{ fontSize: 24 }}
                                />
                            </Box>
                        </ListItemButton>
                    </ListItem>
                </List>
                <List
                    size="sm"
                    sx={{
                        mt: "auto",
                        flexGrow: 0,
                        "--ListItem-radius": (theme) => theme.vars.radius.sm,
                        "--List-gap": "3px",
                        mb: 0,
                    }}
                >
                    <ListItem>
                        <ListItemButton title="Settings">
                            <SettingsRoundedIcon sx={{ fontSize: 24 }} />
                        </ListItemButton>
                    </ListItem>

                    <ListItem sx={{ mt: 1 }}>
                        <ListItemButton title="Sign out" onClick={handleLogout}>
                            <LogoutRoundedIcon sx={{ fontSize: 24 }} />
                        </ListItemButton>
                    </ListItem>
                </List>
            </Box>

            <Divider />

            <Box onClick={() => setOpenUserProfile(true)} sx={{ pl: "12px" }}>
                <Avatar variant="solid" size="sm" src={`${media_url}/${myself.avatarImgPath}`}>
                    {myself.userName[0].toUpperCase()}
                </Avatar>
                <Box position="absolute" bottom={0} right={0} width={24} height={33}>
                    <PulseDot color={myself?.isOfflineForced !== "true" ? "#4caf50" : "#999"} />
                </Box>
            </Box>

            <UserProfile
                socket={socket}
                myself={myself}
                setMyself={setMyself}
                isYou={true}
                user={teamMemberProfiles[myself.userId]}
                openUserProfile={openUserProfile}
                setOpenUserProfile={setOpenUserProfile}
                setCurrentMainChat={setCurrentMainChat}
                setOpeningService={setOpeningService}
            />
        </Sheet>
    );
};
