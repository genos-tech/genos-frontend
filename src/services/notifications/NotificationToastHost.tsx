import { useCallback, useEffect, useState } from "react";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { Avatar, Box, IconButton, Snackbar, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { NotificationIntent } from "./types";

interface NotificationToastHostProps {
    /** Subscribe-fn from `useNotifications().subscribeToasts` (or the
     *  manager's `subscribeToasts`). */
    subscribeToasts: (listener: (intent: NotificationIntent) => void) => () => void;
    /** Called when the user clicks the toast body. The host doesn't know how
     *  to navigate, so it forwards the intent up to the App layer. */
    onOpenIntent?: (intent: NotificationIntent) => void;
}

const TOAST_AUTO_HIDE_MS = 5000;
const QUEUE_LIMIT = 5;

/**
 * App-level toast renderer. Keeps a small queue of `NotificationIntent`s
 * coming out of the manager and shows them one at a time as a Joy Snackbar
 * pinned to the top-right.
 */
export const NotificationToastHost = ({
    subscribeToasts,
    onOpenIntent,
}: NotificationToastHostProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const [queue, setQueue] = useState<NotificationIntent[]>([]);
    const [active, setActive] = useState<NotificationIntent | null>(null);

    useEffect(() => {
        return subscribeToasts((intent) => {
            setQueue((prev) => [...prev, intent].slice(-QUEUE_LIMIT));
        });
    }, [subscribeToasts]);

    useEffect(() => {
        if (!active && queue.length > 0) {
            setActive(queue[0]);
            setQueue((prev) => prev.slice(1));
        }
    }, [active, queue]);

    const dismiss = useCallback(() => setActive(null), []);
    const handleOpen = useCallback(() => {
        if (active && onOpenIntent) onOpenIntent(active);
        setActive(null);
    }, [active, onOpenIntent]);

    return (
        <Snackbar
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
            autoHideDuration={TOAST_AUTO_HIDE_MS}
            color="primary"
            open={!!active}
            variant="soft"
            sx={{
                minWidth: 320,
                maxWidth: 420,
                alignItems: "stretch",
                boxShadow: "lg",
                borderRadius: "xl",
                // Joy's `variant="soft"` ships with a translucent
                // `softBg` token — pleasant on a static surface, but
                // for a floating toast it lets the page bleed
                // through and makes the body text hard to read.
                // Force an opaque surface here and add a matching
                // border so the edge stays crisp; the soft variant
                // still drives the text / icon tint.
                backgroundColor: isDark ? "#1f1d2c" : "#ffffff",
                border: isDark
                    ? "1px solid rgba(167,139,250,0.25)"
                    : "1px solid rgba(124,58,237,0.18)",
                backdropFilter: "none",
            }}
            onClose={(_event, reason) => {
                if (reason === "clickaway") return;
                dismiss();
            }}
        >
            {active ? (
                <Stack
                    alignItems="flex-start"
                    direction="row"
                    spacing={1.25}
                    sx={{ width: "100%" }}
                >
                    {active.icon ? (
                        // `intent.icon` is already a fully-qualified URL
                        // produced by `buildAvatarSrc` in the router — do
                        // not prepend the media root again, or the URL
                        // becomes `${media}/${media}/...` and Avatar
                        // silently falls back to the initials.
                        <Avatar size="md" src={active.icon} />
                    ) : (
                        <Avatar size="md">{active.title?.[0] ?? "?"}</Avatar>
                    )}

                    <Box
                        sx={{ minWidth: 0, flex: 1, cursor: onOpenIntent ? "pointer" : "default" }}
                        onClick={handleOpen}
                    >
                        <Typography level="title-sm" sx={{ mb: 0.25 }}>
                            {active.title}
                        </Typography>
                        <Typography
                            level="body-sm"
                            sx={{
                                display: "-webkit-box",
                                overflow: "hidden",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                            }}
                        >
                            {active.body}
                        </Typography>
                    </Box>

                    <IconButton color="neutral" size="sm" variant="plain" onClick={dismiss}>
                        <CloseRounded />
                    </IconButton>
                </Stack>
            ) : null}
        </Snackbar>
    );
};
