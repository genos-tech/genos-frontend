/**
 * Whether the member can import an `.html` page as a note, and how big a page may be (MIP-2215).
 *
 * It comes from `/agent/features/`, the same one fetch behind the upload ceiling, as the key
 * `html_notes`, which the server sends ONLY while its `HTML_NOTES` switch is on. So the answer has
 * three states, and the dialog treats them differently:
 *
 *   - `enabled: false`        the switch is off (or the fetch failed): `.html` is not offered at all
 *   - `enabled`, `maxBytes: null`  on, but the plan has no HTML notes (Free): offered, and saying why
 *                                  it can't be imported, with the way to upgrade
 *   - `enabled`, `maxBytes: n`     on, and a page may be up to `n` bytes
 *
 * The plan is a plan attribute, not live data: a short TTL (an upgrade is picked up on the next
 * open of the dialog, which asks for a fresh answer), and a failed fetch is "off", never an error.
 */

import { fetchAgentFeatures } from "./agentApi";
import { createRequestCache } from "./requestCache";

export type HtmlNoteLimit = { enabled: false } | { enabled: true; maxBytes: number | null };

const TTL_MS = 2 * 60 * 1000;
const cache = createRequestCache<HtmlNoteLimit>({ ttlMs: TTL_MS });
const KEY = "html-note-limit";

export const resolveHtmlNoteLimit = (
    accessToken: string | null,
    options: { fresh?: boolean } = {}
): Promise<HtmlNoteLimit> => {
    if (!accessToken) return Promise.resolve({ enabled: false });
    if (options.fresh) cache.invalidate(KEY);
    return cache.get(KEY, async () => {
        const features = await fetchAgentFeatures(accessToken);
        const block = features?.html_notes;
        if (!block) return { enabled: false } as const;
        return { enabled: true, maxBytes: block.max_bytes } as const;
    });
};
