import { useEffect, useRef, useState } from "react";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {
    Avatar,
    Box,
    Divider,
    Dropdown,
    IconButton,
    ListItemDecorator,
    Menu,
    MenuItem,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { TeamDropdownStyles } from "../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../context/AuthContext";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { fmt, useTranslation } from "../../../i18n";
import { CreateDMResponse, Team, TeamProfileProps, UserProps } from "../../../types/admin";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { createDMChat } from "../../chat/services/createDMChat";
import { sendDMMessage } from "../../chat/services/sendDMMessage";
import { joinTeam } from "../services/joinTeam";
import { loadMyTeams } from "../services/loadMyTeams";
import { ModalTeamProfile } from "./modals/ModalTeamProfile";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type TeamDropdownProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    socket: Socket | null;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    setAvatarUserId: (value: string) => void;
    setOpenUserProfile: (value: boolean) => void;
};

export const TeamDropdown = (props: TeamDropdownProps) => {
    const {
        myself,
        setMyself,
        useTEM,
        socket,
        useCM,
        useUISM,
        setAvatarUserId,
        setOpenUserProfile,
    } = props;
    const { accessToken } = useAuth();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [teamProfile, setTeamProfile] = useState<TeamProfileProps | null>(null);
    const [openModalTeamProfile, setOpenModalTeamProfile] = useState<boolean>(false);
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const styles = isDark ? TeamDropdownStyles.dark : TeamDropdownStyles.light;

    const _joinTeam = async (teamId: string) => {
        const joinTeamRes = await joinTeam(accessToken, teamId, myself.userId);

        if (joinTeamRes) {
            const createDmRes: CreateDMResponse = await createDMChat(
                accessToken,
                myself.teamId,
                myself.userId,
                myself.userId
            );

            if (createDmRes && createDmRes.dm_exists === false) {
                const initMessageBody = [
                    {
                        type: "paragraph",
                        content: [{ type: "text", text: t.admin.joinTeam.hasJoined, styles: {} }],
                    },
                    {
                        type: "paragraph",
                        content: [{ type: "text", text: "", styles: {} }],
                    },
                ];

                await sendDMMessage(
                    accessToken,
                    createDmRes.dm_id,
                    createDmRes.user_1_id,
                    createDmRes.user_2_id,
                    initMessageBody
                );
            }
        }
    };

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        if (accessToken !== null) {
            (async () => {
                const loadedTeams: Team[] = await loadMyTeams(accessToken, myself.userId);
                setTeams(loadedTeams);
            })();
            setAnchorEl(event.currentTarget);
        }
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleClicked = (teamId: string, teamName: string) => {
        localStorage.setItem("teamId", teamId);
        localStorage.setItem("teamName", teamName);
        localStorage.removeItem("lastProjectId");
        setMyself({
            teamId: teamId,
            teamName: teamName,
            userId: myself.userId,
            userName: myself.userName,
            userEmail: myself.userEmail,
            tsLastSeen: getLocalCurrentTimestamp(),
            tsJoined: myself.tsJoined,
            isOfflineForced: myself.isOfflineForced,
            role: myself.role,
            baseCountry: myself.baseCountry,
            customStatus: myself.customStatus,
            avatarImgPath: myself.avatarImgPath,
        });
        _joinTeam(teamId);
        handleClose();
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                handleClose();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleShowTeamProfileClick = () => {
        if (accessToken !== null) {
            (async () => {
                const loadedTeamProfile: TeamProfileProps[] = await loadMyTeams(
                    accessToken,
                    myself.userId
                );
                setTeamProfile(
                    loadedTeamProfile.find(
                        (team: TeamProfileProps) => team.teamId === myself.teamId
                    ) || null
                );
                setOpenModalTeamProfile(true);
            })();
        }
    };

    return (
        <Box sx={{ display: "flex", alignItems: "center" }}>
            {teamProfile && (
                <ModalTeamProfile
                    socket={socket}
                    useTEM={useTEM}
                    myself={myself}
                    setMyself={setMyself}
                    teamProfile={teamProfile}
                    setTeamProfile={setTeamProfile}
                    openModalTeamProfile={openModalTeamProfile}
                    setOpenModalTeamProfile={setOpenModalTeamProfile}
                    setAvatarUserId={setAvatarUserId}
                    setOpenUserProfile={setOpenUserProfile}
                    useCM={useCM}
                    useUISM={useUISM}
                />
            )}

            <Dropdown>
                <Tooltip
                    placement="right-start"
                    size="sm"
                    title={t.admin.teamDropdown.openMenu}
                    variant="outlined"
                    sx={{
                        background: styles.menuBg,
                        border: `1px solid ${styles.menuBorder}`,
                        borderRadius: "8px",
                    }}
                >
                    <IconButton
                        onClick={handleClick}
                        sx={{
                            p: 0.5,
                            borderRadius: "12px",
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            "&:hover": {
                                background: "transparent",
                                transform: "scale(1.05)",
                            },
                        }}
                    >
                        <Box
                            sx={{
                                position: "relative",
                                "&::before": {
                                    content: '""',
                                    position: "absolute",
                                    inset: -3,
                                    borderRadius: "14px",
                                    background: styles.accentGradient,
                                    opacity: 0.3,
                                    filter: "blur(8px)",
                                    transition: "opacity 0.2s ease",
                                },
                                "&:hover::before": {
                                    opacity: 0.5,
                                },
                            }}
                        >
                            <Avatar
                                src={`${media_url}/${useTEM.currentTeam.teamImgPath}`}
                                variant="outlined"
                                sx={{
                                    borderRadius: "10px",
                                    width: 40,
                                    height: 40,
                                    border: `2px solid ${styles.avatarBorder}`,
                                    boxShadow: styles.avatarShadow,
                                    transition: "all 0.2s ease",
                                    "&:hover": {
                                        boxShadow: styles.avatarHoverShadow,
                                    },
                                }}
                            >
                                {myself.teamName.slice(0, 2).toUpperCase()}
                            </Avatar>
                        </Box>
                    </IconButton>
                </Tooltip>

                <Menu
                    ref={dropdownRef}
                    anchorEl={anchorEl}
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    open={Boolean(anchorEl)}
                    size="sm"
                    sx={{
                        zIndex: 10001,
                        overflow: "auto",
                        maxHeight: "350px",
                        minWidth: 240,
                        background: styles.menuBg,
                        border: `1px solid ${styles.menuBorder}`,
                        borderRadius: "14px",
                        boxShadow: styles.menuShadow,
                        backdropFilter: "blur(16px)",
                        p: 1,
                        "--ListItemDecorator-size": "32px",
                    }}
                    onClose={handleClose}
                >
                    {/* Header */}
                    <Box sx={{ px: 1.5, py: 1, mb: 0.5 }}>
                        <Typography
                            level="body-xs"
                            sx={{
                                color: styles.subtitleColor,
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            {t.admin.teamDropdown.management}
                        </Typography>
                    </Box>

                    {/* Show Team Profile */}
                    <MenuItem
                        onClick={handleShowTeamProfileClick}
                        sx={{
                            borderRadius: "10px",
                            py: 1.25,
                            px: 1.5,
                            transition: "all 0.15s ease",
                            "&:hover": {
                                background: styles.menuItemHover,
                            },
                        }}
                    >
                        <ListItemDecorator>
                            <Box
                                sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: "8px",
                                    background: styles.accentGradient,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <VisibilityRoundedIcon sx={{ color: "#fff", fontSize: 16 }} />
                            </Box>
                        </ListItemDecorator>
                        <Typography level="body-sm" sx={{ fontWeight: 500 }}>
                            {t.admin.teamDropdown.showTeamProfile}
                        </Typography>
                    </MenuItem>

                    <Divider sx={{ my: 1, background: styles.dividerColor }} />

                    {/* Teams Header */}
                    <Box sx={{ px: 1.5, py: 0.75 }}>
                        <Typography
                            level="body-xs"
                            sx={{
                                color: styles.subtitleColor,
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <GroupsRoundedIcon sx={{ fontSize: 14 }} />
                            {fmt(t.admin.teamDropdown.yourTeams, { count: teams.length })}
                        </Typography>
                    </Box>

                    {/* Team List */}
                    {teams.map((team) => {
                        const isCurrentTeam = team.teamId === myself.teamId;
                        return (
                            <MenuItem
                                key={team.teamName}
                                onClick={() => handleClicked(team.teamId, team.teamName)}
                                sx={{
                                    borderRadius: "10px",
                                    py: 1.25,
                                    px: 1.5,
                                    background: isCurrentTeam
                                        ? styles.menuItemActive
                                        : "transparent",
                                    border: isCurrentTeam
                                        ? `1px solid ${styles.iconColor}30`
                                        : "1px solid transparent",
                                    transition: "all 0.15s ease",
                                    "&:hover": {
                                        background: isCurrentTeam
                                            ? styles.menuItemActive
                                            : styles.menuItemHover,
                                        transform: "translateX(4px)",
                                    },
                                }}
                            >
                                <ListItemDecorator>
                                    <Box
                                        sx={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: "8px",
                                            background: isCurrentTeam
                                                ? styles.accentGradient
                                                : `${styles.iconColor}20`,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        {isCurrentTeam ? (
                                            <CheckCircleRoundedIcon
                                                sx={{ color: "#fff", fontSize: 16 }}
                                            />
                                        ) : (
                                            <OpenInNewRoundedIcon
                                                sx={{ color: styles.iconColor, fontSize: 16 }}
                                            />
                                        )}
                                    </Box>
                                </ListItemDecorator>
                                <Box sx={{ flex: 1 }}>
                                    <Typography
                                        level="body-sm"
                                        sx={{
                                            fontWeight: isCurrentTeam ? 600 : 500,
                                            color: isCurrentTeam
                                                ? styles.iconColor
                                                : styles.textColor,
                                        }}
                                    >
                                        {team.teamName}
                                    </Typography>
                                    {isCurrentTeam && (
                                        <Typography
                                            level="body-xs"
                                            sx={{ color: styles.successColor, fontWeight: 500 }}
                                        >
                                            {t.admin.teamDropdown.currentTeam}
                                        </Typography>
                                    )}
                                </Box>
                            </MenuItem>
                        );
                    })}

                    <Divider sx={{ my: 1, background: styles.dividerColor }} />
                </Menu>
            </Dropdown>
        </Box>
    );
};
