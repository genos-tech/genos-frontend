import { useMemo } from "react";
import { AutocompleteOption, ListItemContent, Stack, Typography } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import { Socket } from "socket.io-client";

import { sortMembersMyselfFirst } from "../../../../components/editors/Mention";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";
import { TaskProps } from "../../../../types/tasks";

type ACTeamUsersProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    // Nullable so the assignee field can be empty / cleared. The
    // reporter field always passes a value; widening the type doesn't
    // affect it.
    initialUser: UserProps | null;
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    setUser: (value: UserProps | null) => void;
    isOpenTeamMembersList: boolean;
    setIsOpenTeamMembersList: (value: boolean) => void;
    isAssignee: boolean;
    setTaskUpdated?: (value: boolean) => void;
    useTEM: TeamManagementState;
    socket: Socket | null;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};
export const ACTeamUsers = (props: ACTeamUsersProps) => {
    const {
        myself,
        setMyself,
        initialUser,
        taskContent,
        setTaskContent,
        setUser,
        isOpenTeamMembersList,
        setIsOpenTeamMembersList,
        isAssignee,
        setTaskUpdated,
        useTEM,
        socket,
        useCM,
        useUISM,
    } = props;

    const { t } = useTranslation();
    const youSuffix = t.tasks.autocomplete.youSuffix;

    // Self on top, then alphabetical by userName — mirrors the
    // mention-menu ordering in `MentionMenuItems` so both pickers
    // present the same shape.
    const sortedMembers = useMemo(
        () => sortMembersMyselfFirst(useTEM.teamMembers, myself.userId),
        [useTEM.teamMembers, myself.userId]
    );

    return (
        <Autocomplete
            key={taskContent.id}
            isOptionEqualToValue={(option, value) => option.userId === value.userId}
            options={sortedMembers}
            size="sm"
            sx={{ width: "100%" }}
            // Pass `null` through so an unassigned task renders an empty
            // picker (built-in placeholder), not a silent fallback to
            // `myself` that would mislead the user into thinking they
            // were the assignee.
            value={initialUser}
            placeholder={isAssignee ? t.tasks.messageTemplate.unassigned : undefined}
            getOptionLabel={(option) =>
                option.userEmail === myself.userEmail
                    ? `${option.userName} ${youSuffix} - ${option.userEmail}`
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
                                    avatarUser={useTEM.teamMemberProfiles[option.userId]}
                                    useCM={useCM}
                                    isYou={option.userId === myself.userId}
                                    myself={myself}
                                    setMyself={setMyself}
                                    socket={socket}
                                    useUISM={useUISM}
                                />
                                <Typography level="body-md" sx={{ pt: 0.5, pl: 1 }}>
                                    {option.userEmail === myself.userEmail
                                        ? `${option.userName} ${youSuffix} - ${option.userEmail}`
                                        : `${option.userName} - ${option.userEmail}`}
                                </Typography>
                            </Stack>
                        </ListItemContent>
                    </AutocompleteOption>
                );
            }}
            onOpen={() => setIsOpenTeamMembersList(!isOpenTeamMembersList)}
            onChange={(event, value) => {
                // Assignee accepts null (clear → "Unassigned").
                // Reporter must always have a value, so swallow the
                // null event for the reporter case (the Autocomplete's
                // clear button still renders, but clicking it leaves
                // the previous reporter in place).
                if (isAssignee) {
                    setTaskContent({
                        ...taskContent,
                        assignee: value,
                    });
                    setUser(value);
                    if (setTaskUpdated) {
                        setTaskUpdated(true);
                    }
                } else if (value !== null) {
                    setTaskContent({
                        ...taskContent,
                        reporter: value,
                    });
                    setUser(value);
                    if (setTaskUpdated) {
                        setTaskUpdated(true);
                    }
                }
            }}
        />
    );
};
