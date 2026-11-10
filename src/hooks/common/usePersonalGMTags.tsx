import { useEffect, useSyncExternalStore } from "react";
import axios from "axios";

import { useAuth } from "../../context/AuthContext";
import { v3ApiBaseURL } from "../../services/v3Api";
import { PersonalTag, PersonalTagsBundle } from "../../types/personalTags";

/**
 * Server-backed store for personal GM tags (private per-user labels —
 * see `types/personalTags.ts` for why they never ride the channel
 * payload).
 *
 * Shape: a module-level store + `useSyncExternalStore` (the
 * `useTaskTableColumnPreferences` / `channelService` pattern) with a
 * null-rendering `<PersonalGMTagsBootstrap />` mounted once in `App` to
 * feed it the auth token. A context provider would work too, but
 * inserting one more level into App's provider pyramid re-indents ~600
 * lines for zero behavioral gain; the module store keeps every consumer
 * in lockstep with a one-line mount.
 *
 * One GET (`/api/v3/personal-tags/`) returns everything the sidebar
 * needs: the tag list, per-channel assignments, and the server-computed
 * default chip set. Mutations update state optimistically and roll back
 * on failure (mirrors `useSpotlightPreferences.setWebSearch`).
 *
 * Freshness: personal data means no cross-member socket fan-out exists
 * (by design). The same user's other tabs/devices converge via the
 * `window` focus refetch — best-effort is fine for a purely personal
 * organizational surface.
 *
 * v3 endpoints, so `authApi` (whose baseURL ends in `/api/v2/`) is NOT
 * usable here — plain axios against `v3ApiBaseURL()` like
 * `loadActivityHistory`.
 */

const BUNDLE_PATH = "/api/v3/personal-tags/";

export interface CreateTagInput {
    name: string;
    color: string;
    textColor: string;
}

export type UpdateTagPatch = Partial<
    Pick<PersonalTag, "name" | "color" | "textColor" | "isDefaultVisible" | "sortOrder">
>;

interface PersonalGMTagsState extends PersonalTagsBundle {
    /** False until the first GET settles — row chips gate on this so
     *  Virtuoso only reflows once, not per-chunk. */
    loaded: boolean;
    /** The latest GET failed (MIP-1305). `tags` is then whatever was last loaded: the
     *  Manage modal says so with Retry instead of "no tags yet". */
    failed: boolean;
}

const EMPTY_STATE: PersonalGMTagsState = {
    tags: [],
    assignments: {},
    defaultVisibleTagIds: [],
    loaded: false,
    failed: false,
};

// ---- module store ----------------------------------------------------

let _state: PersonalGMTagsState = EMPTY_STATE;
let _accessToken: string | null = null;
const _listeners = new Set<() => void>();

const _notify = () => {
    for (const l of _listeners) l();
};

const _subscribe = (listener: () => void) => {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
};

const _getSnapshot = (): PersonalGMTagsState => _state;

const _setState = (next: PersonalGMTagsState) => {
    _state = next;
    _notify();
};

const _api = () => {
    if (!_accessToken) return null;
    return axios.create({
        baseURL: v3ApiBaseURL(),
        headers: { Authorization: `Bearer ${_accessToken}` },
        withCredentials: true,
    });
};

const _refetch = async (): Promise<void> => {
    const client = _api();
    if (!client) {
        _setState(EMPTY_STATE);
        return;
    }
    try {
        const res = await client.get<PersonalTagsBundle>(BUNDLE_PATH);
        _setState({
            tags: Array.isArray(res.data?.tags) ? res.data.tags : [],
            assignments: res.data?.assignments ?? {},
            defaultVisibleTagIds: Array.isArray(res.data?.defaultVisibleTagIds)
                ? res.data.defaultVisibleTagIds
                : [],
            loaded: true,
            failed: false,
        });
    } catch {
        // Endpoint missing / network error — keep whatever we have. An untagged render is
        // strictly cosmetic degradation; the Manage modal reads `failed` so it does not
        // call that "no tags yet".
        // Not when it already says so: a focus loop while offline must not re-render every row.
        if (!_state.failed) _setState({ ..._state, failed: true });
    }
};

/** Ask again (the Retry of the Manage modal). `failed` clears at once so the modal shows
 *  its loading state, not the stale error, while the GET is in flight. */
const reloadPersonalGMTags = () => {
    if (_state.failed) _setState({ ..._state, failed: false });
    void _refetch();
};

/** Test-only: reset module state between vitest cases. */
export const _resetPersonalGMTagsStoreForTests = () => {
    _state = EMPTY_STATE;
    _accessToken = null;
};

