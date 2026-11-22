import { useCallback } from "react";

import { fmt, useTranslation } from "../../../i18n";

/** Build the v3 deep-link URL for a single message. The route doesn't
 *  carry a `/m/<messageId>` segment yet, so we use a hash anchor —
 *  the row writes an `id="message-<id>"` attribute so the browser
 *  scrolls to it on page open with the hash present. Keep in sync
 *  with the row's `id` attribute writer. */
export function messageDeepLinkUrl(channelId: string, messageId: string): string {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}/workspace/v3/${channelId}#message-${messageId}`;
}

/** Hook returning a stable copy-to-clipboard handler. Falls back to a
 *  no-op when the clipboard API is unavailable (older browsers / file:
 *  protocol). Errors are swallowed and surfaced via the caller's
 *  `onError` so a denied permission doesn't break the click. */
export function useCopyMessageLink(
    channelId: string,
    messageId: string,
    onCopied?: () => void,
    onError?: (message: string) => void
): () => void {
    const { t } = useTranslation();
    return useCallback(() => {
        const url = messageDeepLinkUrl(channelId, messageId);
        const clip = navigator?.clipboard;
        if (!clip || typeof clip.writeText !== "function") {
            onError?.(t.chat.channel.messageActions.clipboardUnavailable);
            return;
        }
        clip.writeText(url).then(
            () => onCopied?.(),
            (e) =>
                onError?.(
                    fmt(t.chat.channel.messageActions.copyFailed, {
                        error: e?.message ?? String(e),
                    })
                )
        );
    }, [channelId, messageId, onCopied, onError, t]);
}
