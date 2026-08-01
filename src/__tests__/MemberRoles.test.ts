import { describe, expect, it } from "vitest";

import {
    ASSIGNABLE_MEMBER_ROLES,
    ASSIGNABLE_PROJECT_ROLES,
    canManageMembers,
    isGuestRole,
    MEMBER_ROLE,
    resolveDisplayRole,
    resolveMyRole,
} from "../utils/memberRoles";

/**
 * `utils/memberRoles` had no test before the guest role landed, which is
 * awkward for a module that decides what every profile modal lets you
 * do. These pin the two behaviours that are easy to regress by writing
 * the "obvious" thing:
 *
 *   - the owner overlay, because the server stores `viewer` on an
 *     owner's row and reading the column directly denies them;
 *   - the guest collapse, because the old shape was
 *     `editor ? editor : viewer`, which silently rendered an external
 *     collaborator as an ordinary viewer.
 */
describe("resolveDisplayRole", () => {
    it("overlays owner from the owner id, not the stored column", () => {
        // The server really does store "viewer" on an owner's row.
        expect(resolveDisplayRole("u1", "u1", "viewer")).toBe(MEMBER_ROLE.owner);
    });

    it("keeps editor", () => {
        expect(resolveDisplayRole("u1", "u2", "editor")).toBe(MEMBER_ROLE.editor);
    });

    it("keeps guest instead of collapsing it to viewer", () => {
        expect(resolveDisplayRole("u1", "u2", "guest")).toBe(MEMBER_ROLE.guest);
    });

    it("falls back to viewer for anything unrecognised", () => {
        expect(resolveDisplayRole("u1", "u2", null)).toBe(MEMBER_ROLE.viewer);
        expect(resolveDisplayRole("u1", "u2", "nonsense")).toBe(MEMBER_ROLE.viewer);
    });

    it("compares ids as strings", () => {
        expect(resolveDisplayRole(1 as unknown as string, "1", "viewer")).toBe(MEMBER_ROLE.owner);
    });
});

describe("canManageMembers", () => {
    it("admits owner and editor", () => {
        expect(canManageMembers(MEMBER_ROLE.owner)).toBe(true);
        expect(canManageMembers(MEMBER_ROLE.editor)).toBe(true);
    });

    it("refuses viewer and guest", () => {
        expect(canManageMembers(MEMBER_ROLE.viewer)).toBe(false);
        // A guest who could invite people would defeat the point of
        // scoping them.
        expect(canManageMembers(MEMBER_ROLE.guest)).toBe(false);
    });
});

describe("assignable role sets", () => {
    it("never offers owner", () => {
        expect(ASSIGNABLE_MEMBER_ROLES).not.toContain(MEMBER_ROLE.owner);
        expect(ASSIGNABLE_PROJECT_ROLES).not.toContain(MEMBER_ROLE.owner);
    });

    it("offers guest on a project but not on a team", () => {
        // A guest holds no team membership row, so there is nothing to
        // set the value on at team level.
        expect(ASSIGNABLE_MEMBER_ROLES).not.toContain(MEMBER_ROLE.guest);
        expect(ASSIGNABLE_PROJECT_ROLES).toContain(MEMBER_ROLE.guest);
    });
});

describe("isGuestRole", () => {
    it("is true only for guest", () => {
        expect(isGuestRole("guest")).toBe(true);
        for (const other of ["owner", "editor", "viewer", null, undefined, ""]) {
            expect(isGuestRole(other)).toBe(false);
        }
    });
});

describe("resolveMyRole", () => {
    const members = [
        { userId: "u1", memberRole: "viewer" },
        { userId: "u2", memberRole: "editor" },
        { userId: "u3", memberRole: "guest" },
    ];

    it("finds the caller and applies the owner overlay", () => {
        expect(resolveMyRole("u1", "u1", members)).toBe(MEMBER_ROLE.owner);
        expect(resolveMyRole("u2", "u1", members)).toBe(MEMBER_ROLE.editor);
        expect(resolveMyRole("u3", "u1", members)).toBe(MEMBER_ROLE.guest);
    });

    it("treats an absent caller as a viewer", () => {
        expect(resolveMyRole("nobody", "u1", members)).toBe(MEMBER_ROLE.viewer);
        expect(resolveMyRole("nobody", "u1", null)).toBe(MEMBER_ROLE.viewer);
    });
});
