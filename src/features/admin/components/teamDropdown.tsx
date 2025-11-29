import { useEffect, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { Avatar, Dropdown, IconButton, Menu, MenuItem, Tooltip } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../context/AuthContext";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
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
                        content: [{ type: "text", text: "Has joined", styles: {} }],
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
        // Change the team.
        // Re-load chats and tasks in the team.
        // For now, just update the current team variable
        localStorage.setItem("teamId", teamId);
        localStorage.setItem("teamName", teamName);
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
                // Set current team profile to the team profile
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
        <div className="flex items-center space-x-2">
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
                    title="Open Team Menu"
                    variant="outlined"
                >
                    <IconButton sx={{ px: 0.7 }} onClick={handleClick}>
                        <Avatar
                            src={`${media_url}/${useTEM.currentTeam.teamImgPath}`}
                            variant="outlined"
                            sx={{
                                borderRadius: 4, // 0 for sharp square, or use theme radius values
                                width: 36,
                                height: 36,
                            }}
                        >
                            {myself.teamName.slice(0, 2).toUpperCase()}
                        </Avatar>
                    </IconButton>
                </Tooltip>
                <Menu
                    ref={dropdownRef}
                    anchorEl={anchorEl}
                    className="custom-scrollbar"
                    open={Boolean(anchorEl)}
                    size="sm"
                    sx={{ zIndex: 10001, overflow: "scroll", maxHeight: "300px" }}
                    onClose={handleClose}
                >
                    <MenuItem
                        key={"editTeamProfileImage"}
                        onClick={() => {
                            handleShowTeamProfileClick();
                        }}
                    >
                        <VisibilityIcon />
                        Show Team Profile
                    </MenuItem>

                    {teams.map((team) => (
                        <MenuItem
                            key={team.teamName}
                            variant={team.teamId === myself.teamId ? "solid" : "plain"}
                            onClick={() => {
                                handleClicked(team.teamId, team.teamName);
                            }}
                        >
                            <OpenInNewIcon />
                            {team.teamName}
                        </MenuItem>
                    ))}

                    <MenuItem
                        key={"addTeam"}
                        onClick={() => {
                            console.log("create team via modal?");
                        }}
                    >
                        <AddIcon />
                        New Team (TBD)
                    </MenuItem>
                </Menu>
            </Dropdown>
        </div>
    );
};
