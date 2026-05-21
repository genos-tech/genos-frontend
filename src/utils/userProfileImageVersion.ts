import { useEffect, useState } from "react";

/**
 * Cache-busting for user profile images.
 *
 * `UserProfileImageView` deletes the previous file before saving the
 * new one so the re-upload of `profile.jpg` lands at the canonical
 * path (see `backend_django/.../user_views.py`). The URL therefore
 * stays byte-identical across uploads and the browser happily serves
 * the cached image — even after `myself.avatarImgPath` updates,
 * because the string didn't change. Components include `?v={version}`
 * in the avatar src and the uploader calls
 * `bumpUserProfileImageVersion` to force every mounted consumer to
 * re-fetch.
 *
 * Module-level pub-sub so a single bump notifies every mounted
 * consumer — the modal preview, every UserAvatar instance, etc.
 */

const versions = new Map<string, number>();
const listeners = new Set<() => void>();

const keyFor = (userId: string | number): string => String(userId);

export const bumpUserProfileImageVersion = (userId: string | number): void => {
    const key = keyFor(userId);
    versions.set(key, (versions.get(key) ?? 0) + 1);
    listeners.forEach((l) => l());
};

export const useUserProfileImageVersion = (userId: string | number | null | undefined): number => {
    const [, force] = useState(0);
    useEffect(() => {
        const fn = () => force((n) => n + 1);
        listeners.add(fn);
        return () => {
            listeners.delete(fn);
        };
    }, []);
    if (userId == null || userId === "") return 0;
    return versions.get(keyFor(userId)) ?? 0;
};
