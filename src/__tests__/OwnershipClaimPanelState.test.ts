/**
 * `resolveClaimPanel` — what the team profile shows about ownership
 * recovery.
 *
 * Five states that look alike in the payload. The two that must never
 * be confused: "you may ask for ownership" and "your request is already
 * pending" — offering the button beside a live claim of your own leads
 * straight into the server's one-claim-per-team refusal.
 */
import { describe, expect, it } from "vitest";

import { resolveClaimPanel } from "../features/admin/components/team/ownershipClaimPanelState";
import type { OwnershipClaimStatus } from "../features/admin/services/ownershipClaim";

const noClaim = (over: Partial<OwnershipClaimStatus> = {}): OwnershipClaimStatus => ({
    claim: null,
    canRequest: false,
    retryAfter: null,
    responseDays: 30,
    ...over,
});

const withClaim = (over: Partial<OwnershipClaimStatus["claim"]> = {}): OwnershipClaimStatus => ({
    ...noClaim(),
    claim: {
        itemId: 9,
        deadline: "2026-08-29T00:00:00Z",
        status: "pending",
        isMine: false,
        claimantId: "u2",
        canFinalize: false,
        ...over,
    },
});

describe("resolveClaimPanel", () => {
    it("offers nothing before the status has loaded", () => {
        expect(resolveClaimPanel(null, false).kind).toBe("none");
    });

    it("offers the request button to an eligible editor", () => {
        expect(resolveClaimPanel(noClaim({ canRequest: true }), false).kind).toBe("request");
    });

    it("offers nothing to a member who isn't eligible", () => {
        expect(resolveClaimPanel(noClaim(), false).kind).toBe("none");
    });

    it("shows my own pending claim instead of the request button", () => {
        // `canRequest: true` beside an open claim is contradictory, and
        // today's server never sends it — which is exactly why the
        // ordering here needs pinning rather than assuming. An open
        // claim wins: filing a second is refused, so the button could
        // only ever produce an error.
        const status = { ...withClaim({ isMine: true }), canRequest: true };
        const panel = resolveClaimPanel(status, false);
        expect(panel.kind).toBe("mine");
        expect(panel).toMatchObject({ itemId: 9, canFinalize: false });
    });

    it("passes through canFinalize once the deadline has passed", () => {
        const panel = resolveClaimPanel(withClaim({ isMine: true, canFinalize: true }), false);
        expect(panel).toMatchObject({ kind: "mine", canFinalize: true });
    });

    it("tells other members a claim is open", () => {
        expect(resolveClaimPanel(withClaim(), false).kind).toBe("other");
    });

    it("does not repeat the claim to the owner, who answers it in their inbox", () => {
        // The inbox card is the one with approve/reject. A read-only
        // copy here would be a second, weaker place to see the same
        // thing and invites the owner to treat it as handled.
        expect(resolveClaimPanel(withClaim(), true).kind).toBe("none");
    });

    it("still shows the owner their own claim on another team", () => {
        // `isTeamOwner` suppresses only someone ELSE's claim.
        expect(resolveClaimPanel(withClaim({ isMine: true }), true).kind).toBe("mine");
    });

    it("explains a cooldown rather than silently hiding the button", () => {
        const panel = resolveClaimPanel(noClaim({ retryAfter: "2026-09-28T00:00:00Z" }), false);
        expect(panel).toMatchObject({ kind: "cooldown", until: "2026-09-28T00:00:00Z" });
    });

    it("prefers the request button over a spent cooldown", () => {
        const panel = resolveClaimPanel(noClaim({ canRequest: true, retryAfter: null }), false);
        expect(panel.kind).toBe("request");
    });
});
