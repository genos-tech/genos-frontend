import { useState } from "react";
import AllInboxIcon from "@mui/icons-material/AllInbox";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
    Avatar,
    Badge,
    Box,
    Divider,
    GlobalStyles,
    List,
    ListItem,
    Sheet,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import ListItemButton, { listItemButtonClasses } from "@mui/joy/ListItemButton";
import { useNavigate } from "react-router-dom";
import { Socket } from "socket.io-client";

import { PulseDot } from "../../components/utils/PulseDot";
import { useAuth } from "../../context/AuthContext";
import { UserProfile } from "../../features/admin/components/modals/ModalUserProfile";
import { TeamDropdown } from "../../features/admin/components/teamDropdown";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { Team, UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";
import { ColorSchemeToggle } from "./colorSchemeToggle";

const base_url = import.meta.env.VITE_API_BASE_URL;
const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type SidebarProps = {
    currentTeam: Team;
    setCurrentTeam: (value: Team) => void;
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    unReadInboxItemCount: number;
    unReadChatAndActivityCounts: number;
    UIM: UIStateManagementState;
};
export const Sidebar = (props: SidebarProps) => {
    const {
        currentTeam,
        setCurrentTeam,
        teamMemberProfiles,
        socket,
        myself,
        setMyself,
        setCurrentMainChat,
        unReadInboxItemCount,
        unReadChatAndActivityCounts,
        UIM,
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
                localStorage.setItem("lastOpenNoteType", "");
                localStorage.setItem("lastChatType", "");
                localStorage.setItem("lastDMChatId", "");
                localStorage.setItem("lastGMChatId", "");
                localStorage.setItem("lastPMChatId", "");
                localStorage.setItem("lastPinnedChatId", "");
                localStorage.setItem("lastPinnedChatType", "");
                localStorage.setItem("lastProjectId", "");
                localStorage.setItem("lastOpenChatNoteId", "");
                localStorage.setItem("lastOpenTaskNoteId", "");
                localStorage.setItem("currentMainChatId", "");
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
        UIM.setOpeningService(0);
    };

    const handleMoveToChat = (): void => {
        UIM.setOpeningService(1);
    };

    const handleMoveToTasks = (): void => {
        UIM.setOpeningService(2);
    };

    const handleMoveToNote = (): void => {
        UIM.setOpeningService(3);
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
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    alignItems: "center",
                }}
            >
                <TeamDropdown
                    currentTeam={currentTeam}
                    myself={myself}
                    setCurrentTeam={setCurrentTeam}
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
                        <ListItemButton onClick={handleMoveToInbox}>
                            <Stack direction="column" alignItems="center">
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        p: "5px",
                                    }}
                                >
                                    {unReadInboxItemCount > 0 && (
                                        <Badge
                                            anchorOrigin={{
                                                vertical: "top",
                                                horizontal: "right",
                                            }}
                                            badgeContent={unReadInboxItemCount}
                                            color="primary"
                                            size="sm"
                                        >
                                            <AllInboxIcon
                                                sx={{ fontSize: 24 }}
                                                color={
                                                    UIM.openingService === 0
                                                        ? "primary"
                                                        : "disabled"
                                                }
                                            />
                                        </Badge>
                                    )}
                                    {unReadInboxItemCount < 1 && (
                                        <AllInboxIcon
                                            color={
                                                UIM.openingService === 0 ? "primary" : "disabled"
                                            }
                                            sx={{ fontSize: 24 }}
                                        />
                                    )}
                                </Box>
                                <Typography level="body-xs">Inbox</Typography>
                            </Stack>
                        </ListItemButton>
                    </ListItem>
                    <ListItem>
                        <ListItemButton onClick={handleMoveToChat}>
                            <Stack direction="column" alignItems="center">
                                <Box sx={{ display: "flex", alignItems: "center", p: "5px" }}>
                                    {unReadChatAndActivityCounts > 0 && (
                                        <Badge
                                            anchorOrigin={{
                                                vertical: "top",
                                                horizontal: "right",
                                            }}
                                            badgeContent={unReadChatAndActivityCounts}
                                            color="primary"
                                            size="sm"
                                        >
                                            <QuestionAnswerRoundedIcon
                                                sx={{ fontSize: 24 }}
                                                color={
                                                    UIM.openingService === 1
                                                        ? "primary"
                                                        : "disabled"
                                                }
                                            />
                                        </Badge>
                                    )}
                                    {unReadChatAndActivityCounts < 1 && (
                                        <QuestionAnswerRoundedIcon
                                            color={
                                                UIM.openingService === 1 ? "primary" : "disabled"
                                            }
                                            sx={{ fontSize: 24 }}
                                        />
                                    )}
                                </Box>
                                <Typography level="body-xs">Chats</Typography>
                            </Stack>
                        </ListItemButton>
                    </ListItem>
                    <ListItem>
                        <ListItemButton onClick={handleMoveToTasks}>
                            <Stack direction="column" alignItems="center">
                                <Box sx={{ display: "flex", alignItems: "center", p: "5px" }}>
                                    <AssignmentRoundedIcon
                                        color={UIM.openingService === 2 ? "primary" : "disabled"}
                                        sx={{ fontSize: 24 }}
                                    />
                                </Box>
                                <Typography level="body-xs">Tasks</Typography>
                            </Stack>
                        </ListItemButton>
                    </ListItem>
                    <ListItem>
                        <ListItemButton onClick={handleMoveToNote}>
                            <Stack direction="column" alignItems="center">
                                <Box sx={{ display: "flex", alignItems: "center", p: "5px" }}>
                                    <NoteAltIcon
                                        color={UIM.openingService === 3 ? "primary" : "disabled"}
                                        sx={{ fontSize: 24 }}
                                    />
                                </Box>
                                <Typography level="body-xs">Notes</Typography>
                            </Stack>
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
                    {/* <ListItem>
                        <Tooltip variant="outlined"  title="Settings" placement="right-start">
                            <ListItemButton>
                                <SettingsRoundedIcon sx={{ fontSize: 24 }} />
                            </ListItemButton>
                        </Tooltip>
                    </ListItem> */}

                    <ListItem sx={{ mt: 1 }}>
                        <Tooltip
                            placement="right-start"
                            size="sm"
                            title="Sign out"
                            variant="outlined"
                        >
                            <ListItemButton onClick={handleLogout}>
                                <LogoutRoundedIcon sx={{ fontSize: 24 }} />
                            </ListItemButton>
                        </Tooltip>
                    </ListItem>
                </List>
            </Box>

            <Divider />

            <Box sx={{ pl: "12px" }} onClick={() => setOpenUserProfile(true)}>
                <Tooltip
                    placement="right-start"
                    size="sm"
                    title="Open My Profile"
                    variant="outlined"
                >
                    <Avatar size="sm" src={`${media_url}/${myself.avatarImgPath}`} variant="solid">
                        {myself.userName[0].toUpperCase()}
                    </Avatar>
                </Tooltip>
                <Box bottom={0} height={33} position="absolute" right={0} width={24}>
                    <PulseDot color={myself?.isOfflineForced !== "true" ? "#4caf50" : "#999"} />
                </Box>
            </Box>

            <UserProfile
                isYou={true}
                myself={myself}
                openUserProfile={openUserProfile}
                setCurrentMainChat={setCurrentMainChat}
                setMyself={setMyself}
                setOpenUserProfile={setOpenUserProfile}
                socket={socket}
                user={teamMemberProfiles[myself.userId]}
                UIM={UIM}
            />
        </Sheet>
    );
};
