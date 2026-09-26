/**
 * Keeps React out of the web workers' import graphs.
 *
 * In dev, `@vitejs/plugin-react-swc` prepends an UNCONDITIONAL
 * `import * as RefreshRuntime from "/@react-refresh"` to every module that
 * exports a React component. That runtime assigns to `window` at top level.
 * A worker has `self`, not `window`, so the import alone — hoisted and
 * evaluated before any guard the plugin also emits — throws
 * `ReferenceError: window is not defined` and the worker dies on boot.
 *
 * That is exactly what happened: `src/utils/dateUtils.ts` imported the
 * `src/i18n` BARREL for `getMessages`, and the barrel re-exports
 * `I18nProvider.tsx`. Since the tasks/users/notes/activity handlers all reach
 * dateUtils, four of the five workers crashed at startup — and because
 * `tasksChannel` is the only data path for the task table, the table rendered
 * completely empty. Verified in a real browser: 4 crash before the fix, 0
 * after. Production builds are unaffected (the injection is gated on
 * `import.meta.hot`), which is why it went unnoticed.
 *
 * The rule this pins: nothing a worker can reach may import a barrel that
 * re-exports a component module. Import the React-free leaf instead.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "..");

const WORKER_ENTRIES = [
    "db/workers/tasksWorker.ts",
    "db/workers/usersWorker.ts",
    "db/workers/notesWorker.ts",
    "db/workers/inboxWorker.ts",
    "db/workers/activityWorker.ts",
];

const readIfExists = (path: string): string | null => {
    try {
        return readFileSync(path, "utf8");
    } catch {
        return null;
    }
};

/** Resolve a relative specifier the way Vite would, trying TS extensions. */
const resolveSpecifier = (fromFile: string, spec: string): string | null => {
    const base = resolve(dirname(fromFile), spec);
    for (const candidate of [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}/index.ts`,
        `${base}/index.tsx`,
    ]) {
        if (candidate.endsWith(".ts") || candidate.endsWith(".tsx")) {
            if (readIfExists(candidate) !== null) return candidate;
        }
    }
    return null;
};

// Matches `import ... from "x"`, `export ... from "x"`, bare `import "x"` and
// dynamic `import("x")`. Only relative specifiers matter — a bare package
// name can't reach first-party .tsx files.
const SPECIFIER_RE =
    /(?:^|[\s;{}()])(?:import|export)[\s\S]{0,600}?from\s*["'](\.[^"']*)["']|import\s*\(\s*["'](\.[^"']*)["']\s*\)|^\s*import\s*["'](\.[^"']*)["']/gm;

/** Every first-party module reachable from `entry`, plus how we got there. */
const walkGraph = (entry: string) => {
    const seen = new Set<string>();
    const parent = new Map<string, string>();
    const stack = [resolve(SRC, entry)];

    while (stack.length > 0) {
        const file = stack.pop() as string;
        if (seen.has(file)) continue;
        seen.add(file);

        const src = readIfExists(file);
        if (src === null) continue;

        SPECIFIER_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = SPECIFIER_RE.exec(src)) !== null) {
            const spec = match[1] ?? match[2] ?? match[3];
            if (spec === undefined) continue;
            // Type-only imports are erased and never evaluated at runtime.
            if (/import\s+type\s/.test(match[0]) || /export\s+type\s/.test(match[0])) continue;
            const target = resolveSpecifier(file, spec);
            if (target === null) continue;
            if (!parent.has(target)) parent.set(target, file);
            stack.push(target);
        }
    }
    return { seen, parent };
};

const chainTo = (file: string, parent: Map<string, string>): string => {
    const hops = [file];
    let cursor = file;
    // Bounded: the graph is a DAG per-walk, but guard against surprises.
    for (let i = 0; i < 40 && parent.has(cursor); i++) {
        cursor = parent.get(cursor) as string;
        hops.push(cursor);
    }
    return hops
        .reverse()
        .map((h) => h.replace(`${SRC}/`, ""))
        .join("\n     -> ");
};

describe("web worker import graphs stay React-free", () => {
    for (const entry of WORKER_ENTRIES) {
        it(`${entry} reaches no .tsx module`, () => {
            const { seen, parent } = walkGraph(entry);

            // Sanity: the walker must actually be resolving imports. Without
            // this, a broken regex would make every assertion below vacuous.
            expect(seen.size).toBeGreaterThan(5);

            const tsx = [...seen].filter((f) => f.endsWith(".tsx"));
            const detail = tsx.map((f) => chainTo(f, parent)).join("\n\n");
            expect(
                tsx.length,
                tsx.length === 0
                    ? ""
                    : `A worker must not import a React component module — in dev that` +
                          ` pulls in /@react-refresh, which touches \`window\` at top level` +
                          ` and kills the worker on boot. Import the React-free leaf` +
                          ` (e.g. "../i18n/getMessages") instead of the barrel.\n\n${detail}`
            ).toBe(0);
        });
    }

    it("the i18n barrel is what makes this a live trap, not a theoretical one", () => {
        // If the barrel ever stops re-exporting a component, the rule above
        // still holds but this specific footgun is gone — in which case this
        // test should be deleted rather than "fixed".
        const barrel = readFileSync(resolve(SRC, "i18n/index.ts"), "utf8");
        expect(barrel).toContain('from "./I18nProvider"');
    });

    it("getMessages is importable without touching React", () => {
        // The leaf the workers now depend on. If it grows a .tsx import, every
        // worker regresses at once.
        const { seen } = walkGraph("i18n/getMessages.ts");
        expect([...seen].filter((f) => f.endsWith(".tsx"))).toEqual([]);
    });
});
