import { describe, expect, it } from "vitest";

import { isDeletedUser, withoutDeletedUsers } from "../utils/teamRoster";

/**
 * Deleting an account anonymises it rather than removing its rows, so a
 * gone person keeps riding in on rosters, member snapshots and task
 * assignees. The client never gets an `isDeleted` flag on a user object
 * (it's a sync-channel tombstone the cache strips), so these two
 * anonymised marks — the `@deleted.invalid` email and the "Deleted user"
 * username — are the whole client-side signal. Pin them: the domain is
 * server-controlled and the username is the only fallback for a picker
 * row that arrives without an email.
 */
describe("isDeletedUser", () => {
    it("matches the anonymised email domain (roster shape)", () => {
        expect(isDeletedUser({ userEmail: "deleted-abc123@deleted.invalid" })).toBe(true);
    });

    it("matches the anonymised email domain (assignee shape)", () => {
        expect(isDeletedUser({ email: "deleted-abc123@deleted.invalid" })).toBe(true);
    });

    it("matches the anonymised username when no email is present", () => {
        expect(isDeletedUser({ userName: "Deleted user" })).toBe(true);
        expect(isDeletedUser({ name: "Deleted user" })).toBe(true);
    });

    it("is case-insensitive on the email domain", () => {
        expect(isDeletedUser({ userEmail: "Deleted-ABC@Deleted.Invalid" })).toBe(true);
    });

    it("keeps a live user whose name merely resembles the marker", () => {
        // Substring, not equality: a real name containing the phrase must
        // not be caught, and a normal email must pass.
        expect(
            isDeletedUser({ userName: "Deleted user's replacement", userEmail: "a@corp.com" })
        ).toBe(false);
    });

    it("keeps a live user with an ordinary email", () => {
        expect(isDeletedUser({ userName: "Ada Lovelace", userEmail: "ada@corp.com" })).toBe(false);
    });

    it("does not match on a lookalike domain (must be the exact suffix)", () => {
        expect(isDeletedUser({ userEmail: "user@notdeleted.invalid.com" })).toBe(false);
    });

    it("treats missing/null fields as not-deleted", () => {
        expect(isDeletedUser({})).toBe(false);
        expect(isDeletedUser({ userEmail: null, userName: null })).toBe(false);
    });
});

describe("withoutDeletedUsers", () => {
    it("drops deleted rows and keeps the rest, preserving order", () => {
        const members = [
            { userId: "1", userName: "Ada", userEmail: "ada@corp.com" },
            { userId: "2", userName: "Deleted user", userEmail: "deleted-x@deleted.invalid" },
            { userId: "3", userName: "Grace", userEmail: "grace@corp.com" },
        ];
        expect(withoutDeletedUsers(members).map((m) => m.userId)).toEqual(["1", "3"]);
    });

    it("returns an empty array unchanged", () => {
        expect(withoutDeletedUsers([])).toEqual([]);
    });
});
