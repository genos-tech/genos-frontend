/**
 * Guard against the "a var() is not a hex color" bug class documented at
 * the top of `purplePalette.ts`.
 *
 * When the palette moved from hex literals to CSS custom properties, every
 * surviving `${accent}cc` hex-alpha concatenation silently became the
 * string `var(--gp-brand-700)cc` — not a color. CSS then discards the WHOLE
 * declaration, so a `linear-gradient(...)` background disappears rather than
 * degrading. The chat sidebar's unread badge was one such site: its
 * background vanished, leaving `color: #fff` text on a transparent chip, and
 * the unread count read as "gone".
 *
 * Alpha must be composed through the `-rgb` companion tokens instead:
 *   rgba(var(--gp-brand-700-rgb), 0.8)
 *
 * The scan is deliberately narrow to stay false-positive-free: within each
 * file it only flags concatenation onto property names that THAT SAME FILE
 * assigns a `var(--…)` string to. `${tag.color}20` in a file where `color`
 * carries a real hex from the API is untouched, which is correct — that one
 * is a genuine 8-digit hex.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "..");
const SKIP_DIRS = new Set(["__tests__", "node_modules"]);

/**
 * Files where a key name that IS var()-backed somewhere in the file is
 * also, elsewhere in the same file, a real hex from data — so the
 * name-based match above is a false positive. Each entry states which.
 */
const ALLOWLIST: Record<string, string> = {
    // `tile.color` is a hardcoded functional hex (#ef4444 / #f59e0b / …)
    // on the capacity tiles; the file's var()-backed `color:` keys are
    // unrelated sx values that are never concatenated.
    "features/tasks/components/dashboard/TaskHomeContent.tsx":
        "tile.color is a real hex from the capacity tile config",
};

const collectSourceFiles = (dir: string, out: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            collectSourceFiles(path.join(dir, entry.name), out);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out;
};

/** Strip comments so a doc-comment QUOTING the bad pattern (this file
 *  and `ChatSidebar.tsx` both do) isn't reported as an offender. */
const stripComments = (text: string): string =>
    text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[^\n]*?\/\/.*$/gm, (line) => {
        // Keep the code before a trailing `//`, drop the comment. Naive
        // about "//" inside strings, which only ever loses coverage.
        const idx = line.indexOf("//");
        return idx === -1 ? line : line.slice(0, idx);
    });

/** Property keys this file assigns a `var(--…)` string literal to. */
const varBackedKeys = (text: string): Set<string> => {
    const keys = new Set<string>();
    const re = /(\w+)\s*:\s*(["'`])[^"'`]*var\(--[^"'`]*\2/g;
    for (const match of text.matchAll(re)) keys.add(match[1]);
    return keys;
};

/** `${something.key}cc` — hex-alpha glued onto a var()-backed value. */
const findConcatSites = (text: string, keys: Set<string>): string[] => {
    const hits: string[] = [];
    for (const key of keys) {
        const re = new RegExp(`\\$\\{[^}]*\\.${key}\\}[0-9a-fA-F]{2}\\b`, "g");
        for (const match of text.matchAll(re)) hits.push(match[0]);
    }
    return hits;
};

describe("CSS custom properties are never hex-alpha concatenated", () => {
    it("finds no `${…var-backed…}<hex-alpha>` anywhere under src/", () => {
        const offenders: string[] = [];
        for (const file of collectSourceFiles(SRC_ROOT)) {
            const relative = path.relative(SRC_ROOT, file);
            if (ALLOWLIST[relative]) continue;
            const text = stripComments(fs.readFileSync(file, "utf8"));
            const keys = varBackedKeys(text);
            if (keys.size === 0) continue;
            for (const hit of findConcatSites(text, keys)) {
                offenders.push(`${relative}: ${hit}`);
            }
        }
        // A bare array diff gives whoever trips this no idea what to do,
        // and `frontend-test` is a required check — so spell out both
        // the fix and the escape hatch in the failure itself.
        expect(
            offenders,
            offenders.length === 0
                ? ""
                : [
                      "Hex alpha is concatenated onto a value this file assigns a `var(--…)` to.",
                      "`${token}cc` yields the string `var(--gp-…)cc`, which is not a color — CSS",
                      "then discards the WHOLE declaration, so the background/border silently",
                      "disappears rather than degrading.",
                      "",
                      "Fix: compose through the `-rgb` companion token instead —",
                      "  `${accent}cc`  ->  `rgba(${accentRgb}, 0.8)`   (cc = 204/255)",
                      "Keep the plain `var(--gp-…)` form for opaque use; an RGB triplet is not",
                      "a valid standalone color.",
                      "",
                      "If the flagged value is really a hex from data (a tag color, a config",
                      "literal) this is a false positive of the name-based match — add the file",
                      "to ALLOWLIST above with a one-line reason.",
                      "",
                      "Offenders:",
                      ...offenders.map((o) => `  ${o}`),
                  ].join("\n")
        ).toEqual([]);
    });
});
