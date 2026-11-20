/**
 * "(You)" is decided by id, never by email (MIP-813).
 *
 * `myself.userEmail` is empty until the private profile hydrates (memory-only
 * since MIP-619) and a roster row can lack an email, so comparing emails made
 * two blanks equal and badged a teammate "(You)".
 */

import { describe, expect, it } from "vitest";

import { personFilterOptions, personLabel } from "../utils/personLabel";

const YOU = "(You)";
const ME = "u-me";

describe("personLabel", () => {
    it("badges me, by id, and never shows the email (MIP-1703)", () => {
        expect(
            personLabel({ userId: ME, userName: "Ann", userEmail: "a@x.io" } as never, ME, YOU)
        ).toBe("Ann (You)");
    });

    it("leaves a teammate unbadged and without an address", () => {
        expect(
            personLabel({ userId: "u-2", userName: "Bob", userEmail: "b@x.io" } as never, ME, YOU)
        ).toBe("Bob");
    });

    it("does not badge a teammate whose email equals mine", () => {
        // Two accounts can share a display address (a shared inbox, an alias).
        expect(
            personLabel(
                { userId: "u-2", userName: "Bob", userEmail: "same@x.io" } as never,
                ME,
                YOU
            )
        ).toBe("Bob");
    });

    it("badges me even when my email is blank", () => {
        expect(personLabel({ userId: ME, userName: "Ann", userEmail: "" } as never, ME, YOU)).toBe(
            "Ann (You)"
        );
    });

    it("badges nobody before I am known", () => {
        for (const mine of ["", null, undefined]) {
            expect(personLabel({ userId: "u-2", userName: "Bob" }, mine, YOU)).toBe("Bob");
            expect(personLabel({ userId: "", userName: "Ghost" }, mine, YOU)).toBe("Ghost");
        }
    });
});

describe("personFilterOptions: typing still finds a person by email, though it is not shown", () => {
    const people = [
        { userName: "Zoe", userEmail: "zoe@acme.test" },
        { userName: "Ann", userEmail: "ann@acme.test" },
        { userName: "Bob", userEmail: null },
        { userName: "Cy" },
    ];
    const run = (inputValue: string) =>
        personFilterOptions(people, { inputValue, getOptionLabel: (p) => p.userName }).map(
            (p) => p.userName
        );

    it("matches the name", () => {
        expect(run("ann")).toEqual(["Ann"]);
    });

    it("matches the email", () => {
        expect(run("zoe@")).toEqual(["Zoe"]);
        expect(run("acme")).toEqual(["Zoe", "Ann"]);
    });

    it("does not invent a match from a missing email", () => {
        expect(run("null")).toEqual([]);
        expect(run("undefined")).toEqual([]);
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
