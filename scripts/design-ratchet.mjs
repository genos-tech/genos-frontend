// The design ratchet (MIP-1137): counts of the OLD design patterns may only fall.
//
// The design system (src/theme/tokens, genos-docs/design/DESIGN_SYSTEM.md) is
// adopted one sweep at a time. Without a guard the old patterns creep back in
// as fast as the sweeps remove them, so this module counts them per area and
// the vitest guard (src/__tests__/designRatchet.test.ts) fails when a count
// rises above the committed baseline (scripts/design-ratchet-baseline.json).
// `npm run ratchet:update` rewrites the baseline after a sweep lowered a count, and
// `npm run ratchet:slack` lists what could be tightened (read-only).
//
// ONE module, three users: the vitest guard, the update script (the CLI at the
// bottom of this file) and the fixture tests. It is plain .mjs so the CLI needs
// no TypeScript transpile.
//
// WHAT IS COUNTED (occurrences, in source with comments stripped)
//   literalColors    `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, and `rgb(` / `rgba(`
//                    followed by a DIGIT. `rgba(var(--x-rgb), 0.2)`, `rgba(${r}, ...)`
//                    and `rgba(from ...)` do NOT count: those already go through a
//                    variable or token, which is the goal. Named colors, `hsl()` and
//                    `color-mix()` are not counted (known limit).
//   isDarkTernaries  `isDark ? a : b` and `mode === "dark" ? a : b` (also "light",
//                    `!==`). A component asks for a role; the token layer picks the
//                    mode. `isDark?: boolean`, `isDark?.x`, `isDark ?? y` and
//                    `isDarkMode ?` are not matched (`isDarkMode` does not occur today).
//   gradients        `linear-gradient`, `radial-gradient`, `conic-gradient` (also the
//                    `repeating-` forms). Gradient belongs on the primary Button and
//                    Genos moments only, via tokens.
//   brandVars        `--gp-brand-NNN` and `--gp-brandalt-NNN` (the legacy numeric brand
//                    scale), with or without `var(`.
//   heavyFontWeights `fontWeight` / `font-weight` of 700, 800, 900, bold or bolder,
//                    also inside a ternary (`fontWeight: on ? 700 : 500`). Weights are
//                    400/500/600. Joy's named `fontWeight="xl"` (= 700) is NOT matched.
//   backdropFilter   `backdropFilter` / `backdrop-filter` (and the `-webkit-` /
//                    `WebkitBackdropFilter` twins count with their standard property,
//                    never twice). Counted in occurrences, not files, so a second blur
//                    in a file that already has one is caught too.
//   muiMaterial      imports from `@mui/material` (incl. sub-paths and dynamic
//                    `import()`); `@mui/icons-material` is a different package and is
//                    not counted.
//
// WHERE
//   Everything under src/ with a .ts .tsx .js .jsx .mjs .cjs .mts .cts or .css
//   extension, EXCEPT: src/__tests__, any __tests__ / __mocks__ directory,
//   *.test.* / *.spec.* files, *.d.ts, src/theme/** (the token layer owns the
//   literals), src/features/designSystem/** (the gallery shows raw values on
//   purpose), src/lp/** (marketing pages, out of scope), src/i18n/locales/**.
//   AREA = `features/<name>`, `components/<name>`, or `other` (everything else:
//   App.tsx, hooks, services, utils, context, index.css, and the few files that sit
//   directly in src/components or src/features). Moving a file between areas looks
//   like a rise in the destination and needs `--allow-raise`.
//
// COMMENT STRIPPING (stripComments) is a small scanner, not a parser. It keeps
// strings and template-literal text (colors live in strings), skips `//` inside
// them, and recognises regex literals by the previous token so that `/["']/` or
// `/\/\//` do not derail it. Known limits, all of which can only cause a
// false count or a missed count on the one line involved, never a crash:
//   - CSS-in-template-literal comments (`/* ... */` inside css`...`) are template
//     text to JS, so they are NOT stripped and a color named there is counted.
//   - JSX text containing `//` ("http://x" outside quotes) is read as a line comment
//     and the rest of that line is dropped; an apostrophe in JSX text opens a "string"
//     that ends at the next quote or the end of the line.
//   - A regex literal after `)` or `}` is read as division.
//   - CSS files only strip `/* */` (a `//` is not a comment in CSS).
//
// FILE FORMAT (design-ratchet-baseline.json): flat, sorted, one `"<area>:<metric>"`
// per line, zeros omitted (absent = 0, so a new area or metric starts at 0 and
// cannot rise silently). No totals, dates or other lines that change on every PR:
// parallel sweep PRs each lower a few lines and merge textually. Two PRs that lower
// the SAME line (a big area like features/tasks) cannot merge textually, and the right
// answer is a third number: re-run `npm run ratchet:update` on the merged tree.
// So committing the lowered baseline is OPTIONAL (MIP-1408): the guard passes against
// a higher one, it only means the slack is not locked in. `ratchet:slack` shows how
// much is left unlocked, and one update commit on its own tightens it.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_SRC = path.join(REPO_ROOT, "src");
export const DEFAULT_BASELINE = path.join(REPO_ROOT, "scripts", "design-ratchet-baseline.json");

