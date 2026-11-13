import { useState } from "react";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import { Box, Button, Stack, Typography } from "@mui/joy";

import { ConfirmDialog } from "../../../../../../components/ui/modal/ConfirmDialog";
import { useAuth } from "../../../../../../context/AuthContext";
import { fmt, useTranslation } from "../../../../../../i18n";
import { TaskActivityProps } from "../../../../../../types/tasks";
import { restoreTaskBody } from "../../../../services/restoreTaskBody";
import { emitTaskTouched } from "../../../../services/taskEvents";
import { viaSourceOfRow } from "../../../../utils/viaSource";

type Props = {
    taskId: number;
    activity: TaskActivityProps;
    /** The viewer. A key's name is its owner's alone (MIP-1376): it is printed
     *  only when the viewer is the row's actor. Absent, no name is shown. */
    viewerId?: string | number | null;
};

/** Who rewrote the description, from the surface the server stamped on the row. */
const viaText = (
    activity: TaskActivityProps,
    viewerId: string | number | null | undefined,
    r: ReturnType<typeof useTranslation>["t"]["tasks"]["activity"]["restore"]
): string => {
    const via = activity.metadata?.via;
    const kind = (via as { kind?: unknown } | null | undefined)?.kind;
    if (kind === "agent") return r.viaAgent;
    if (kind === "api_key") {
        const name = viaSourceOfRow(activity, viewerId)?.name;
        return name ? fmt(r.viaApiKey, { name }) : r.viaApiKeyUnnamed;
    }
    return r.viaUnknown;
};

/**
 * "Restore the previous description" on a history row that kept the body it
 * replaced (MIP-738): the in-app agent, an API key or MCP rewrote the whole
 * description, and this puts the old one back.
 *
 * A confirm comes first because it replaces what is there now. It says that a
 * restore can be undone, which is true: the server keeps the body a restore
 * replaces, so the new history row offers this same button.
 *
 * The server pushes the restored body into the open editor itself, so after a
 * success the only thing left to do is refresh the history.
 */
export const RestoreBodyControl = ({ taskId, activity, viewerId }: Props) => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const r = t.tasks.activity.restore;
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const close = () => {
        if (busy) return;
        setOpen(false);
        setError(null);
    };

    const confirm = async () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        const result = await restoreTaskBody(accessToken, taskId, activity.activityId);
        setBusy(false);
        if (result === "ok") {
            setOpen(false);
            // Refreshes the history (the hook listens) and drops its cache.
            emitTaskTouched(taskId, "update");
            return;
        }
        setError(result === "not-found" ? r.notFound : r.failed);
    };

    return (
        <Box sx={{ width: "100%", pl: 5.5 }}>
            <Stack alignItems="center" direction="row" flexWrap="wrap" spacing={1}>
                <Typography level="body-xs" sx={{ opacity: 0.65 }}>
                    {viaText(activity, viewerId, r)}
                </Typography>
                <Button
                    size="sm"
                    startDecorator={<RestoreRoundedIcon />}
                    variant="plain"
                    onClick={() => setOpen(true)}
                >
                    {r.button}
                </Button>
            </Stack>
            <ConfirmDialog
                busy={busy}
                cancelLabel={r.cancel}
                confirmLabel={r.confirm}
                description={r.confirmBody}
                error={error}
                open={open}
                title={r.confirmTitle}
                onClose={close}
                onConfirm={confirm}
            />
        </Box>
    );
};
