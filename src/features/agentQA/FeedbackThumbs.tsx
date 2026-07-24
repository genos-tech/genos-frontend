// 👍/👎 feedback buttons for a finished agent turn (F1,
// SPOTLIGHT_QUALITY_ARCHITECTURE.md §Q0.6). Shared by every agent
// surface — the thread/note Ask modal (AgentQAConversation) and the
// Spotlight overlay (live turns + history archive) — so the vote
// behavior can't drift between them.
//
// Feedback is ONE-SHOT per response: the first click locks the buttons
// so a user rates a given answer exactly once. The vote is persisted
// per run_id in localStorage so the lock SURVIVES a re-open of the
// surface (close + reopen Spotlight, or re-render the history archive)
// on the same device — without it the local vote state reset on every
// remount and the user could keep re-voting. The backend
// AgentRunFeedback row (POST /agent/runs/<run_id>/feedback/) stays the
// source of truth and dedupes idempotently per (run, user); this
// localStorage guard is a device-local UX lock, not the record itself.
//
// (Cross-device stickiness would require the run/history read path to
// carry the viewer's stored rating — it doesn't today, see the
// `initialRating` seed, which is still honored as a fallback so that
// wiring can drop in later.)

import { useEffect, useState } from "react";
import ThumbDownAltRoundedIcon from "@mui/icons-material/ThumbDownAltRounded";
import ThumbUpAltRoundedIcon from "@mui/icons-material/ThumbUpAltRounded";
import { IconButton } from "@mui/joy";

const VOTE_STORAGE_PREFIX = "agent_feedback_vote:";

// Read the persisted vote for a run. Returns 1 / -1, or null when the
// user hasn't voted (or storage is unavailable). 0 is never persisted —
// a cleared vote isn't a thing anymore (feedback is one-shot).
const readStoredVote = (runId: string): number | null => {
    try {
        const raw = localStorage.getItem(`${VOTE_STORAGE_PREFIX}${runId}`);
        if (raw === null) return null;
        const n = Number(raw);
        return n === 1 || n === -1 ? n : null;
    } catch {
        return null;
    }
};

const writeStoredVote = (runId: string, rating: number): void => {
    try {
        localStorage.setItem(`${VOTE_STORAGE_PREFIX}${runId}`, String(rating));
    } catch {
        // Private mode / quota exceeded — the in-memory lock still holds
        // for this mount. Worst case, a later re-open allows one more
        // (idempotent, backend-deduped) vote. Never surface this.
    }
};

interface FeedbackThumbsProps {
    // The turn's AgentRun id. Absent (null/undefined) for error turns,
    // cancelled turns, and turns persisted before run_id capture —
    // the component renders nothing in that case.
    runId?: string | null;
    onFeedback?: (runId: string, rating: number) => void;
    labels?: { up?: string; down?: string };
    // Fallback seed for the vote when nothing is persisted locally —
    // lets a surface that knows the viewer's stored rating (from a
    // future backend read path) render it pre-selected + locked.
    // Defaults to 0 (unrated). A persisted localStorage vote wins over
    // this.
    initialRating?: number;
}

export const FeedbackThumbs = ({
    runId,
    onFeedback,
    labels,
    initialRating = 0,
}: FeedbackThumbsProps) => {
    // Effective seed: a persisted device-local vote wins over the
    // backend-seeded `initialRating`, which wins over "unrated" (0).
    const seed = (): number => {
        if (!runId) return 0;
        return readStoredVote(runId) ?? initialRating;
    };
    const [rating, setRating] = useState<number>(seed);
    // Locked once any vote exists (fresh click, persisted, or seeded).
    const [locked, setLocked] = useState<boolean>(() => seed() !== 0);

    // Re-seed when this instance is reused for a different run — the
    // history list can reuse mounts across turns, and a prior turn's
    // vote/lock must not leak onto the next.
    useEffect(() => {
        const next = runId ? (readStoredVote(runId) ?? initialRating) : 0;
        setRating(next);
        setLocked(next !== 0);
    }, [runId, initialRating]);

    if (!runId || !onFeedback) return null;

    const handleFeedback = (next: number) => {
        // One vote per response — after the first click the buttons are
        // locked; a mis-click can't be corrected (by design).
        if (locked) return;
        setRating(next);
        setLocked(true);
        writeStoredVote(runId, next);
        onFeedback(runId, next);
    };
    return (
        <>
            <IconButton
                color={rating === 1 ? "success" : "neutral"}
                disabled={locked}
                size="sm"
                sx={{ minWidth: 0, p: "3px" }}
                title={labels?.up ?? "Good answer"}
                variant={rating === 1 ? "soft" : "plain"}
                onClick={() => handleFeedback(1)}
            >
                <ThumbUpAltRoundedIcon sx={{ fontSize: 14 }} />
            </IconButton>
            <IconButton
                color={rating === -1 ? "danger" : "neutral"}
                disabled={locked}
                size="sm"
                sx={{ minWidth: 0, p: "3px" }}
                title={labels?.down ?? "Needs work"}
                variant={rating === -1 ? "soft" : "plain"}
                onClick={() => handleFeedback(-1)}
            >
                <ThumbDownAltRoundedIcon sx={{ fontSize: 14 }} />
            </IconButton>
        </>
    );
};
