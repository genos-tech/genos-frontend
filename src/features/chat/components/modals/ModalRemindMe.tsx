/**
 * "Remind me about this" — preset times plus a date of your own.
 *
 * A dialog rather than a nested submenu on purpose: the same picker is
 * opened from the main bubble's More menu, from the thread bubble's (a
 * hand-rolled portal menu with no submenu support), and from a to-do row's
 * ⋮ menu — and a date/time field inside a hover menu is unusable on touch.
 *
 * Subject-agnostic: it knows how to pick a time, and the CALLER supplies
 * `onCommit` / `onRemove` for whatever is being reminded about (a message
 * via `channelService`, a to-do via `useTodoGroups`). Both kinds get the
 * identical picker that way, which is the point — the presets and the
 * "within the next year" rule are one behaviour, not two that resemble
 * each other.
 *
 * Every option resolves to an absolute instant in the browser before it is
 * sent — see `reminderPresets` for why the server never computes "tomorrow
 * 9am" itself.
 */
import { useEffect, useMemo, useState } from "react";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import { Alert, Box, Button, Divider, Input, Stack, Typography } from "@mui/joy";

import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { fmt, useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import {
    formatReminderTime,
    fromDatetimeLocalValue,
    isUsableReminderTime,
    reminderPresets,
    toDatetimeLocalValue,
} from "../../utils/reminderPresets";
import { useTodoDialogLayer } from "../todo/TodoHostLayer";

type Props = {
    open: boolean;
    /** The pending reminder's instant (ISO) when there is one. Its presence
     *  turns the dialog from "set" into "change or remove". */
    remindAt?: string | null;
    /** Persist the chosen instant. Must REJECT when the server refuses it
     *  (a past time, beyond a year, a to-do already ticked off) — the
     *  dialog reports the failure instead of closing on a promise nobody
     *  kept. */
    onCommit: (at: Date) => Promise<unknown>;
    /** Drop the pending reminder. Only reachable when `remindAt` is set. */
    onRemove: () => Promise<unknown>;
    /** What the reader is told will happen, when the default (a message,
     *  which also mentions the flag) doesn't fit the subject. */
    description?: string;
    onClose: () => void;
};

export const ModalRemindMe = ({
    open,
    remindAt,
    onCommit,
    onRemove,
    description,
    onClose,
}: Props) => {
    const { t, locale } = useTranslation();
    const m = t.chat.remindMe;
    // Inside the to-do modal this opens above it (MIP-1047).
    const layer = useTodoDialogLayer(10010);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [customValue, setCustomValue] = useState("");

    // Resolved once per opening, not per render: presets are relative to
    // "now", and a list whose times drift while the user reads it would
    // send a different instant than the one they clicked.
    const presets = useMemo(() => (open ? reminderPresets() : []), [open]);

    useEffect(() => {
        if (!open) return;
        setError(null);
        setCustomValue(remindAt ? toDatetimeLocalValue(new Date(remindAt)) : "");
    }, [open, remindAt]);

    const commit = async (at: Date) => {
        if (submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            await onCommit(at);
            onClose();
        } catch {
            setError(m.failed);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemove = async () => {
        if (submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            await onRemove();
            onClose();
        } catch {
            setError(m.failed);
        } finally {
            setSubmitting(false);
        }
    };

    const customAt = fromDatetimeLocalValue(customValue);
    const customUsable = isUsableReminderTime(customAt);

    const rowSx = {
        justifyContent: "space-between",
        fontWeight: 500,
        px: 1.5,
        py: 1,
    } as const;

    return (
        <ModalFrame
            dismissible={!submitting}
            icon={<NotificationsActiveRoundedIcon sx={{ color: g.accent.text }} />}
            open={open}
            size="sm"
            title={m.title}
            zIndex={layer}
            description={
                remindAt
                    ? fmt(m.currentlySetFor, {
                          time: formatReminderTime(new Date(remindAt), locale),
                      })
                    : (description ?? m.description)
            }
            onClose={onClose}
        >
            {error && (
                <Alert color="danger" sx={{ mb: 1.5 }}>
                    {error}
                </Alert>
            )}

            <Stack spacing={0.5}>
                {presets.map(({ id, at }) => (
                    <Button
                        key={id}
                        color="neutral"
                        disabled={submitting}
                        startDecorator={<AccessTimeRoundedIcon sx={{ fontSize: 18 }} />}
                        sx={rowSx}
                        variant="soft"
                        onClick={() => void commit(at)}
                    >
                        <Box sx={{ flex: 1, textAlign: "start", marginInlineStart: "8px" }}>
                            {m.presets[id]}
                        </Box>
                        <Typography level="body-xs" sx={{ color: g.text.tertiary }}>
                            {formatReminderTime(at, locale)}
                        </Typography>
                    </Button>
                ))}
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            <Typography level="body-xs" sx={{ color: g.text.secondary, mb: 0.75 }}>
                {m.customLabel}
            </Typography>
            <Stack direction="row" spacing={1}>
                <Input
                    disabled={submitting}
                    slotProps={{ input: { "aria-label": m.customLabel } }}
                    sx={{ flex: 1 }}
                    type="datetime-local"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                />
                <Button
                    disabled={!customUsable || submitting}
                    loading={submitting}
                    onClick={() => customAt && void commit(customAt)}
                >
                    {m.setButton}
                </Button>
            </Stack>
            {/* Only after they have typed something: telling someone
                their empty field is invalid is scolding, not helping. */}
            {customValue !== "" && !customUsable && (
                <Typography color="danger" level="body-xs" sx={{ mt: 0.75 }}>
                    {m.customInvalid}
                </Typography>
            )}

            {remindAt && (
                <>
                    <Divider sx={{ my: 1.5 }} />
                    <Button
                        color="danger"
                        disabled={submitting}
                        startDecorator={<DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />}
                        variant="plain"
                        sx={{
                            color: g.danger.text,
                            "--Icon-color": g.danger.text,
                        }}
                        onClick={() => void handleRemove()}
                    >
                        {m.remove}
                    </Button>
                </>
            )}
        </ModalFrame>
    );
};
