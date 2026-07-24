import { useMemo } from "react";
import { AutocompleteOption, Chip, ListItemContent, Stack, Typography } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import { Socket } from "socket.io-client";

import { sortMembersMyselfFirst } from "../../../../components/editors/Mention";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";

type Props = {
    selected: UserProps[];
    onChange: (next: UserProps[]) => void;
    placeholder: string;
    // Same prop surface `ACTeamUsers` needs to render `AvatarWithStatus`,
    // so the option rows / avatars are pixel-identical to the assignee &
    // reporter pickers — this is a MULTI-select twin of that single picker.
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    useTEM: TeamManagementState;
    disabled?: boolean;
};

// Multi-member autocomplete that mirrors `ACTeamUsers`' look: the same
// self-first ordering, the same avatar + "Name - email" option rows, the
// same size. Selected members render as removable avatar chips (the only
// visual addition a multi-select needs over the single assignee/reporter
// picker).
export const MultiMemberPicker = ({
    selected,
    onChange,
    placeholder,
    myself,
    setMyself,
    socket,
    useCM,
    useUISM,
    useTEM,
    disabled,
}: Props) => {
    const { t } = useTranslation();
    const youSuffix = t.tasks.autocomplete.youSuffix;

    const sortedMembers = useMemo(
        () => sortMembersMyselfFirst(useTEM.teamMembers, myself.userId),
        [useTEM.teamMembers, myself.userId]
    );

    const optionLabel = (option: UserProps) =>
        option.userEmail === myself.userEmail
            ? `${option.userName} ${youSuffix} - ${option.userEmail}`
            : `${option.userName} - ${option.userEmail}`;

    return (
        <Autocomplete
            disabled={disabled}
            getOptionLabel={optionLabel}
            isOptionEqualToValue={(option, value) => option.userId === value.userId}
            options={sortedMembers}
            placeholder={selected.length === 0 ? placeholder : ""}
            size="sm"
            sx={{ width: "100%" }}
            value={selected}
            renderOption={(props, option) => (
                <AutocompleteOption
                    {...props}
                    key={`ac-render-option-collaborator-${option.userName}-${option.userId}`}
                >
                    <ListItemContent sx={{ fontSize: "sm" }}>
                        <Stack direction="row" spacing={1}>
                            <AvatarWithStatus
                                avatarUser={useTEM.teamMemberProfiles[option.userId]}
                                isYou={option.userId === myself.userId}
                                myself={myself}
                                setMyself={setMyself}
                                showPulseDot={false}
                                socket={socket}
                                useCM={useCM}
                                useUISM={useUISM}
                            />
                            <Typography level="body-md" sx={{ pt: 0.5, pl: 1 }}>
                                {optionLabel(option)}
                            </Typography>
                        </Stack>
                    </ListItemContent>
                </AutocompleteOption>
            )}
            renderTags={(value, getTagProps) =>
                value.map((user, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return (
                        <Chip
                            key={key}
                            {...tagProps}
                            size="sm"
                            variant="soft"
                            startDecorator={
                                <AvatarWithStatus
                                    avatarUser={useTEM.teamMemberProfiles[user.userId]}
                                    isYou={user.userId === myself.userId}
                                    myself={myself}
                                    setMyself={setMyself}
                                    showPulseDot={false}
                                    socket={socket}
                                    useCM={useCM}
                                    useUISM={useUISM}
                                />
                            }
                        >
                            {user.userName}
                        </Chip>
                    );
                })
            }
            multiple
            onChange={(_, v) => onChange(v as UserProps[])}
        />
    );
};
