// Bridge between the axios response interceptor and the React prompt.
//
// Every surface that can carry an @mention — task comments, task
// bodies, all three note kinds, chat messages — returns
// `nonMemberMentions` on its save/send response when a mentioned user
// can't reach what they were mentioned in. Listening in the interceptor
// rather than at each call site means one wiring instead of six, and a
// surface added later is covered without touching it.
//
// A module-level listener (not a context) because the interceptor lives
// outside React and can't read one.

export type NonMemberMentionScopeKind = "project" | "channel" | "team_folder";

export type NonMemberMentionPayload = {
    scopeKind: NonMemberMentionScopeKind;
    scopeId: string;
    scopeName: string;
    users: { userId: string; userName: string }[];
};

type Listener = (payload: NonMemberMentionPayload) => void;

let _listener: Listener | null = null;

export const registerNonMemberMentionListener = (listener: Listener) => {
    _listener = listener;
};

export const unregisterNonMemberMentionListener = () => {
    _listener = null;
};

const isValid = (value: unknown): value is NonMemberMentionPayload => {
    if (!value || typeof value !== "object") return false;
    const p = value as Partial<NonMemberMentionPayload>;
    return (
        (p.scopeKind === "project" ||
            p.scopeKind === "channel" ||
            p.scopeKind === "team_folder") &&
        typeof p.scopeId === "string" &&
        Array.isArray(p.users) &&
        p.users.length > 0
    );
};

/**
 * Called by the response interceptor for every successful response.
 *
 * Deliberately tolerant: an older backend omits the key entirely, and a
 * malformed one is dropped rather than surfacing a prompt with no
 * usable scope. Saving a note must never fail because of a UI hint.
 */
export const notifyNonMemberMentions = (data: unknown): void => {
    if (!_listener || !data || typeof data !== "object") return;
    const payload = (data as { nonMemberMentions?: unknown }).nonMemberMentions;
    if (isValid(payload)) _listener(payload);
};
