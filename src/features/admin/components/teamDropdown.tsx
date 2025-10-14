import { useEffect, useRef, useState } from "react";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import { Avatar, Box, Dropdown, IconButton, Menu, MenuItem, Tooltip } from "@mui/joy";

import { useAuth } from "../../../context/AuthContext";
import { CreateDMResponse, Team, UserProps } from "../../../types/admin";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { createDMChat } from "../../chat/services/createDMChat";
import { sendDMMessage } from "../../chat/services/sendDMMessage";
import { joinTeam } from "../services/joinTeam";
import { loadMyTeams } from "../services/loadMyTeams";

const base_url = import.meta.env.VITE_API_BASE_URL;
const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type TeamDropdownProps = {
    currentTeam: Team;
    setCurrentTeam: (value: Team) => void;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
};
export const TeamDropdown = (props: TeamDropdownProps) => {
    const { myself, setMyself, currentTeam, setCurrentTeam } = props;
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

    // Team profile image file upload manager
    const inputRef = useRef<HTMLInputElement | null>(null);
    const handleButtonClick = () => {
        inputRef.current?.click();
    };
    const toProfileFileName = (originalFileName: string): string => {
        // Get the extension (including dot, e.g. ".png")
        const ext = originalFileName.substring(originalFileName.lastIndexOf("."));
        // return `profile${ext}`;

        // use always "jpg"
        return `profile.jpg`;
    };
    const handleSelectedFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = event.target.files;
        if (!selectedFiles || selectedFiles.length !== 1) return;

        const tmpTeamProfileImage = selectedFiles[0]; // original File

        // NOTE: This is the static path and is referred from backend as well.
        //       So, need to check backend when you need to change it.
        const newName = toProfileFileName(tmpTeamProfileImage.name);

        // Create a new File instance with the existing file data but new name
        const teamProfileImage = new File([tmpTeamProfileImage], newName, {
            type: tmpTeamProfileImage.type,
            lastModified: tmpTeamProfileImage.lastModified,
        });

        const formData = new FormData();
        formData.append("team_profile_image", teamProfileImage);
        formData.append("team_id", currentTeam.teamId);

        const uploadProfileImageResponse = await fetch(`${base_url}/team/profile/image/`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            body: formData,
        });

        const uploadProfileImageData = await uploadProfileImageResponse.json();

        if (!uploadProfileImageResponse.ok) {
            throw new Error("Failed to upload team profile image.");
        } else {
            localStorage.setItem("teamImgPath", uploadProfileImageData.profile_image_file_name);
            setCurrentTeam({
                ...currentTeam,
                teamImgPath: uploadProfileImageData.profile_image_file_name,
            });
        }

        handleClose();
    };

    return (
        <div className="flex items-center space-x-2">
            <Dropdown>
                <Tooltip title="Switch Team" placement="right-start">
                    <IconButton sx={{ px: 0.7 }} onClick={handleClick}>
                        <Avatar
                            src={`${media_url}/${currentTeam.teamImgPath}`}
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
                        New Team (TBD)
                    </MenuItem>

                    {myself.userId === currentTeam.teamOwnerId && (
                        <Box>
                            <input
                                type="file"
                                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                multiple={false}
                                ref={inputRef}
                                onChange={handleSelectedFiles}
                                style={{ display: "none" }}
                            />
                            <MenuItem
                                key={"editTeamProfileImage"}
                                onClick={() => {
                                    handleButtonClick();
                                    console.error(
                                        "This must move to the setting modal, and only the team owner can change the profile."
                                    );
                                }}
                            >
                                <EditIcon />
                                Edit Team Profile
                            </MenuItem>
                        </Box>
                    )}
                </Menu>
            </Dropdown>
        </div>
    );
};
