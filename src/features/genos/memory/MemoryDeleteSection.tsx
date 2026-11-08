import { useState } from "react";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { Box, Button, Checkbox, Sheet, Stack, Typography } from "@mui/joy";

import { ConfirmDialog } from "../../../components/ui/modal/ConfirmDialog";
import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import { GENOS_MEMORY_CONFIRM_Z_INDEX } from "./confirmLayer";
import type { Failure, ForgetWhat, Forgotten } from "./memoryApi";

interface Props {
    remove: (what: ForgetWhat) => Promise<Forgotten | Failure>;
}

const KINDS: readonly ForgetWhat[] = ["importance", "summaries", "events", "everything"];

/** How many things a delete took, for "Deleted N": what the server counted, nothing guessed. */
const total = (done: Forgotten): number => {
    const d = done.deleted;
    switch (done.what) {
        case "importance":
            return d.marks + d.tunedSignals;
        case "summaries":
            return d.summaries;
        case "events":
            return d.events;
        default:
            return d.events + d.summaries + d.marks + d.tunedSignals;
    }
};

/**
 * "Delete what Genos stored": one button per kind (importance settings, daily summaries, activity
 * record) and one for everything. Each opens a confirmation that says in words what is removed and
 * what stays, then reports "Deleted N". A real purge across all the member's teams, so no team is
 * named; the recording switch is never touched by a delete.
 */
export const MemoryDeleteSection = ({ remove }: Props) => {
    const { t } = useTranslation();
    const m = t.settings.genosMemory.control.remove;
    const [target, setTarget] = useState<ForgetWhat | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [acknowledged, setAcknowledged] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    const open = (what: ForgetWhat) => {
        setTarget(what);
        setError(null);
        setAcknowledged(false);
        setNotice(null);
    };
    const close = () => {
        if (!busy) setTarget(null);
    };

    const confirm = async () => {
        if (!target || busy) return;
        setBusy(true);
        setError(null);
        const res = await remove(target);
        setBusy(false);
        if ("reason" in res) {
            setError(m.failed);
            return;
        }
        const count = total(res);
        setNotice(count > 0 ? fmt(m.deleted, { count }) : m.nothing);
        setTarget(null);
    };

    const words = target ? m[target] : null;

    return (
        <Sheet
            data-memory-delete=""
            sx={{ p: 2, borderRadius: "lg", minWidth: 0 }}
            variant="outlined"
        >
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <DeleteOutlineRoundedIcon />
                <Typography level="title-md" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {m.heading}
                </Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1 }}>
                {m.description}
            </Typography>
            <Typography level="body-xs" sx={{ mb: 1.5, color: g.text.secondary }}>
                {m.stays}
            </Typography>
            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    minWidth: 0,
                    "& > button": { flex: "1 1 14rem", minWidth: 0, whiteSpace: "normal" },
                }}
            >
                {KINDS.map((what) => (
                    <Button
                        key={what}
                        color="danger"
                        data-memory-delete-button={what}
                        size="sm"
                        variant="outlined"
                        onClick={() => open(what)}
                    >
                        {m[what].button}
                    </Button>
                ))}
            </Box>
            {notice && (
                <Typography level="body-sm" role="status" sx={{ mt: 1.5, fontWeight: 500 }}>
                    {notice}
                </Typography>
            )}
            <ConfirmDialog
                busy={busy}
                cancelLabel={t.common.actions.cancel}
                confirmDisabled={target === "everything" && !acknowledged}
                confirmLabel={words?.confirm ?? ""}
                description={words?.body}
                error={error}
                open={target !== null}
                title={words?.title ?? ""}
                zIndex={GENOS_MEMORY_CONFIRM_Z_INDEX}
                destructive
                onClose={close}
                onConfirm={confirm}
            >
                {target === "everything" && (
                    <Checkbox
                        checked={acknowledged}
                        disabled={busy}
                        label={m.ack}
                        size="sm"
                        onChange={(e) => setAcknowledged(e.target.checked)}
                    />
                )}
            </ConfirmDialog>
        </Sheet>
    );
};
