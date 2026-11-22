/**
 * MIP-2060: in MUI `sx` a bare `width: 1` is 100% (and `margin: -1` is -8px). A local copy of the
 * "visually hidden" style written that way is a parent-sized box that can stretch a scroll area.
 * Every screen-reader-only box must use the shared `visuallyHidden` (1px strings) instead of a
 * private copy with numeric sizes.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");

const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
        return /\.tsx?$/.test(name) ? [path] : [];
    });

// An object literal that clips to nothing (the visually-hidden recipe) and sizes itself with a
// bare number.
const CLIP_BLOCK = /\{[^{}]*clip:\s*"rect\(0 0 0 0\)"[^{}]*\}/g;
const NUMERIC_SIZE = /\b(width|height):\s*-?\d+\s*,/;

describe("visually hidden styles", () => {
    it("no source file keeps a copy sized with bare numbers", () => {
        const offenders = sourceFiles(SRC).filter((file) =>
            (readFileSync(file, "utf8").match(CLIP_BLOCK) ?? []).some((b) => NUMERIC_SIZE.test(b))
        );
        expect(offenders.map((f) => f.slice(SRC.length + 1))).toEqual([]);
    });
});
