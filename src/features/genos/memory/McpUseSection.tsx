import { useId, useState } from "react";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import { Box, Sheet, Stack, Switch, Typography } from "@mui/joy";

import { ErrorState } from "../../../components/ui/feedback/ErrorState";
import { ConfirmDialog } from "../../../components/ui/modal/ConfirmDialog";
import { useMemberEventsPreference } from "../../../hooks/common/useMemberEventsPreference";
import { useTranslation } from "../../../i18n";
import { GENOS_MEMORY_CONFIRM_Z_INDEX } from "./confirmLayer";

interface Props {
    // Called once the server has confirmed the switch moved (either way), so the sections that
    // show what is stored read it again: turning it off deletes everything.
    onChanged?: () => void;
}

/**
 * "What Genos notes about your work": the one switch for the markers Genos keeps of
 * which items the person's connected AI apps opened or changed over MCP, and of the
 * few changes of their own that nothing else saves (collaborators, dependencies,
 * to-do edits, note shares: MIP-1085). References only, never text, only they can
 * see them, 180 days.
 *
 * ON by default. Turning it OFF deletes what was noted, so it asks first, in
 * the page, and the switch does not move until the server has confirmed. Turning
 * it back on needs no question: nothing is back-filled.
 */
export const McpUseSection = ({ onChanged }: Props) => {
    const { t } = useTranslation();
    const m = t.settings.genosMemory.mcpUse;
    const pref = useMemberEventsPreference();
    const helperId = useId();
    const [offOpen, setOffOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toggleError, setToggleError] = useState(false);

    const known = pref.enabled !== null;

    const onSwitch = async (next: boolean) => {
        setToggleError(false);
        if (!next) {
            setError(null);
            setOffOpen(true);
            return;
        }
        if (await pref.setEnabled(true)) onChanged?.();
        else setToggleError(true);
    };

    const confirmOff = async () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        const ok = await pref.setEnabled(false);
        setBusy(false);
        if (!ok) {
            setError(m.toggleFailed);
            return;
        }
        setOffOpen(false);
        onChanged?.();
    };

    return (
        <Sheet sx={{ p: 2, borderRadius: "lg", minWidth: 0 }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1.5 }}>
                <HubRoundedIcon />
                <Typography level="title-md" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {m.heading}
                </Typography>
            </Stack>
            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{m.switchLabel}</Typography>
                    <Typography id={helperId} level="body-xs">
                        {m.switchHelper}
                    </Typography>
                </Box>
                <Switch
                    checked={pref.enabled === true}
                    disabled={!known || pref.saving}
                    slotProps={{
                        input: { "aria-label": m.switchLabel, "aria-describedby": helperId },
                    }}
                    onChange={(e) => void onSwitch(e.target.checked)}
                />
            </Stack>
            {!pref.loading && !known && (
                <ErrorState
                    data-error="mcp-use"
                    size="xs"
                    title={m.loadFailed}
                    onRetry={pref.reload}
                />
            )}
            {toggleError && (
                <Typography level="body-xs" role="alert" sx={{ mt: 1, color: "danger.500" }}>
                    {m.toggleFailed}
                </Typography>
            )}
            <ConfirmDialog
                busy={busy}
                cancelLabel={t.common.actions.cancel}
                confirmLabel={m.offConfirm}
                description={m.offBody}
                error={error}
                open={offOpen}
                title={m.offTitle}
                zIndex={GENOS_MEMORY_CONFIRM_Z_INDEX}
                destructive
                onConfirm={confirmOff}
                onClose={() => {
                    if (!busy) setOffOpen(false);
                }}
            />
        </Sheet>
    );
};
