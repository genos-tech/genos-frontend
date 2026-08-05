/**
 * "Remind me about this message" — preset times plus a date of your own.
 *
 * A dialog rather than a nested submenu on purpose: the same picker is
 * opened from the main bubble's More menu and from the thread bubble's
 * (which is a hand-rolled portal menu with no submenu support), and a
 * date/time field inside a hover menu is unusable on touch.
 *
 * Every option resolves to an absolute instant in the browser before it is
 * sent — see `reminderPresets` for why the server never computes "tomorrow
 * 9am" itself.
 */
import { useEffect, useMemo, useState } from "react";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import {
    Alert,
    Box,
    Button,
    Divider,
    Input,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { fmt, useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { MessageReminder } from "../../../../types/channel";
import {
    formatReminderTime,
    fromDatetimeLocalValue,
    isUsableReminderTime,
    reminderPresets,
    toDatetimeLocalValue,
} from "../../utils/reminderPresets";

type Props = {
    open: boolean;
    /** v3 message UUID — the same identity the flag uses. */
    messageId: string;
    /** The pending reminder on this message, when there is one. Its
     *  presence turns the dialog from "set" into "change or remove". */
    reminder?: MessageReminder | null;
    onClose: () => void;
};

export const ModalRemindMe = ({ open, messageId, reminder, onClose }: Props) => {
    const { t, locale } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const m = t.chat.remindMe;

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
        setCustomValue(reminder ? toDatetimeLocalValue(new Date(reminder.remindAt)) : "");
    }, [open, reminder]);

    const commit = async (at: Date) => {
        if (submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            await channelService.setReminder(messageId, at);
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
            await channelService.cancelReminder(messageId);
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
        borderRadius: "10px",
        fontWeight: 500,
        px: 1.5,
        py: 1,
    } as const;

    return (
        <Modal
            open={open}
            sx={{ zIndex: 10010, backdropFilter: "blur(4px)", backgroundColor: "transparent" }}
            onClose={() => !submitting && onClose()}
        >
            <ModalDialog
                sx={{
                    borderRadius: "16px",
                    width: { xs: "calc(100vw - 24px)", md: "auto" },
                    minWidth: { xs: 0, md: 360 },
                    maxWidth: "100vw",
                    p: { xs: 2, md: 2.5 },
                }}
            >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                    <NotificationsActiveRoundedIcon sx={{ fontSize: 20 }} />
                    <Typography level="title-md" sx={{ fontWeight: 600 }}>
                        {m.title}
                    </Typography>
                </Stack>

                <Typography level="body-xs" sx={{ opacity: 0.7, mb: 1.5 }}>
                    {reminder
                        ? fmt(m.currentlySetFor, {
                              time: formatReminderTime(new Date(reminder.remindAt), locale),
                          })
                        : m.description}
                </Typography>

                {error && (
                    <Alert color="danger" sx={{ mb: 1.5, borderRadius: "10px" }}>
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
                            <Box sx={{ flex: 1, textAlign: "start", ml: 1 }}>{m.presets[id]}</Box>
                            <Typography level="body-xs" sx={{ opacity: 0.6 }}>
                                {formatReminderTime(at, locale)}
                            </Typography>
                        </Button>
                    ))}
                </Stack>

                <Divider sx={{ my: 1.5 }} />

                <Typography level="body-xs" sx={{ opacity: 0.7, mb: 0.75 }}>
                    {m.customLabel}
                </Typography>
                <Stack direction="row" spacing={1}>
                    <Input
                        disabled={submitting}
                        slotProps={{ input: { "aria-label": m.customLabel } }}
                        sx={{ flex: 1, borderRadius: "10px" }}
                        type="datetime-local"
                        value={customValue}
                        onChange={(e) => setCustomValue(e.target.value)}
                    />
                    <Button
                        disabled={!customUsable || submitting}
                        loading={submitting}
                        sx={{ borderRadius: "10px", fontWeight: 600 }}
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

                {reminder && (
                    <>
                        <Divider sx={{ my: 1.5 }} />
                        <Button
                            color="danger"
                            disabled={submitting}
                            startDecorator={<DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />}
                            variant="plain"
                            sx={{
                                borderRadius: "10px",
                                alignSelf: "flex-start",
                                color: isDark ? "#f87171" : "#ef4444",
                            }}
                            onClick={() => void handleRemove()}
                        >
                            {m.remove}
                        </Button>
                    </>
                )}
            </ModalDialog>
        </Modal>
    );
};
