import { useCallback, useMemo } from "react";

import { useUiSettings } from "./uiSettingsState";

/**
 * Starred ("favourite") projects for the Tasks sidebar (MIP-1695). Stored in
 * the cross-device `ui_settings` store under `favoriteProjectIds` as a flat
 * list of project ids, so a star follows the person to another device without
 * a backend change. The API accepts a flat list of scalars for any key.
 *
 * A project the person has LEFT keeps its id here (nothing prunes it): the
 * sidebar only renders joined projects, so the id is simply inert until they
 * rejoin. Ids that are not finite numbers are dropped on read.
 */

const UI_SETTINGS_KEY = "favoriteProjectIds";

/** Normalise a stored value to a de-duplicated list of project ids. */
export const readFavoriteProjectIds = (raw: unknown): number[] => {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<number>();
    for (const v of raw) {
        if (typeof v === "number" && Number.isFinite(v)) seen.add(v);
    }
    return [...seen];
};

export interface FavoriteProjects {
    /** Starred project ids, in the order they were starred. */
    ids: number[];
    /** The same ids as a Set, for O(1) membership in render paths. */
    idSet: ReadonlySet<number>;
    /** Star (`true`) or unstar (`false`) a project. */
    setFavorite: (projectId: number, favorited: boolean) => void;
}

export const useFavoriteProjects = (): FavoriteProjects => {
    const { get, set } = useUiSettings();
    const raw = get<unknown>(UI_SETTINGS_KEY, []);
    const ids = useMemo(() => readFavoriteProjectIds(raw), [raw]);
    const idSet = useMemo(() => new Set(ids), [ids]);

    const setFavorite = useCallback(
        (projectId: number, favorited: boolean) => {
            const current = readFavoriteProjectIds(get<unknown>(UI_SETTINGS_KEY, []));
            const has = current.includes(projectId);
            if (favorited === has) return;
            const next = favorited
                ? [...current, projectId]
                : current.filter((id) => id !== projectId);
            // An empty list deletes the key (reset to the default: nothing starred).
            set(UI_SETTINGS_KEY, next.length === 0 ? null : next);
        },
        [get, set]
    );

    return { ids, idSet, setFavorite };
};
