/**
 * "(You)" is decided by id, never by email (MIP-813).
 *
 * `myself.userEmail` is empty until the private profile hydrates (memory-only
 * since MIP-619) and a roster row can lack an email, so comparing emails made
 * two blanks equal and badged a teammate "(You)".
 */

import { describe, expect, it } from "vitest";

import { personLabel } from "../utils/personLabel";

const YOU = "(You)";
const ME = "u-me";

describe("personLabel", () => {
    it("badges me, by id, and shows the email after a dash", () => {
        expect(personLabel({ userId: ME, userName: "Ann", userEmail: "a@x.io" }, ME, YOU)).toBe(
            "Ann (You) - a@x.io"
        );
    });

    it("leaves a teammate unbadged", () => {
        expect(personLabel({ userId: "u-2", userName: "Bob", userEmail: "b@x.io" }, ME, YOU)).toBe(
            "Bob - b@x.io"
        );
    });

    it("does not badge a teammate whose email equals mine", () => {
        // Two accounts can share a display address (a shared inbox, an alias).
        expect(
            personLabel({ userId: "u-2", userName: "Bob", userEmail: "same@x.io" }, ME, YOU)
        ).toBe("Bob - same@x.io");
    });

    it("badges me even when my email is blank", () => {
        expect(personLabel({ userId: ME, userName: "Ann", userEmail: "" }, ME, YOU)).toBe(
            "Ann (You)"
        );
    });

    it("does not badge a teammate with a blank email just because mine is blank too", () => {
        expect(personLabel({ userId: "u-2", userName: "Bob", userEmail: "" }, ME, YOU)).toBe(
            "Bob"
        );
    });

    it("badges nobody before I am known", () => {
        for (const mine of ["", null, undefined]) {
            expect(personLabel({ userId: "u-2", userName: "Bob" }, mine, YOU)).toBe("Bob");
            expect(personLabel({ userId: "", userName: "Ghost" }, mine, YOU)).toBe("Ghost");
        }
    });

    it("shows no dangling dash when there is no email", () => {
        for (const userEmail of [undefined, null, ""]) {
            expect(personLabel({ userId: "u-2", userName: "Bob", userEmail }, ME, YOU)).toBe(
                "Bob"
            );
        }
    });
});

describe("no picker decides 'is this me' by email any more", () => {
    it("none of the sources compares an email with myself.userEmail", async () => {
        // The comparison was copied into several pickers; this keeps a new copy
        // (or a revert) from coming back without a failing test.
        const { execSync } = await import("node:child_process");
        const hits = execSync(
            `/usr/bin/grep -rnE "(userEmail|email) *===? *myself\\.userEmail" src --include=*.ts --include=*.tsx || true`,
            { encoding: "utf8", cwd: process.cwd() }
        )
            .split("\n")
            .filter((line) => line && !line.includes("__tests__"));

        expect(hits).toEqual([]);
    });
});
