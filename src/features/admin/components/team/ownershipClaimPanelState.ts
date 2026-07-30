/**
 * What the team profile should show about ownership recovery — decided
 * as a pure function so the branching is testable without rendering.
 *
 * There are five states and they are easy to conflate. In particular
 * "an editor may ask for ownership" and "MY request is waiting" look
 * similar in the API payload but must never both render: filing twice
 * is refused by the server, so offering the button next to a pending
 * request of your own is an invitation to a 409.
 */
import type { OwnershipClaimStatus } from "../../services/ownershipClaim";

export type ClaimPanelState =
    /** Nothing to show — no claim, and I can't file one. */
    | { kind: "none" }
    /** I'm an eligible editor and nothing is open. */
    | { kind: "request" }
    /** My last claim was rejected and I'm still inside the cooldown. */
    | { kind: "cooldown"; until: string }
    /** My claim is waiting on the owner. */
    | { kind: "mine"; itemId: number; deadline: string | null; canFinalize: boolean }
    /** Someone else's claim is open on this team. */
    | { kind: "other"; deadline: string | null };

/**
 * `isTeamOwner` suppresses the "other" panel only: the owner is the
 * RECEIVER of the claim and answers it from their inbox, where the
 * approve/reject buttons live. Showing them a read-only copy here would
 * be a second, weaker place to see the same thing — and the inbox card
 * is the one that can act on it.
 *
 * Everything else is driven off the server's own `canRequest` /
 * `canFinalize`, which are advisory: every endpoint re-checks under a
 * row lock. This only decides what to draw.
 */
export const resolveClaimPanel = (
    status: OwnershipClaimStatus | null,
    isTeamOwner: boolean
): ClaimPanelState => {
    if (!status) return { kind: "none" };

    if (status.claim) {
        if (status.claim.isMine) {
            return {
                kind: "mine",
                itemId: status.claim.itemId,
                deadline: status.claim.deadline,
                canFinalize: status.claim.canFinalize,
            };
        }
        return isTeamOwner ? { kind: "none" } : { kind: "other", deadline: status.claim.deadline };
    }

    if (status.canRequest) return { kind: "request" };
    // A cooldown is worth surfacing even though it offers no action:
    // otherwise the button simply vanishes after a rejection and reads
    // as a bug rather than a rule.
    if (status.retryAfter) return { kind: "cooldown", until: status.retryAfter };
    return { kind: "none" };
};
