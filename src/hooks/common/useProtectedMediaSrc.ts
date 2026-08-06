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

import { resolveInsecureFileUrl } from "../../utils/downloadUtils";
import { isProtectedMediaUrl } from "../../utils/mediaAuth";

export function useProtectedMediaSrc(url: string | undefined | null): string | undefined {
    // Public media (avatars, custom emoji) resolves synchronously to
    // itself, so those keep hitting the browser's image cache and never
    // flicker through an undefined render.
    const [src, setSrc] = useState<string | undefined>(() =>
        url && !isProtectedMediaUrl(url) ? url : undefined
    );

    useEffect(() => {
        if (!url) {
            setSrc(undefined);
            return;
        }
        if (!isProtectedMediaUrl(url)) {
            setSrc(url);
            return;
        }
        let alive = true;
        setSrc(undefined);
        void resolveInsecureFileUrl(url).then((resolved) => {
            if (alive) setSrc(resolved);
        });
        return () => {
            alive = false;
        };
    }, [url]);

    return src;
}
