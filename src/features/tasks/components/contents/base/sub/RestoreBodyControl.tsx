import { useState } from "react";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import { Alert, Box, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../../../../../context/AuthContext";
import { fmt, useTranslation } from "../../../../../../i18n";
import { TaskActivityProps } from "../../../../../../types/tasks";
import { restoreTaskBody } from "../../../../services/restoreTaskBody";
import { emitTaskTouched } from "../../../../services/taskEvents";

type Props = {
    taskId: number;
    activity: TaskActivityProps;
};

/** Who rewrote the description, from the surface the server stamped on the row. */
const viaText = (
    via: unknown,
    r: ReturnType<typeof useTranslation>["t"]["tasks"]["activity"]["restore"]
): string => {
    const kind = (via as { kind?: unknown } | null | undefined)?.kind;
    if (kind === "agent") return r.viaAgent;
    if (kind === "api_key") {
        const name = (via as { key_name?: unknown }).key_name;
        return typeof name === "string" && name ? fmt(r.viaApiKey, { name }) : r.viaApiKeyUnnamed;
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
export const RestoreBodyControl = ({ taskId, activity }: Props) => {
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
                    {viaText(activity.metadata?.via, r)}
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
            <Modal open={open} onClose={close}>
                <ModalDialog size="md" sx={{ maxWidth: 440 }}>
                    <Typography level="title-md">{r.confirmTitle}</Typography>
                    <Typography level="body-sm" sx={{ mt: 1 }}>
                        {r.confirmBody}
                    </Typography>
                    {error && (
                        <Alert color="danger" size="sm" sx={{ mt: 1.5 }}>
                            {error}
                        </Alert>
                    )}
                    <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
                        <Button disabled={busy} variant="plain" onClick={close}>
                            {r.cancel}
                        </Button>
                        <Button loading={busy} onClick={confirm}>
                            {r.confirm}
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </Box>
    );
};
