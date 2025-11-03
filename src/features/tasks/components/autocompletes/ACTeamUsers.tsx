import { AutocompleteOption, ListItemContent, Stack, Typography } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/common/avatarWithStatus";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";
import { TaskProps } from "../../../../types/tasks";

type ACTeamUsersProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    initialUser: UserProps;
    teamMembers: UserProps[];
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    setUser: (value: UserProps) => void;
    isOpenTeamMembersList: boolean;
    setIsOpenTeamMembersList: (value: boolean) => void;
    isAssignee: boolean;
    setTaskUpdated?: (value: boolean) => void;
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    setCurrentMainChat: (chat: ChatProps) => void;
    UIM: UIStateManagementState;
};
export const ACTeamUsers = (props: ACTeamUsersProps) => {
    const {
        myself,
        setMyself,
        initialUser,
        teamMembers,
        taskContent,
        setTaskContent,
        setUser,
        isOpenTeamMembersList,
        setIsOpenTeamMembersList,
        isAssignee,
        setTaskUpdated,
        teamMemberProfiles,
        socket,
        setCurrentMainChat,
        UIM,
    } = props;

    return (
        <Autocomplete
            key={taskContent.id}
            isOptionEqualToValue={(option, value) => option.userId === value.userId}
            options={teamMembers}
            size="sm"
            sx={{ width: "100%" }}
            value={initialUser || myself}
            getOptionLabel={(option) =>
                option.userEmail === myself.userEmail
                    ? `${option.userName} (You) - ${option.userEmail}`
                    : `${option.userName} - ${option.userEmail}`
            }
            renderOption={(props, option) => {
                return (
                    <AutocompleteOption
                        {...props}
                        key={`ac-render-option-user-serach-${option.userName}-${option.userId}`}
                    >
                        <ListItemContent sx={{ fontSize: "sm" }}>
                            <Stack direction="row" spacing={1}>
                                <AvatarWithStatus
                                    key={`ac-render-option-user-search-avatar-${option.userName}-${option.userId}`}
                                    avatarUser={teamMemberProfiles[option.userId]}
                                    isYou={option.userId === myself.userId}
                                    myself={myself}
                                    setCurrentMainChat={setCurrentMainChat}
                                    setMyself={setMyself}
                                    UIM={UIM}
                                    socket={socket}
                                />
                                <Typography level="body-md" sx={{ pt: 0.5, pl: 1 }}>
                                    {option.userEmail === myself.userEmail
                                        ? `${option.userName} (You) - ${option.userEmail}`
                                        : `${option.userName} - ${option.userEmail}`}
                                </Typography>
                            </Stack>
                        </ListItemContent>
                    </AutocompleteOption>
                );
            }}
            onOpen={() => setIsOpenTeamMembersList(!isOpenTeamMembersList)}
            onChange={(event, value) => {
                if (value !== null) {
                    if (isAssignee) {
                        setTaskContent({
                            ...taskContent,
                            assignee: value,
                        });
                        if (setTaskUpdated) {
                            setTaskUpdated(true);
                        }
                    } else {
                        setTaskContent({
                            ...taskContent,
                            reporter: value,
                        });
                        if (setTaskUpdated) {
                            setTaskUpdated(true);
                        }
                    }
                    setUser(value);
                }
            }}
        />
    );
};
