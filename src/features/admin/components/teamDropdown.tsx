import { useState, useRef, useEffect } from "react";
import { Button, Menu, MenuItem, Dropdown } from "@mui/joy";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import AddIcon from "@mui/icons-material/Add";

import { loadMyTeams } from "../services/loadMyTeams";
import { joinTeam } from "../services/joinTeam";
import { createDMChat } from "../../chat/services/createDMChat";
import { sendDMMessage } from "../../chat/services/sendDMMessage";
import { useAuth } from "../../../context/AuthContext";
import { UserProps } from "../../../types/admin";
import { Team, CreateDMResponse } from "../../../types/admin";
import { getCurrentTimestamp } from "../../../utils/dateUtils";

type TeamDropdownProps = {
    myself: UserProps;
    setMyself: (me: UserProps) => void;
};

export const TeamDropdown = (props: TeamDropdownProps) => {
    const { myself, setMyself } = props;
    const { accessToken } = useAuth();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

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
                    { type: "paragraph", content: [{ type: "text", text: "Joined", styles: {} }] },
                    { type: "paragraph", content: [{ type: "text", text: "", styles: {} }] },
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
            tsLastSeen: getCurrentTimestamp(),
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

    return (
        <div className="flex items-center space-x-2">
            <Dropdown>
                <Button
                    variant="solid"
                    color="neutral"
                    size="sm"
                    sx={{ px: 0.7 }}
                    onClick={handleClick}
                >
                    {myself.teamName.slice(0, 2).toUpperCase()}
                </Button>
                <Menu
                    className="custom-scrollbar"
                    size="sm"
                    ref={dropdownRef}
                    sx={{ zIndex: 10001, overflow: "scroll", maxHeight: "300px" }}
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleClose}
                >
                    {teams.map((team) => (
                        <MenuItem
                            key={team.teamName}
                            onClick={() => {
                                handleClicked(team.teamId, team.teamName);
                            }}
                            variant={team.teamId === myself.teamId ? "solid" : "plain"}
                        >
                            <AcUnitIcon />
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
                        New Team
                    </MenuItem>
                </Menu>
            </Dropdown>
        </div>
    );
};