/** Metric name -> one global regex (reset before every use). Order is display order. */
export const METRICS = {
    literalColors: {
        regex: /(?<![\w&])(?<!\burl\(\s*["']?)#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|\brgba?\(\s*\d/g,
        hint: "use a role from the `g` tokens (theme/tokens), e.g. g.text.secondary / g.surface.*",
    },
    isDarkTernaries: {
        regex: /\bisDark\s*\?(?![?.:])|(?:===?|!==?)\s*["'](?:dark|light)["']\s*\?(?![?.:])/g,
        hint: "ask for a role; the tokens already switch with the mode (no isDark branching)",
    },
    gradients: {
        regex: /\b(?:repeating-)?(?:linear|radial|conic)-gradient\b/g,
        hint: "flat surface; a gradient only on a primary Button or a Genos moment, from tokens",
    },
    brandVars: {
        regex: /--gp-brand(?:alt)?-\d+\b/g,
        hint: "use a role (g.accent.* / g.text.*) instead of the numeric brand scale",
    },
    heavyFontWeights: {
        regex: /\b(?:fontWeight|font-weight)\s*[:=]\s*[^,;}]{0,80}?\b(?:700|800|900|bolder|bold)\b/g,
        hint: "weights are 400 / 500 / 600; use 600 for emphasis",
    },
    backdropFilter: {
        regex: /(?<![\w-])backdrop-filter\b|\bbackdropFilter\b/g,
        hint: "flat surfaces, quiet depth: no blur on regular surfaces",
    },
    muiMaterial: {
        regex: /(?:\bfrom|\bimport\s*\(?|\brequire\s*\()\s*["']@mui\/material(?:\/[^"']*)?["']/g,
        hint: "use the shared component or Joy UI instead of @mui/material",
    },
};

export const METRIC_NAMES = Object.keys(METRICS);

/** Files scanned. `.d.ts` are excluded separately (a type file holds no styles). */
const SOURCE_EXTENSIONS = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".mts",
    ".cts",
    ".css",
]);

const EXCLUDED_PREFIXES = [
    "__tests__/",
    "theme/",
    "features/designSystem/",
    "lp/",
    "i18n/locales/",
];
const EXCLUDED_DIRS = new Set(["__tests__", "__mocks__", "node_modules"]);
const EXCLUDED_FILE = /\.(?:test|spec)\.[^/]+$|\.d\.[cm]?ts$/;

// ---------------------------------------------------------------- stripping

/** Words after which a `/` starts a regex literal instead of dividing. */
const REGEX_AFTER_WORD = new Set([
    "return",
    "typeof",
    "case",
    "do",
    "else",
    "in",
    "of",
    "void",
    "delete",
    "throw",
    "new",
    "yield",
    "await",
]);
const REGEX_AFTER_CHAR = "(,=:[!&|?{};";
const IDENT = /[A-Za-z0-9_$]/;

/** End index (exclusive) of the regex literal starting at `i`, or -1 if it is not one. */
function regexEnd(src, i) {
    let inClass = false;
    for (let j = i + 1; j < src.length; j++) {
        const c = src[j];
        if (c === "\n") return -1;
        if (c === "\\") j++;
        else if (c === "[") inClass = true;
        else if (c === "]") inClass = false;
        else if (c === "/" && !inClass) {
            j++;
            while (j < src.length && IDENT.test(src[j])) j++; // flags
            return j;
        }
    }
    return -1;
}

/** End index (exclusive) of the quoted string starting at `i` (stops at a newline). */
function stringEnd(src, i) {
    const quote = src[i];
    for (let j = i + 1; j < src.length; j++) {
        const c = src[j];
        if (c === "\\") j++;
        else if (c === quote) return j + 1;
        else if (c === "\n") return j;
    }
    return src.length;
}

function stripCss(src) {
    const parts = [];
    let last = 0;
    let i = 0;
    while (i < src.length) {
        const c = src[i];
        if (c === '"' || c === "'") i = stringEnd(src, i);
        else if (c === "/" && src[i + 1] === "*") {
            const end = src.indexOf("*/", i + 2);
            const stop = end === -1 ? src.length : end + 2;
            parts.push(src.slice(last, i), " ");
            last = i = stop;
        } else i++;
    }
    parts.push(src.slice(last));
    return parts.join("");
}

/**
 * Source with comments removed (a block comment becomes one space, a line comment
 * nothing; newlines outside comments are kept). Strings, template text and regex
 * literals are left untouched. See the header for the known limits.
 */
export function stripComments(source, { css = false } = {}) {
    const src = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
    if (css) return stripCss(src);
    const parts = [];
    let last = 0; // start of the text not yet copied to `parts`
    let i = 0;
    let mode = "code"; // "code" | "template"
    let depth = 0; // `{` nesting inside the current `${ ... }` (or top level)
    const saved = []; // enclosing depths while inside `${ ... }`
    let prev = ""; // last significant code character ("" at the start)
    let word = ""; // last identifier word, for `return /re/`
    const drop = (from, to, replacement) => {
        parts.push(src.slice(last, from), replacement);
        last = to;
    };
    while (i < src.length) {
        const c = src[i];
        if (mode === "template") {
            if (c === "\\") i += 2;
            else if (c === "`") {
                mode = "code";
                prev = "`";
                i++;
            } else if (c === "$" && src[i + 1] === "{") {
                saved.push(depth);
                depth = 0;
                mode = "code";
                prev = "{";
                i += 2;
            } else i++;
            continue;
        }
        if (c === " " || c === "\t" || c === "\n" || c === "\r") {
            i++;
        } else if (c === "/" && src[i + 1] === "/") {
            let end = src.indexOf("\n", i);
            if (end === -1) end = src.length;
            drop(i, end, "");
            i = end;
        } else if (c === "/" && src[i + 1] === "*") {
            const close = src.indexOf("*/", i + 2);
            const end = close === -1 ? src.length : close + 2;
            drop(i, end, " ");
            i = end;
        } else if (
            c === "/" &&
            (prev === "" || REGEX_AFTER_CHAR.includes(prev) || REGEX_AFTER_WORD.has(word))
        ) {
            const end = regexEnd(src, i);
            if (end === -1) {
                prev = c;
                i++;
            } else {
                prev = ")"; // an operand: a following `/` divides
                word = "";
                i = end;
            }
        } else if (c === '"' || c === "'") {
            i = stringEnd(src, i);
            prev = c;
            word = "";
        } else if (c === "`") {
            mode = "template";
            i++;
        } else if (IDENT.test(c)) {
            let j = i + 1;
            while (j < src.length && IDENT.test(src[j])) j++;
            word = src.slice(i, j);
            prev = src[j - 1];
            i = j;
        } else {
            if (c === "{") depth++;
            else if (c === "}") {
                if (depth === 0 && saved.length > 0) {
                    depth = saved.pop();
                    mode = "template";
                    i++;
                    continue;
                }
                depth = Math.max(0, depth - 1);
            }
            prev = c;
            word = "";
            i++;
        }
    }
    parts.push(src.slice(last));
    return parts.join("");
}

// ----------------------------------------------------------------- counting

/** { metric: count } for one file's text. */
export function countText(source, { css = false } = {}) {
    const code = stripComments(source, { css });
    const counts = {};
    for (const [name, { regex }] of Object.entries(METRICS)) {
        regex.lastIndex = 0;
        let n = 0;
        while (regex.exec(code) !== null) n++;
        counts[name] = n;
    }
    return counts;
}

/** Area of a path relative to src/ (posix separators), or null if the file is not counted. */
export function areaOf(rel) {
    if (EXCLUDED_PREFIXES.some((prefix) => rel.startsWith(prefix))) return null;
    const parts = rel.split("/");
    if (parts.some((part, k) => k < parts.length - 1 && EXCLUDED_DIRS.has(part))) return null;
    const name = parts[parts.length - 1];
    if (EXCLUDED_FILE.test(name)) return null;
    if (!SOURCE_EXTENSIONS.has(path.posix.extname(name))) return null;
    if ((parts[0] === "features" || parts[0] === "components") && parts.length > 2) {
        return `${parts[0]}/${parts[1]}`;
    }
    return "other";
}

/** Counted files under `srcRoot`, as posix paths relative to it, sorted. Symlinks are skipped. */
export function listSourceFiles(srcRoot) {
    const found = [];
    const walk = (rel) => {
        for (const entry of fs.readdirSync(path.join(srcRoot, rel), { withFileTypes: true })) {
            const child = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                if (!EXCLUDED_DIRS.has(entry.name)) walk(child);
            } else if (entry.isFile() && areaOf(child) !== null) found.push(child);
        }
    };
    walk("");
    return found.sort();
}

/**
 * Counts for the whole tree.
 * @returns {{ counts: Record<string, number>, files: Record<string, Array<[string, number]>> }}
 *   `counts` is keyed `"<area>:<metric>"` (zeros omitted); `files` lists, per key, the
 *   contributing files with their counts, biggest first.
 */
export function countTree(srcRoot = DEFAULT_SRC) {
    const counts = {};
    const files = {};
    for (const rel of listSourceFiles(srcRoot)) {
        const text = fs.readFileSync(path.join(srcRoot, rel), "utf8");
        const perFile = countText(text, { css: rel.endsWith(".css") });
        const area = areaOf(rel);
        for (const [metric, n] of Object.entries(perFile)) {
            if (n === 0) continue;
            const key = `${area}:${metric}`;
            counts[key] = (counts[key] ?? 0) + n;
            (files[key] ??= []).push([`src/${rel}`, n]);
        }
    }
    for (const list of Object.values(files)) {
        list.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    }
    return { counts, files };
}

/** Sum per metric over all areas. */
export function totalsByMetric(counts) {
    const totals = Object.fromEntries(METRIC_NAMES.map((name) => [name, 0]));
    for (const [key, n] of Object.entries(counts))
        totals[key.slice(key.lastIndexOf(":") + 1)] += n;
    return totals;
}

// ------------------------------------------------------------------ baseline

/** Plain code-unit order, so the file is identical on every machine and locale. */
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Baseline file text: sorted keys, one per line, zeros omitted, trailing newline. */
export function serializeBaseline(counts) {
    const sorted = {};
    for (const key of Object.keys(counts).sort(byCodeUnit)) {
        if (counts[key] > 0) sorted[key] = counts[key];
    }
    return `${JSON.stringify(sorted, null, 4)}\n`;
}

/** Parse baseline text; throws on a malformed entry. */
export function parseBaseline(text) {
    const raw = JSON.parse(text);
    const baseline = {};
    for (const [key, value] of Object.entries(raw)) {
        if (!Number.isInteger(value) || value < 0 || !/^[^:]+:[A-Za-z]+$/.test(key)) {
            throw new Error(`design-ratchet baseline: bad entry ${JSON.stringify(key)}: ${value}`);
        }
        baseline[key] = value;
    }
    return baseline;
}

export function loadBaseline(file = DEFAULT_BASELINE) {
    return parseBaseline(fs.readFileSync(file, "utf8"));
}

/**
 * Entries whose count is above the baseline (a missing baseline entry is 0).
 * Sorted by key. Counts below baseline are never reported.
 */
export function findRises(counts, baseline) {
    const rises = [];
    for (const key of Object.keys(counts).sort(byCodeUnit)) {
        const was = baseline[key] ?? 0;
        if (counts[key] > was) rises.push({ key, was, now: counts[key] });
    }
    return rises;
}

/**
 * Files changed on this branch or in the working tree (posix paths from the repo
 * root), so a failure can point at the files the author touched instead of only the
 * biggest contributors. Best effort: no git, no `origin/main` or a shallow clone just
 * mean fewer names. Only called when the guard is already failing.
 */
export function changedFiles(root = REPO_ROOT) {
    const changed = new Set();
    const git = (args) => {
        try {
            const text = execFileSync("git", args, {
                cwd: root,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "ignore"],
            });
            for (const line of text.split("\n")) if (line.trim()) changed.add(line.trim());
        } catch {
            // not a git checkout, or the ref does not exist: skip this source
        }
    };
    git(["diff", "--name-only", "HEAD"]);
    git(["ls-files", "--others", "--exclude-standard"]);
    git(["diff", "--name-only", "origin/main...HEAD"]);
    // CI checks a pull request out as a merge commit with one commit of history:
    // against its first parent that is exactly what the PR changed.
    git(["diff", "--name-only", "HEAD^1", "HEAD"]);
    // CI checks a pull request out as a merge commit with one commit of history:
    // against its first parent that is exactly what the PR changed.
    git(["diff", "--name-only", "HEAD^1", "HEAD"]);
    return changed;
}

/**
 * The failure message of the guard: area, metric, old -> new, the files changed on
 * this branch that contribute (when `changed` is given), the biggest contributors,
 * and how to fix.
 */
export function formatRises(rises, files = {}, { topFiles = 5, changed = new Set() } = {}) {
    const lines = [
        "Design ratchet: the old design patterns may only decrease, and these went up.",
        "",
    ];
    for (const { key, was, now } of rises) {
        const at = key.lastIndexOf(":");
        const area = key.slice(0, at);
        const metric = key.slice(at + 1);
        lines.push(`  ${area}  ${metric}: ${was} -> ${now}  (+${now - was})`);
        const hint = METRICS[metric]?.hint;
        if (hint) lines.push(`    fix: ${hint}`);
        const list = files[key] ?? [];
        const mine = list.filter(([file]) => changed.has(file));
        if (mine.length > 0) {
            lines.push("    in files you changed:");
            for (const [file, n] of mine.slice(0, topFiles)) lines.push(`      ${n}x ${file}`);
        }
        lines.push(`    ${mine.length > 0 ? "biggest in the area" : "biggest files"}:`);
        for (const [file, n] of list.slice(0, topFiles)) lines.push(`      ${n}x ${file}`);
        if (list.length > topFiles)
            lines.push(`      ... and ${list.length - topFiles} more files`);
    }
    lines.push(
        "",
        "Use the `g` design tokens and the shared components instead of literals (see",
        "genos-docs/design/DESIGN_SYSTEM.md, section Guardrails). Counts are per area, so a",
        "file that is not listed can still be the one that pushed the area over.",
        "If a sweep LOWERED other counts, `npm run ratchet:update` locks them in (commit the",
        "baseline; if another open PR lowers the same area, leave it for a tightening commit",
        "on its own, `npm run ratchet:slack` lists what is left). Raising a number on purpose",
        "needs `npm run ratchet:update -- --allow-raise` and a reason in the PR."
    );
    return lines.join("\n");
}

/**
 * The counts that are BELOW the baseline: slack the guard lets through but has not locked in
 * (a later PR could spend it). Sorted by key; a baseline entry whose area is gone reads as 0.
 */
export function findSlack(counts, baseline) {
    const slack = [];
    for (const key of Object.keys(baseline).sort(byCodeUnit)) {
        const now = counts[key] ?? 0;
        if (now < baseline[key]) slack.push({ key, was: baseline[key], now });
    }
    return slack;
}

/** The slack as text for `--slack`: one line per entry, then the total and how to lock it in. */
export function formatSlack(slack) {
    if (slack.length === 0)
        return "design-ratchet: no slack, the baseline is as tight as the code.";
    const total = slack.reduce((sum, s) => sum + (s.was - s.now), 0);
    return [
        `design-ratchet: ${slack.length} counts are below the baseline (${total} in all) and not locked in:`,
        ...slack.map((s) => `  ${s.key}: ${s.was} -> ${s.now}`),
        "",
        "Lock them in with `npm run ratchet:update` and commit the baseline, on its own or",
        "with a sweep. Nothing is wrong until then: the guard passes against the higher number.",
    ].join("\n");
}

/**
 * What `ratchet:update` does with the current counts.
 * @returns {{ ok: boolean, text: string, rises: object[], lowered: number }}
 *   `text` is the new baseline file content; `ok` is false when a number would rise
 *   and `allowRaise` was not given.
 */
export function planUpdate({ counts, baseline, allowRaise = false }) {
    const rises = findRises(counts, baseline);
    const keys = new Set([...Object.keys(counts), ...Object.keys(baseline)]);
    let lowered = 0;
    for (const key of keys) if ((counts[key] ?? 0) < (baseline[key] ?? 0)) lowered++;
    return {
        ok: rises.length === 0 || allowRaise,
        text: serializeBaseline(counts),
        rises,
        lowered,
    };
}

// ----------------------------------------------------------------------- CLI

/** `node scripts/design-ratchet.mjs [--allow-raise] [--src dir] [--baseline file] [--report] [--slack]` */
export function main(argv = process.argv.slice(2), out = (text) => console.log(text)) {
    const option = (name) => {
        const at = argv.indexOf(name);
        return at === -1 ? undefined : argv[at + 1];
    };
    const src = path.resolve(option("--src") ?? DEFAULT_SRC);
    const baselineFile = path.resolve(option("--baseline") ?? DEFAULT_BASELINE);
    const allowRaise = argv.includes("--allow-raise");
    const { counts, files } = countTree(src);

    if (argv.includes("--slack")) {
        const slack = findSlack(
            counts,
            fs.existsSync(baselineFile) ? loadBaseline(baselineFile) : {}
        );
        out(formatSlack(slack));
        return 0;
    }

    if (argv.includes("--report")) {
        const totals = totalsByMetric(counts);
        for (const name of METRIC_NAMES) out(`${name.padEnd(18)} ${totals[name]}`);
        return 0;
    }

    const baseline = fs.existsSync(baselineFile) ? loadBaseline(baselineFile) : {};
    const plan = planUpdate({ counts, baseline, allowRaise });
    if (!plan.ok) {
        out(formatRises(plan.rises, files, { changed: changedFiles() }));
        out("");
        out("Baseline NOT written: it refuses to raise a number without --allow-raise.");
        return 1;
    }
    const before = fs.existsSync(baselineFile) ? fs.readFileSync(baselineFile, "utf8") : "";
    if (plan.text !== before) fs.writeFileSync(baselineFile, plan.text);
    const totals = totalsByMetric(counts);
    out(
        plan.text === before
            ? "design-ratchet baseline already up to date."
            : `design-ratchet baseline written (${plan.lowered} lowered, ${plan.rises.length} raised).`
    );
    for (const name of METRIC_NAMES) out(`  ${name.padEnd(18)} ${totals[name]}`);
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exitCode = main();
}
