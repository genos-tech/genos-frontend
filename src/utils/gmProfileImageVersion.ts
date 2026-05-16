import { useEffect, useState } from "react";

/**
 * Cache-busting for GM profile images.
 *
 * After a successful upload the backend may keep the same filename
 * and overwrite the bytes in place; even when `useCM.allChats`
 * refreshes with the updated row, every consumer would still render
 * `<img src=".../same-name.jpg">` and the browser happily serves the
 * cached image. Components include `?v={version}` in the avatar src
 * and the uploader calls `bumpGMProfileImageVersion` to force every
 * mounted GMAvatar to re-fetch.
 *
 * Module-level pub-sub so a single bump notifies every mounted
 * consumer — the chat header avatar, the modal preview avatar, etc.
 */

const versions = new Map<string, number>();
const listeners = new Set<() => void>();

const keyFor = (chatType: number, chatId: number): string => `${chatType}:${chatId}`;

export const bumpGMProfileImageVersion = (chatType: number, chatId: number): void => {
    const key = keyFor(chatType, chatId);
    versions.set(key, (versions.get(key) ?? 0) + 1);
    listeners.forEach((l) => l());
};

export const useGMProfileImageVersion = (chatType: number, chatId: number): number => {
    const [, force] = useState(0);
    useEffect(() => {
        const fn = () => force((n) => n + 1);
        listeners.add(fn);
        return () => {
            listeners.delete(fn);
        };
    }, []);
    return versions.get(keyFor(chatType, chatId)) ?? 0;
};
