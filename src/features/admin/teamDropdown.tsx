import { useState, useRef, useEffect } from "react";
import Menu from "@mui/joy/Menu";
import MenuItem from "@mui/joy/MenuItem";
import IconButton from "@mui/joy/IconButton";
import Dropdown from "@mui/joy/Dropdown";
import BusinessIcon from '@mui/icons-material/Business';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import AddIcon from '@mui/icons-material/Add';
import loadAllTeams from './services/loadAllTeams';
import { useAuth } from "../../context/AuthContext";
import { UserProps, Team } from "../../types"

const base_url = import.meta.env.VITE_API_BASE_URL;

type TeamDropdownProps = {
    myself: UserProps;
    setMyself: (me: UserProps) => void;
};

type CreateMyDMResponse = {
    dm_id: string | null;
    ts_created_at: string | null;
    ts_updated_at: string | null;
    user_1_id: string | null;
    user_2_id: string | null;
};

export default function TeamDropdown(props: TeamDropdownProps) {
    const { myself, setMyself } = props;
    const { accessToken } = useAuth();

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [teams, setTeams] = useState<Team[]>([]);

    async function joinTeam(teamId: string) {
        try {
            const joinTeamResponse = await fetch(`${base_url}/team/join/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    team_id: teamId,
                    attendee_id: localStorage.getItem("userId")
                }),
            });

            const joinTeamData = await joinTeamResponse.json();
            localStorage.setItem("teamId", joinTeamData.team);

            if (!joinTeamResponse.ok) {
                console.error("joinTeamData:", joinTeamData)
                throw new Error('Failed to join team');
            } else {
                // Send initial DM message to myself
                const myUserId = localStorage.getItem("userId")
                // 1. Crete DM for myself
                const createMyDMResponse = await fetch(`${base_url}/dm/create/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        "Authorization": `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        user_1_id: myUserId
                        , user_2_id: myUserId
                    }),
                });

                const createMyDMData: CreateMyDMResponse = await createMyDMResponse.json();

                // 2. Send an initial message
                const initMessageResponse = await fetch(`${base_url}/dm/addMessage/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        "Authorization": `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        dm_id: createMyDMData.dm_id,
                        sender_id: myUserId,
                        receiver_id: myUserId,
                        message_body: [{ type: "paragraph", content: [{ type: "text", text: "Joined", styles: {} }] }, { type: "paragraph", content: [{ type: "text", text: "", styles: {} }] }],
                        is_init: true
                    }),
                });
                const initMessageData = await initMessageResponse.json();
            }

        } catch (error) {
            const err_msg = `${error}`
            console.error(err_msg);
        }
    }

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        (async () => {
            const loadedTeams: Team[] = await loadAllTeams({ accessToken: accessToken || "" });
            setTeams(loadedTeams)
        })();

        setAnchorEl(event.currentTarget);
    };

    const handleClicked = (teamId: string) => {
        // Change the team.
        // Re-load chats and tasks in the team.
        // For now, just update the current team variable
        localStorage.setItem("teamId", teamId)
        setMyself({
            teamId: teamId,
            userId: myself.userId,
            userName: myself.userName,
            userEmail: myself.userEmail,
            online: myself.online,
            avatarImgPath: myself.avatarImgPath
        })
        joinTeam(teamId)

        setAnchorEl(null);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleCreateTeam = () => {
        console.log("create team via modal?")
    }

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
                <IconButton component='a' variant="soft" color="primary" size="sm" onClick={handleClick}>
                    <BusinessIcon className="h-5 w-5" />
                </IconButton>
                <Menu size='sm' ref={dropdownRef}
                    sx={{ zIndex: 10001 }}
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleClose}
                >
                    {teams.map((team) => (
                        <MenuItem key={team.teamName} onClick={() => { handleClicked(team.teamId); }}>
                            <AcUnitIcon />
                            {team.teamName}
                        </MenuItem>
                    ))}
                    <MenuItem key={"addTeam"} onClick={() => { handleCreateTeam(); }}>
                        <AddIcon />New Team
                    </MenuItem>
                </Menu>
            </Dropdown>
        </div>
    );
}
