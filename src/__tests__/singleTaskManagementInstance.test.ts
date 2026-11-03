/**
 * There is exactly ONE `useTaskManagement` instance in the app (MIP-971).
 *
 * `useServiceInitialization` used to build a second one that `App.tsx` never
 * read. A manager hook is 35 pieces of state plus effects, living inside
 * `AppBody`: every setter on the unused one re-rendered `AppBody` (and so the
 * whole app) for a result nobody saw, and at boot it fetched `/task/meta/`
 * into state nobody reads.
 *
 * Structural: the failure is how many times a hook is called, which no render
 * of either caller can show.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "..");

const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            return name === "__tests__" ? [] : sourceFiles(full);
        }
        return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [full] : [];
    });

// A call is `useTaskManagement(`; the definition is `useTaskManagement = (`.
const callSites = sourceFiles(SRC).filter((file) =>
    /\buseTaskManagement\(/.test(
        readFileSync(file, "utf8")
            .split("\n")
            .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
            .join("\n")
    )
);

describe("useTaskManagement instances", () => {
    it("is called from one place only: useProjectTaskManagement", () => {
        expect(callSites.map((file) => relative(SRC, file))).toEqual([
            join("hooks", "common", "useProjectTaskManagement.ts"),
        ]);
    });

    it("useServiceInitialization no longer builds or returns a task manager", () => {
        const source = readFileSync(
            resolve(SRC, "hooks", "common", "useServiceInitialization.ts"),
            "utf8"
        );
        const code = source
            .split("\n")
            .filter((line) => !line.trim().startsWith("//"))
            .join("\n");
        expect(code).not.toMatch(/useTaskManagement/);
        expect(code).not.toMatch(/\buseTM\b/);
    });
});
