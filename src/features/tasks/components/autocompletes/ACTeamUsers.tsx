import { Socket } from "socket.io-client";
import { Stack, Typography, ListItemContent, AutocompleteOption } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";

import { UserProps } from "../../../../types/admin";
import { TaskProps } from "../../../../types/tasks";
import { ChatProps } from "../../../../types/chat";
import { AvatarWithStatus } from "../../../../components/common/avatarWithStatus";

type ACTeamUsersProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    initialUser: UserProps;
    teamMembers: UserProps[];
    taskContents: TaskProps;
    setTaskContents: (value: TaskProps) => void;
    setUser: (value: UserProps) => void;
    isOpenTeamMembersList: boolean;
    setIsOpenTeamMembersList: (value: boolean) => void;
    isAssignee: boolean;
    setTaskUpdated?: (value: boolean) => void;
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    setCurrentMainChat: (chat: ChatProps) => void;
    setOpeningService: (service: number) => void;
};
export const ACTeamUsers = (props: ACTeamUsersProps) => {
    const {
        myself,
        setMyself,
        initialUser,
        teamMembers,
        taskContents,
        setTaskContents,
        setUser,
        isOpenTeamMembersList,
        setIsOpenTeamMembersList,
        isAssignee,
        setTaskUpdated,
        teamMemberProfiles,
        socket,
        setCurrentMainChat,
        setOpeningService,
    } = props;

    return (
        <Autocomplete
            key={taskContents.id}
            options={teamMembers}
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
                                    myself={myself}
                                    setMyself={setMyself}
                                    socket={socket}
                                    setCurrentMainChat={setCurrentMainChat}
                                    isYou={option.userId === myself.userId}
                                    setOpeningService={setOpeningService}
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
            value={initialUser || myself}
            isOptionEqualToValue={(option, value) => option.userId === value.userId}
            onChange={(event, value) => {
                if (value !== null) {
                    if (isAssignee) {
                        setTaskContents({
                            ...taskContents,
                            assignee: value,
                        });
                        if (setTaskUpdated) {
                            setTaskUpdated(true);
                        }
                    } else {
                        setTaskContents({
                            ...taskContents,
                            reporter: value,
                        });
                        if (setTaskUpdated) {
                            setTaskUpdated(true);
                        }
                    }
                    setUser(value);
                }
            }}
            onOpen={() => setIsOpenTeamMembersList(!isOpenTeamMembersList)}
            size="sm"
            sx={{ width: "100%" }}
        />
    );
};
