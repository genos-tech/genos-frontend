import { useEffect, useRef } from "react";

// "A Genos conversation was permanently deleted."
//
// The delete happens in Settings -> Genos -> What Genos remembers, but the
// state that has to react lives in hook instances the settings panel cannot
// reach: the Spotlight overlay and the Genos page share one `useSpotlight`
// at the App root, each thread / note "Ask" modal has its own `useAgentQA`,
// and the History list is held by `useSpotlight` AND by a separate
// `useGenosSessions` per surface. A window event is the same answer
// `noteChanged` already gives for "an agent write changed something the
// sidebar shows", and it keeps the delete button ignorant of who is
// listening.
//
// Why every listener must act rather than wait for a refetch: a live
// conversation whose session was just deleted keeps its transcript on
// screen, and the next follow-up silently starts a brand-new session with
// none of that context. The reset has to be immediate, and it has to be the
// same "new conversation" the person would have started by hand.

export const AGENT_SESSIONS_DELETED_EVENT = "agentSessionsDeleted";

export type AgentSessionsDeletedDetail =
    // A few specific conversations (one per click, today).
    | { teamId: string; all?: false; sessionIds: readonly string[] }
    // Every conversation the person has in `teamId`. Delete-all is per team,
    // so a listener in another team's shell must ignore it.
    | { teamId: string; all: true };

export const emitAgentSessionsDeleted = (detail: AgentSessionsDeletedDetail): void => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent<AgentSessionsDeletedDetail>(AGENT_SESSIONS_DELETED_EVENT, { detail })
    );
};

/**
 * Does this deletion include `sessionId`, as seen from the team the caller's
 * UI is currently showing?
 *
 * A session id is globally unique, so for the by-id form the id alone
 * decides. The delete-all form names no ids, so it is the TEAM that decides
 * — and only the team the person is looking at (a conversation they have
 * open belongs to it).
 */
export const deletionCoversSession = (
    detail: AgentSessionsDeletedDetail,
    sessionId: string | null | undefined,
    currentTeamId: string | null | undefined
): boolean => {
    if (!sessionId) return false;
    if (detail.all === true) return Boolean(currentTeamId) && detail.teamId === currentTeamId;
    return detail.sessionIds.includes(sessionId);
};

/**
 * Subscribe to deletions for the life of the component. The handler is read
 * through a ref, so callers can close over live state (the open session id)
 * without re-subscribing on every render.
 */
export const useAgentSessionsDeleted = (
    handler: (detail: AgentSessionsDeletedDetail) => void
): void => {
    const handlerRef = useRef(handler);
    useEffect(() => {
        handlerRef.current = handler;
    }, [handler]);

    useEffect(() => {
        const onDeleted = (event: Event) => {
            const detail = (event as CustomEvent<AgentSessionsDeletedDetail>).detail;
            if (detail) handlerRef.current(detail);
        };
        window.addEventListener(AGENT_SESSIONS_DELETED_EVENT, onDeleted);
        return () => window.removeEventListener(AGENT_SESSIONS_DELETED_EVENT, onDeleted);
    }, []);
};
