import { useEffect, useState } from "react";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import { Button, Snackbar, Stack, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../context/AuthContext";
import { grantTeamFolderMembers } from "../../features/notes/team-notes/services/teamNoteFolderMembers";
import { fmt, useTranslation } from "../../i18n";
import {
    addMembersToGMWithNotice,
    addMembersToProjectWithNotice,
} from "../../services/addMembersWithNotice";
import {
    NonMemberMentionPayload,
    registerNonMemberMentionListener,
    unregisterNonMemberMentionListener,
} from "../../services/nonMemberMentionBus";
import { UserProps } from "../../types/admin";

// Folder roles: 1 owner, 2 editor, 3 viewer.
const FOLDER_ROLE_EDITOR = 2;

type Props = {
    myself: UserProps;
    socket: Socket | null;
};

/**
 * "user-A isn't in project-X — add them?" after an @mention that can't
 * reach its recipient.
 *
 * Mounted once at App level and fed by the response interceptor, so it
 * covers every mention surface — task comments, task bodies, all three
 * note kinds, chat messages — without any of them knowing it exists.
 *
 * It PROMPTS rather than auto-adding: an @mention is a strong hint, but
 * adding someone to a project, channel or folder is a permissions
 * change and shouldn't happen implicitly from typing in a text field.
 *
 * All three scopes are actionable, but they're granted differently — a
 * project and a channel take a member row, a team folder takes a ROLE.
 * That's why the add branches per scope rather than sharing one call.
 */
export const NonMemberMentionSnackbar = ({ myself, socket }: Props) => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const [pending, setPending] = useState<NonMemberMentionPayload | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        registerNonMemberMentionListener((payload) => setPending(payload));
        return () => unregisterNonMemberMentionListener();
    }, []);

    if (!pending) return null;

    const names = pending.users.map((u) => u.userName).join(", ");

    const handleAdd = async () => {
        setBusy(true);
        const memberIds = pending.users.map((u) => u.userId);
        try {
            if (pending.scopeKind === "project") {
                await addMembersToProjectWithNotice({
                    accessToken,
                    memberIds,
                    myself,
                    projectId: Number(pending.scopeId),
                    projectName: pending.scopeName,
                    // A live socket is what delivers the inbox notice +
                    // web push to the people being added; without it
                    // they're added silently.
                    socket,
                });
            } else if (pending.scopeKind === "channel") {
                await addMembersToGMWithNotice({
                    channelId: pending.scopeId,
                    gmName: pending.scopeName,
                    memberIds,
                    socket,
                });
            } else {
                // Team folder — grants a folder role rather than adding
                // to a member list. Editor matches what the folder's own
                // invite dialog defaults to, so the two paths agree.
                await grantTeamFolderMembers(
                    myself,
                    Number(pending.scopeId),
                    { userIds: memberIds, roleId: FOLDER_ROLE_EDITOR },
                    accessToken
                );
            }
        } finally {
            setBusy(false);
            setPending(null);
        }
    };

    return (
        <Snackbar
            open
            anchorOrigin={{ horizontal: "center", vertical: "bottom" }}
            color="warning"
            variant="soft"
            // No autoHideDuration: this asks a question, and a prompt
            // that vanishes mid-read is worse than none.
            onClose={(_e, reason) => {
                if (reason === "clickaway") return;
                setPending(null);
            }}
        >
            <Stack alignItems="center" direction="row" spacing={1.5}>
                <Typography level="body-sm">
                    {fmt(t.common.nonMemberMention.body, { names, scope: pending.scopeName })}
                </Typography>
                <Button
                    color="warning"
                    disabled={busy}
                    loading={busy}
                    size="sm"
                    startDecorator={<PersonAddAltRoundedIcon sx={{ fontSize: 16 }} />}
                    variant="solid"
                    onClick={() => void handleAdd()}
                >
                    {t.common.nonMemberMention.add}
                </Button>
                <Button color="neutral" size="sm" variant="plain" onClick={() => setPending(null)}>
                    {t.common.nonMemberMention.dismiss}
                </Button>
            </Stack>
        </Snackbar>
    );
};
