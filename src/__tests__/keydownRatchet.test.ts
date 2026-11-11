// @vitest-environment node
/**
 * MIP-1313: the next keyboard shortcut goes through the registry.
 *
 * `src/shortcuts` is the one place that says which chord does what, how it is printed
 * and whether it fires in a text field (MIP-1275). A shortcut that attaches its own
 * `addEventListener("keydown", ...)` skips all three and Settings and the tooltips then
 * disagree with it. So a new key listener outside the places below fails this test:
 * use `useShortcut(id, handler)` (add the id to the registry), or, if the listener is
 * genuinely not a shortcut (a gesture with its own state, a widget key), add the file
 * to ALLOWED with a reason.
 *
 * Counts are exact, so removing a listener fails too: lower the number, like the design
 * ratchet. Only `addEventListener` is counted; React `onKeyDown` props are widget keys
 * (Enter submits a field, Escape closes a popup) and stay out of scope.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** file (relative to src, forward slashes) -> how many key listeners it attaches, and why. */
const ALLOWED: Record<string, { count: number; why: string }> = {
    "shortcuts/useShortcut.ts": { count: 1, why: "the registry's own listener" },
    "hooks/common/useGlobalServiceShortcut.ts": {
        count: 2,
        why: "the service cycle (keydown + keyup, overlay state) and the seven letter chords, matched through the registry",
    },
    "hooks/common/useUndoableAction.ts": {
        count: 1,
        why: "module-level Cmd/Ctrl+Z while an undo toast is up; the chord is the registry's `global.undo`",
    },
    "features/tasks/components/table/useGridNav.tsx": {
        count: 2,
        why: "the task table's grid keys (MIP-1230), listed in Settings as display-only entries",
    },
    "hooks/common/roving/useRovingNav.ts": {
        count: 1,
        why: "the task board's and the calendar's roving tab stops (MIP-1402), listed in Settings as display-only entries",
    },
    "features/tasks/components/table/cellEditors.tsx": {
        count: 1,
        why: "Escape in a table cell editor",
    },
    "features/spotlight/useSpotlight.ts": {
        count: 1,
        why: "Escape closes Spotlight (not a shortcut anyone looks up; Cmd/Ctrl+K is the registry's)",
    },
    "lp/kit/LpShell.tsx": { count: 1, why: "Escape on the marketing site, a separate surface" },
};

const KEY_LISTENER = /addEventListener\(\s*["'`](?:keydown|keyup|keypress)["'`]/g;

const stripComments = (text: string): string =>
    text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "__tests__" || entry.name === "node_modules") continue;
            walk(full, out);
        } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
};

const countListeners = (text: string): number =>
    stripComments(text).match(KEY_LISTENER)?.length ?? 0;

describe("keyboard listeners go through the shortcut registry", () => {
    const found: Record<string, number> = {};
    for (const file of walk(SRC)) {
        const n = countListeners(fs.readFileSync(file, "utf8"));
        if (n > 0) found[path.relative(SRC, file).split(path.sep).join("/")] = n;
    }

    it("no file outside the allowed list attaches a keydown/keyup/keypress listener", () => {
        const unknown = Object.keys(found).filter((f) => !(f in ALLOWED));
        expect(
            unknown,
            `New key listener in ${unknown.join(", ")}. Bind it with useShortcut(id, handler) and add the id to src/shortcuts/registry.ts, or add the file to ALLOWED in keydownRatchet.test.ts with a reason.`
        ).toEqual([]);
    });

    it("an allowed file does not attach more than it did (and the list is exact)", () => {
        for (const [file, { count }] of Object.entries(ALLOWED)) {
            expect(found[file] ?? 0, `${file}: ${ALLOWED[file].why}`).toBe(count);
        }
    });

    it("counts a multi-line call and ignores comments and strings that mention it", () => {
        expect(countListeners('window.addEventListener(\n    "keydown",\n    fn\n);')).toBe(1);
        expect(countListeners("document.addEventListener('keyup', f)")).toBe(1);
        expect(countListeners('// window.addEventListener("keydown", f)')).toBe(0);
        expect(countListeners('/* x.addEventListener("keydown", f) */')).toBe(0);
        expect(countListeners('el.addEventListener("click", f)')).toBe(0);
    });
});
