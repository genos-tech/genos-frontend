import { useEffect, useRef, useState } from "react";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import { Box, Dropdown, IconButton, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { BaseAvatar } from "../../../components/ui/avatars/BaseAvatar";
import {
    MenuDivider,
    MenuGroupLabel,
    MenuRow,
    MenuSurface,
} from "../../../components/ui/MoreMenu";
import { TeamDropdownStyles } from "../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../context/AuthContext";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import { Team, TeamProfileProps, UserProps } from "../../../types/admin";
import { buildAvatarSrc } from "../../../utils/avatarSrc";
import { loadMyTeams, membershipTeams } from "../services/loadMyTeams";
import { switchTeam } from "../services/switchTeam";
import { ModalTeamProfile } from "./modals/ModalTeamProfile";

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

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        if (accessToken !== null) {
            (async () => {
                const loadedTeams: Team[] = await loadMyTeams(accessToken, myself.userId);
                setTeams(membershipTeams(loadedTeams));
            })();
            setAnchorEl(event.currentTarget);
        }
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleClicked = (team: Team) => {
        switchTeam({
            accessToken,
            myself,
            setMyself,
            teamId: team.teamId,
            teamName: team.teamName,
        });
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
                    myself={myself}
                    openModalTeamProfile={openModalTeamProfile}
                    setAvatarUserId={setAvatarUserId}
                    setMyself={setMyself}
                    setOpenModalTeamProfile={setOpenModalTeamProfile}
                    setOpenUserProfile={setOpenUserProfile}
                    setTeamProfile={setTeamProfile}
                    socket={socket}
                    teamProfile={teamProfile}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            )}

            <Dropdown>
                <AppTooltip
                    placement="right-start"
                    size="sm"
                    title={t.admin.teamDropdown.openMenu}
                >
                    <IconButton
                        sx={{
                            p: 0.5,
                            borderRadius: "12px",
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            "&:hover": {
                                background: "transparent",
                                transform: "scale(1.05)",
                            },
                        }}
                        onClick={handleClick}
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
                            <BaseAvatar
                                shape="rounded"
                                size="lg"
                                src={buildAvatarSrc(useTEM.currentTeam.teamImgPath)}
                                variant="outlined"
                                sx={{
                                    borderRadius: "10px",
                                    border: `2px solid ${styles.avatarBorder}`,
                                    boxShadow: styles.avatarShadow,
                                    transition: "all 0.2s ease",
                                    "&:hover": {
                                        boxShadow: styles.avatarHoverShadow,
                                    },
                                }}
                            >
                                {myself.teamName.slice(0, 2).toUpperCase()}
                            </BaseAvatar>
                        </Box>
                    </IconButton>
                </AppTooltip>

                <MenuSurface
                    ref={dropdownRef}
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    sx={{ maxHeight: "350px", minWidth: 240 }}
                    zIndex={10001}
                    onClose={handleClose}
                >
                    <MenuGroupLabel>{t.admin.teamDropdown.management}</MenuGroupLabel>

                    {/* Show Team Profile */}
                    <MenuRow icon={<VisibilityRoundedIcon />} onClick={handleShowTeamProfileClick}>
                        {t.admin.teamDropdown.showTeamProfile}
                    </MenuRow>

                    <MenuDivider />

                    <MenuGroupLabel>
                        <Box sx={{ alignItems: "center", display: "flex", gap: 0.75 }}>
                            <GroupsRoundedIcon sx={{ fontSize: 12 }} />
                            {fmt(t.admin.teamDropdown.yourTeams, { count: teams.length })}
                        </Box>
                    </MenuGroupLabel>

                    {/* Team List */}
                    {teams.map((team) => {
                        const isCurrentTeam = team.teamId === myself.teamId;
                        return (
                            <MenuRow
                                key={team.teamName}
                                icon={isCurrentTeam ? undefined : <OpenInNewRoundedIcon />}
                                selected={isCurrentTeam}
                                onClick={() => handleClicked(team)}
                            >
                                <Box
                                    sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}
                                >
                                    {team.teamName}
                                    {isCurrentTeam && (
                                        <Typography level="body-xs" sx={{ color: g.success.text }}>
                                            {t.admin.teamDropdown.currentTeam}
                                        </Typography>
                                    )}
                                </Box>
                            </MenuRow>
                        );
                    })}
                </MenuSurface>
            </Dropdown>
        </Box>
    );
};
