import { useEffect, useMemo } from "react";
import { AutocompleteOption, Chip, ListItemContent, Stack, Typography } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import { Socket } from "socket.io-client";

import { sortMembersMyselfFirst } from "../../../../components/editors/Mention";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { useProjectMemberIds } from "../../../../hooks/tasks/useProjectMemberIds";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { personLabel } from "../../../../utils/personLabel";
import {
    allowedCollaboratorIds,
    collaboratorOptions,
    keepAllowedCollaborators,
} from "../../utils/collaboratorCandidates";

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
    /** The project the task is in (the working copy's, so a project change
     *  in the create form is followed). Only its members, its owner and the
     *  task's assignee and reporter may be added as collaborators. */
    projectId: number | null | undefined;
    accessToken: string | null;
    /** The assignee and reporter the task will have: they can open it, so
     *  they may be collaborators. Empty for a milestone, whose collaborators
     *  the server judges on project membership alone. */
    holderIds: ReadonlyArray<string | null | undefined>;
    /** The project owner, when already known (the create form / preview load
     *  it with the project's field rules); the roster lists them too. */
    ownerUserId?: string | null;
    /** A task being CREATED holds nobody saved, so whoever the rule does not
     *  admit (a project switch, a changed assignee) is taken off the list
     *  rather than sent to be refused. A saved task keeps them: see
     *  `collaboratorOptions`. */
    dropDisallowed?: boolean;
};

// Multi-member autocomplete that mirrors `ACTeamUsers`' look: the same
// self-first ordering, the same avatar + "Name - email" option rows, the
// same size. Selected members render as removable avatar chips (the only
// visual addition a multi-select needs over the single assignee/reporter
// picker).
//
// Unlike the assignee and reporter pickers it does NOT offer the whole team
// (MIP-1567): a collaborator must be able to open the task, so the options
// are the project's members + owner + the task's assignee and reporter (see
// `allowedCollaboratorIds`). The roster is read when the list is opened.
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
    projectId,
    accessToken,
    holderIds,
    ownerUserId,
    dropDisallowed,
}: Props) => {
    const { t } = useTranslation();
    const youSuffix = t.tasks.autocomplete.youSuffix;

    const { ids: memberIds, loading, refresh } = useProjectMemberIds(projectId, accessToken);

    const holderKey = holderIds.filter(Boolean).join("|");
    const allowed = useMemo(
        () => allowedCollaboratorIds({ memberIds, ownerUserId, holderIds }),
        // `holderKey` stands for `holderIds`, which is a fresh array each render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [memberIds, ownerUserId, holderKey]
    );

    const sortedMembers = useMemo(
        () =>
            sortMembersMyselfFirst(
                collaboratorOptions({ teamMembers: useTEM.teamMembers, allowed, selected }),
                myself.userId
            ),
        [useTEM.teamMembers, allowed, selected, myself.userId]
    );

    // Creating: ask for the roster when the project changes while people are
    // already chosen, so the ones the new project does not admit can go. The
    // roster stays unknown (and nobody is dropped) if the request fails.
    const hasSelected = selected.length > 0;
    useEffect(() => {
        if (dropDisallowed && hasSelected) refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dropDisallowed, hasSelected, projectId]);
    useEffect(() => {
        if (!dropDisallowed || memberIds === null) return;
        const kept = keepAllowedCollaborators(selected, allowed);
        if (kept.length !== selected.length) onChange(kept);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dropDisallowed, memberIds, allowed, selected]);

    const optionLabel = (option: UserProps) => personLabel(option, myself.userId, youSuffix);

    return (
        <Autocomplete
            disabled={disabled}
            getOptionLabel={optionLabel}
            isOptionEqualToValue={(option, value) => option.userId === value.userId}
            loading={loading}
            loadingText={t.common.feedback.loading}
            noOptionsText={t.tasks.picker.collaboratorsProjectOnly}
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
                            <bdi className="g-bidi-island">{user.userName}</bdi>
                        </Chip>
                    );
                })
            }
            multiple
            onChange={(_, v) => onChange(v as UserProps[])}
            onOpen={refresh}
        />
    );
};
