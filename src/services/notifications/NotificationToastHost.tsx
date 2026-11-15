import { useCallback, useEffect, useState } from "react";
import { Stack, Typography } from "@mui/joy";

import { BaseAvatar } from "../../components/ui/avatars/BaseAvatar";
import { Clickable } from "../../components/ui/Clickable";
import { Toast } from "../../components/ui/feedback/Toast";
import { ViaAppIcon } from "../../components/ui/misc/ViaAppIcon";
import { parseViaApp } from "../../features/tasks/utils/viaSource";
import { AVATAR } from "../../theme/tokens/scales";
import { NotificationIntent } from "./types";

interface NotificationToastHostProps {
    /** Subscribe-fn from `useNotifications().subscribeToasts` (or the
     *  manager's `subscribeToasts`). */
    subscribeToasts: (listener: (intent: NotificationIntent) => void) => () => void;
    /** Called when the user clicks the toast body. The host doesn't know how
     *  to navigate, so it forwards the intent up to the App layer. */
    onOpenIntent?: (intent: NotificationIntent) => void;
}

// The avatar slot is `BaseAvatar` size `lg`; the app's mark takes the same circle.
const MARK_SIZE = AVATAR.lg;
const TOAST_AUTO_HIDE_MS = 5000;
const QUEUE_LIMIT = 5;

/**
 * App-level toast renderer. Keeps a small queue of `NotificationIntent`s
 * coming out of the manager and shows them one at a time in the shared toast
 * host (bottom-center, like every other toast).
 */
export const NotificationToastHost = ({
    subscribeToasts,
    onOpenIntent,
}: NotificationToastHostProps) => {
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
        <Toast duration={TOAST_AUTO_HIDE_MS} icon={null} open={!!active} onClose={() => dismiss()}>
            {active ? (
                <Stack
                    alignItems="flex-start"
                    direction="row"
                    spacing={1.25}
                    sx={{ width: "100%" }}
                >
                    {parseViaApp(active.viaApp) ? (
                        // A change made through the official Claude / ChatGPT app
                        // (MIP-1608): that app's round mark in the avatar's place, labelled
                        // "via Claude" / "via ChatGPT" (the family only, never a name).
                        // Gated on the two exact strings here too, since the mark renders
                        // nothing for anything else and would leave the slot empty.
                        <ViaAppIcon app={active.viaApp} size={MARK_SIZE} />
                    ) : active.icon ? (
                        // `intent.icon` is already a fully-qualified URL
                        // produced by `buildAvatarSrc` in the router — do
                        // not prepend the media root again, or the URL
                        // becomes `${media}/${media}/...` and Avatar
                        // silently falls back to the initials.
                        <BaseAvatar size="lg" src={active.icon} />
                    ) : (
                        <BaseAvatar name={active.title} size="lg" />
                    )}

                    <Clickable
                        sx={{ minWidth: 0, flex: 1, cursor: onOpenIntent ? "pointer" : "default" }}
                        onActivate={handleOpen}
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
                    </Clickable>
                </Stack>
            ) : null}
        </Toast>
    );
};
