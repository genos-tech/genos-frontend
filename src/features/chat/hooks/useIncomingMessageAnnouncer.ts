import { useEffect, useRef, useState } from "react";

import { fmt, useTranslation } from "../../../i18n";
import type { Message } from "../../../types/channel";
import {
    matchesConversation,
    MEDIA_LABEL_KEYS,
    previewForAnnouncement,
    type AnnouncerScope,
} from "../utils/liveAnnouncement";

/** One announcement per window: a burst is read as its first message plus a count. */
export const ANNOUNCE_WINDOW_MS = 1500;

// Message ids already announced in this tab: the main and the sub pane can show the same
// channel, and one message must be read once. Bounded so it cannot grow for ever.
const announced = new Set<string>();
const remember = (id: string): boolean => {
    if (announced.has(id)) return false;
    announced.add(id);
    if (announced.size > 200) announced.delete(announced.values().next().value as string);
    return true;
};

/**
 * The text a polite live region should read for the open conversation (MIP-1956): a message from
 * ANOTHER person, arriving live over the socket (`v3:message:created`, which history loads, edits
 * and reactions never fire), "Name: preview". Own messages (this device or another) are skipped.
 * Rate limited: the first message is read at once; more inside the window are held and read when it
 * ends as the first held one plus "+N more", so a burst cannot flood the reader.
 */
export function useIncomingMessageAnnouncer(scope: AnnouncerScope, myselfId: string): string {
    const { t } = useTranslation();
    const [text, setText] = useState("");
    const tRef = useRef(t);
    tRef.current = t;
    const { chatId, threadId } = scope;

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        let raf: number | null = null;
        let held: Message | null = null;
        let heldExtra = 0;

        const say = (message: string) => {
            // Empty first, then the text: an identical line twice in a row is still read.
            setText("");
            if (raf !== null) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => setText(message));
        };
        const line = (m: Message) => {
            const labels = tRef.current.chat.liveRegion;
            const media = Object.fromEntries(
                Object.entries(MEDIA_LABEL_KEYS).map(([kind, key]) => [
                    kind,
                    tRef.current.chat.sidebar[key],
                ])
            ) as Parameters<typeof previewForAnnouncement>[1]["media"];
            return fmt(labels.newMessage, {
                name: m.sender?.userName ?? "",
                preview: previewForAnnouncement(m, { attachment: labels.attachment, media }),
            });
        };
        const openWindow = () => {
            timer = setTimeout(() => {
                timer = null;
                if (!held) return;
                const m = held;
                const extra = heldExtra;
                held = null;
                heldExtra = 0;
                say(
                    extra > 0
                        ? `${line(m)} ${fmt(tRef.current.chat.liveRegion.more, { count: extra })}`
                        : line(m)
                );
                openWindow();
            }, ANNOUNCE_WINDOW_MS);
        };

        const onCreated = (event: Event) => {
            const m = (event as CustomEvent<{ message?: Message }>).detail?.message;
            if (!m || !m.sender || m.sender.userId === myselfId) return;
            if (!matchesConversation(m, { chatId, threadId })) return;
            if (!remember(m.id)) return;
            if (timer === null) {
                say(line(m));
                openWindow();
            } else if (held === null) {
                held = m;
            } else {
                heldExtra += 1;
            }
        };

        window.addEventListener("v3:message:created", onCreated);
        return () => {
            window.removeEventListener("v3:message:created", onCreated);
            if (timer !== null) clearTimeout(timer);
            if (raf !== null) cancelAnimationFrame(raf);
        };
    }, [chatId, threadId, myselfId]);

    return text;
}
