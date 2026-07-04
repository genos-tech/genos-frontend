// 👍/👎 feedback buttons for a finished agent turn (F1,
// SPOTLIGHT_QUALITY_ARCHITECTURE.md §Q0.6). Shared by every agent
// surface — the thread/note Ask modal (AgentQAConversation) and the
// Spotlight overlay (live turns + history archive) — so the optimistic
// vote behavior can't drift between them.
//
// The component owns the optimistic local vote (0 = none, 1 = 👍,
// -1 = 👎). Re-clicking the active thumb clears it (rating 0), matching
// the backend contract: POST /agent/runs/<run_id>/feedback/ upserts
// idempotently with rating ∈ {-1, 0, 1}. The POST itself is the
// caller's `onFeedback` (fire-and-forget) — a failed write must never
// break the answer UI.

import { useState } from "react";
import ThumbDownAltRoundedIcon from "@mui/icons-material/ThumbDownAltRounded";
import ThumbUpAltRoundedIcon from "@mui/icons-material/ThumbUpAltRounded";
import { IconButton } from "@mui/joy";

interface FeedbackThumbsProps {
    // The turn's AgentRun id. Absent (null/undefined) for error turns,
    // cancelled turns, and turns persisted before run_id capture —
    // the component renders nothing in that case.
    runId?: string | null;
    onFeedback?: (runId: string, rating: number) => void;
    labels?: { up?: string; down?: string };
    // Seed for the optimistic vote — lets an archive surface that knows
    // the viewer's stored rating render it pre-selected. Defaults to 0.
    initialRating?: number;
}

export const FeedbackThumbs = ({
    runId,
    onFeedback,
    labels,
    initialRating = 0,
}: FeedbackThumbsProps) => {
    const [rating, setRating] = useState(initialRating);
    if (!runId || !onFeedback) return null;
    const handleFeedback = (next: number) => {
        const applied = rating === next ? 0 : next;
        setRating(applied);
        onFeedback(runId, applied);
    };
    return (
        <>
            <IconButton
                color={rating === 1 ? "success" : "neutral"}
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
