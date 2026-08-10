/**
 * `src` for an `<img>` pointing at protected `/media/`.
 *
 * BlockNote bodies get this for free — `resolveFileUrl` is an async hook,
 * so `resolveInsecureFileUrl` can do the fetch before the editor paints.
 * A hand-written `<img>` has no such seam: the browser issues the request
 * itself and the only credential it will attach is the `refresh` cookie,
 * which is the failure this whole path exists to remove (see
 * `utils/mediaAuth`).
 *
 * Returns `undefined` until there is something worth requesting, so the
 * caller can render nothing rather than let the browser fire a load that
 * is going to 404 and leave a broken-image icon captioned with the
 * filename — the exact artifact users reported.
 */

import { useEffect, useState } from "react";

import { resolveInsecureFileUrl, upgradeInsecureUrl } from "../../utils/downloadUtils";
import { isProtectedMediaUrl } from "../../utils/mediaAuth";

export function useProtectedMediaSrc(url: string | undefined | null): string | undefined {
    // Upgrade the scheme BEFORE anything else looks at the URL. Media URLs
    // baked into message bodies before the API trusted the proxy's
    // forwarded scheme carry `http://` (see genos-api `channel_views`
    // inline-upload handler). On an https page that scheme not only trips a
    // Mixed-Content warning, it makes the URL's origin differ from our own
    // media origin — so `isProtectedMediaUrl` reads it as a foreign CDN URL,
    // renders it raw, and skips the session-token fetch that exists to keep
    // these attachments loading (see `utils/mediaAuth`). Upgrading first
    // lines classification and rendering up on the https form, matching what
    // `resolveInsecureFileUrl` already does before it resolves. No-op on
    // http pages (local dev) and for blob:/relative URLs.
    const upgraded = url ? upgradeInsecureUrl(url) : url;

    // Public media (avatars, custom emoji) resolves synchronously to
    // itself, so those keep hitting the browser's image cache and never
    // flicker through an undefined render.
    const [src, setSrc] = useState<string | undefined>(() =>
        upgraded && !isProtectedMediaUrl(upgraded) ? upgraded : undefined
    );

    useEffect(() => {
        if (!upgraded) {
            setSrc(undefined);
            return;
        }
        if (!isProtectedMediaUrl(upgraded)) {
            setSrc(upgraded);
            return;
        }
        let alive = true;
        setSrc(undefined);
        void resolveInsecureFileUrl(upgraded).then((resolved) => {
            if (alive) setSrc(resolved);
        });
        return () => {
            alive = false;
        };
    }, [upgraded]);

    return src;
}