// ---- mutations (optimistic + rollback) -------------------------------

const createTag = async (input: CreateTagInput): Promise<PersonalTag | null> => {
    const client = _api();
    if (!client) return null;
    // No optimism — callers need the server-issued tagId.
    try {
        const res = await client.post<PersonalTag>(BUNDLE_PATH, input);
        const tag = res.data;
        _setState({ ..._state, tags: [..._state.tags, tag] });
        return tag;
    } catch {
        return null;
    }
};

const updateTag = async (tagId: number, patch: UpdateTagPatch): Promise<boolean> => {
    const client = _api();
    if (!client) return false;
    const previous = _state;
    _setState({
        ..._state,
        tags: _state.tags.map((t) => (t.tagId === tagId ? { ...t, ...patch } : t)),
    });
    try {
        await client.patch(`${BUNDLE_PATH}${tagId}/`, patch);
        return true;
    } catch {
        _setState(previous);
        return false;
    }
};

const deleteTag = async (tagId: number): Promise<boolean> => {
    const client = _api();
    if (!client) return false;
    const previous = _state;
    // Optimistically strip the tag AND its id from every assignment
    // list so row chips / filters react instantly.
    const assignments: Record<string, number[]> = {};
    for (const [channelId, ids] of Object.entries(_state.assignments)) {
        const next = ids.filter((id) => id !== tagId);
        if (next.length > 0) assignments[channelId] = next;
    }
    _setState({
        loaded: _state.loaded,
        failed: _state.failed,
        tags: _state.tags.filter((t) => t.tagId !== tagId),
        assignments,
        defaultVisibleTagIds: _state.defaultVisibleTagIds.filter((id) => id !== tagId),
    });
    try {
        await client.delete(`${BUNDLE_PATH}${tagId}/`);
        return true;
    } catch {
        _setState(previous);
        return false;
    }
};

const setChannelTags = async (channelId: string, tagIds: number[]): Promise<boolean> => {
    const client = _api();
    if (!client) return false;
    const previous = _state;
    const assignments = { ..._state.assignments };
    if (tagIds.length > 0) {
        assignments[channelId] = tagIds;
    } else {
        delete assignments[channelId];
    }
    _setState({ ..._state, assignments });
    try {
        await client.put(`/api/v3/channels/${channelId}/personal-tags/`, { tagIds });
        return true;
    } catch {
        _setState(previous);
        return false;
    }
};

// ---- public surface --------------------------------------------------

/**
 * Null-rendering singleton mounted once in `App`. Owns the token →
 * store wiring: refetches on token change and on window focus.
 */
export const PersonalGMTagsBootstrap = () => {
    const { accessToken } = useAuth();

    useEffect(() => {
        _accessToken = accessToken ?? null;
        // CRITICAL: clear synchronously on every token change before the
        // refetch resolves. The store is a module-level singleton (unlike
        // the Provider it mirrors, whose state dies on unmount), so a
        // direct account swap A→B that never passes through null (team
        // supersede / session switch) would otherwise leave user A's
        // PRIVATE tags in state and render them to B during B's in-flight
        // GET. Clearing first guarantees no cross-user window.
        _setState(EMPTY_STATE);
        void _refetch();
        if (typeof window === "undefined") return;
        // Same-user freshness (other tabs/devices) — does NOT clear, so
        // no flicker when the window regains focus.
        const onFocus = () => void _refetch();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [accessToken]);

    return null;
};

export interface PersonalGMTagsValue extends Omit<PersonalGMTagsState, "assignments"> {
    /** Renamed from the wire's `assignments` for call-site clarity. */
    assignmentsByChannelId: Record<string, number[]>;
    createTag: typeof createTag;
    updateTag: typeof updateTag;
    deleteTag: typeof deleteTag;
    reload: () => void;
    setChannelTags: typeof setChannelTags;
}

export const usePersonalGMTags = (): PersonalGMTagsValue => {
    const snapshot = useSyncExternalStore(_subscribe, _getSnapshot);
    // The mutation functions are module-level constants — their
    // identity is stable by construction, so memoized consumers can
    // list them in deps safely.
    return {
        tags: snapshot.tags,
        assignmentsByChannelId: snapshot.assignments,
        defaultVisibleTagIds: snapshot.defaultVisibleTagIds,
        loaded: snapshot.loaded,
        failed: snapshot.failed,
        reload: reloadPersonalGMTags,
        createTag,
        updateTag,
        deleteTag,
        setChannelTags,
    };
};
