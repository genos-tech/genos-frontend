import { useState } from "react";
import AllInboxIcon from "@mui/icons-material/AllInbox";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
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

import { PulseDot } from "../../components/ui/misc/PulseDot";
import { useAuth } from "../../context/AuthContext";
import { UserProfile } from "../../features/admin/components/modals/ModalUserProfile";
import { TeamDropdown } from "../../features/admin/components/teamDropdown";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { InboxManagementState } from "../../hooks/inbox/useInboxManagement";
import { UserProps } from "../../types/admin";
import { ColorSchemeToggle } from "./colorSchemeToggle";

const base_url = import.meta.env.VITE_API_BASE_URL;
const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type SidebarProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useIM: InboxManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};
export const Sidebar = (props: SidebarProps) => {
    const { useTEM, socket, myself, setMyself, useIM, useCM, useUISM } = props;
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
        useUISM.setOpeningService(0);
    };

    const handleMoveToChat = (): void => {
        useUISM.setOpeningService(1);
    };

    const handleMoveToTasks = (): void => {
        useUISM.setOpeningService(2);
    };

    const handleMoveToNote = (): void => {
        useUISM.setOpeningService(3);
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
                <TeamDropdown myself={myself} setMyself={setMyself} useTEM={useTEM} />
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
                            <Stack alignItems="center" direction="column">
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        p: "5px",
                                    }}
                                >
                                    {useIM.unReadInboxItemCount > 0 && (
                                        <Badge
                                            badgeContent={useIM.unReadInboxItemCount}
                                            color="primary"
                                            size="sm"
                                            anchorOrigin={{
                                                vertical: "top",
                                                horizontal: "right",
                                            }}
                                        >
                                            <AllInboxIcon
                                                sx={{ fontSize: 24 }}
                                                color={
                                                    useUISM.openingService === 0
                                                        ? "primary"
                                                        : "disabled"
                                                }
                                            />
                                        </Badge>
                                    )}
                                    {useIM.unReadInboxItemCount < 1 && (
                                        <AllInboxIcon
                                            sx={{ fontSize: 24 }}
                                            color={
                                                useUISM.openingService === 0
                                                    ? "primary"
                                                    : "disabled"
                                            }
                                        />
                                    )}
                                </Box>
                                <Typography level="body-xs">Inbox</Typography>
                            </Stack>
                        </ListItemButton>
                    </ListItem>
                    <ListItem>
                        <ListItemButton onClick={handleMoveToChat}>
                            <Stack alignItems="center" direction="column">
                                <Box sx={{ display: "flex", alignItems: "center", p: "5px" }}>
                                    {useCM.unReadChatAndActivityCounts > 0 && (
                                        <Badge
                                            badgeContent={useCM.unReadChatAndActivityCounts}
                                            color="primary"
                                            size="sm"
                                            anchorOrigin={{
                                                vertical: "top",
                                                horizontal: "right",
                                            }}
                                        >
                                            <QuestionAnswerRoundedIcon
                                                sx={{ fontSize: 24 }}
                                                color={
                                                    useUISM.openingService === 1
                                                        ? "primary"
                                                        : "disabled"
                                                }
                                            />
                                        </Badge>
                                    )}
                                    {useCM.unReadChatAndActivityCounts < 1 && (
                                        <QuestionAnswerRoundedIcon
                                            sx={{ fontSize: 24 }}
                                            color={
                                                useUISM.openingService === 1
                                                    ? "primary"
                                                    : "disabled"
                                            }
                                        />
                                    )}
                                </Box>
                                <Typography level="body-xs">Chats</Typography>
                            </Stack>
                        </ListItemButton>
                    </ListItem>
                    <ListItem>
                        <ListItemButton onClick={handleMoveToTasks}>
                            <Stack alignItems="center" direction="column">
                                <Box sx={{ display: "flex", alignItems: "center", p: "5px" }}>
                                    <AssignmentRoundedIcon
                                        color={
                                            useUISM.openingService === 2 ? "primary" : "disabled"
                                        }
                                        sx={{ fontSize: 24 }}
                                    />
                                </Box>
                                <Typography level="body-xs">Tasks</Typography>
                            </Stack>
                        </ListItemButton>
                    </ListItem>
                    <ListItem>
                        <ListItemButton onClick={handleMoveToNote}>
                            <Stack alignItems="center" direction="column">
                                <Box sx={{ display: "flex", alignItems: "center", p: "5px" }}>
                                    <NoteAltIcon
                                        color={
                                            useUISM.openingService === 3 ? "primary" : "disabled"
                                        }
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
                useCM={useCM}
                isYou={true}
                myself={myself}
                openUserProfile={openUserProfile}
                setMyself={setMyself}
                setOpenUserProfile={setOpenUserProfile}
                socket={socket}
                useUISM={useUISM}
                user={useTEM.teamMemberProfiles[myself.userId]}
            />
        </Sheet>
    );
};
