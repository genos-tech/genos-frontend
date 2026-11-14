// The optional reason a person gives when they reject an approval card (MIP-889).
// The wire rule lives here, beside `decideAgent`; the card and `useAgentQA` use it too.
//
// `POST /api/v2/agent/decide/` takes `reason` with `decision: "reject"` only
// (genos-api `agent/approval_reason.py`, `AgentDecideView`). The server answers
// 400 to a reason longer than `MAX_CHARS` after trimming, to a reason on an
// approve, and to one that is not a string; an empty one counts as not sent.
// The model then gets `{"error": "user_rejected", "reason": "..."}`.
//
// The client only trims and caps. The server also drops control characters and
// folds newlines into spaces; that is its job, not repeated here.
//
// The cap counts UTF-16 code units (what `String.length` and a textarea's
// `maxLength` count). The server counts code points, which are never more, so a
// reason that fits here always fits there (an emoji costs 2 here, 1 there).

/** The server's cap (`approval_reason.MAX_CHARS`). */
export const REJECT_REASON_MAX = 500;

/** At most `max` code units, never ending on half of a surrogate pair. */
export const capRejectReason = (text: string, max = REJECT_REASON_MAX): string => {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const last = cut.charCodeAt(cut.length - 1);
    return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
};

/** The reason as it goes on the wire: text only, trimmed, capped. `""` = none.
 * Anything that is not a string (a click event, an edit patch) is no reason. */
export const cleanRejectReason = (raw: unknown): string => {
    if (typeof raw !== "string") return "";
    return capRejectReason(raw.trim()).trim();
};
