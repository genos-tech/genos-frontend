// The test type-check ratchet (MIP-1315): the error count of the TESTS may only fall.
//
// `tsc -b` (the build, and so the Railway deploy) leaves `src/__tests__` and
// `src/**/*.test.ts(x)` out on purpose: stale test-fixture type drift must not block a
// deploy. The side effect is that a stale prop in a test is never type-checked. This
// script closes that gap WITHOUT putting the tests into the build: it runs
// `tsc -p tsconfig.test.json --noEmit` (the app config with the tests included, vitest
// and node globals) and compares the errors, per file, with a committed baseline
// (scripts/test-typecheck-baseline.json). CI runs it as a separate non-required job
// (`frontend-test-types (report-only)`); it fails when a count rises.
//
//   npm run typecheck:tests          check against the baseline (exit 1 when a count rose)
//   npm run typecheck:tests:update   rewrite the baseline after a sweep lowered a count
//                                    (refuses to raise one without --allow-raise)
//   --from <file>                    read the tsc output from a file instead of running tsc
//
// WHAT IS COUNTED: lines of tsc's plain output that read `<file>(<line>,<col>): error TS<n>:`,
// per file (a `file:line:col` form and `error TSnnnn:` lines without a file, counted under
// "(global)", are read too). Per FILE, not only in total: a fix in one file cannot hide a
// new error in another. A file that is not in the baseline starts at 0, so a new test file
// must be clean, and a file that was fixed to 0 leaves the baseline.
//
// KNOWN LIMITS (it counts, it does not diff): a file that swaps one error for another (fixes two,
// adds two) keeps its count and passes; a renamed or moved test file reads as a new file with
// its old errors (a rise): fix them, or `--update --allow-raise` with the reason in the PR. Both
// are the price of a count that merges textually; the sweeps are what lower the baseline.
//
// FILE FORMAT: flat, sorted, one `"<path>": <count>` per line, zeros omitted, no totals or
// dates, like the design ratchet: parallel sweep PRs each lower a few lines and merge
// textually. If two PRs touch neighbouring lines, take either side and re-run the update.
//
// ONE module for the CLI and the unit tests (src/__tests__/testTypecheckRatchet.test.ts);
// plain .mjs so the CLI needs no transpile.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_BASELINE = path.join(REPO_ROOT, "scripts", "test-typecheck-baseline.json");
export const GLOBAL_KEY = "(global)";

const ERROR_WITH_FILE = /^(.+?)(?:\(\d+,\d+\)|:\d+:\d+)\s*:?\s*-?\s*error TS\d+:/;
const ERROR_WITHOUT_FILE = /^error TS\d+:/;

/** tsc output text -> Map(file -> error count), sorted by file. Continuation lines (the
 *  indented explanation under an error) are not errors and are not counted. */
export function parseTscOutput(text) {
    const counts = new Map();
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trimEnd();
        if (!line || /^\s/.test(line)) continue;
        let file = null;
        const withFile = ERROR_WITH_FILE.exec(line);
        if (withFile) file = withFile[1].replace(/\\/g, "/");
        else if (ERROR_WITHOUT_FILE.test(line)) file = GLOBAL_KEY;
        if (file === null) continue;
        counts.set(file, (counts.get(file) ?? 0) + 1);
    }
    return new Map([...counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function totalOf(counts) {
    let total = 0;
    for (const n of counts.values()) total += n;
    return total;
}

/** Map -> the baseline file's text (sorted, zeros omitted, trailing newline). */
export function serializeBaseline(counts) {
    const entries = [...counts].filter(([, n]) => n > 0).sort(([a], [b]) => (a < b ? -1 : 1));
    if (entries.length === 0) return "{}\n";
    const lines = entries.map(([file, n]) => `    ${JSON.stringify(file)}: ${n}`);
    return `{\n${lines.join(",\n")}\n}\n`;
}

export function parseBaseline(text) {
    const data = JSON.parse(text);
    const counts = new Map();
    for (const [file, n] of Object.entries(data)) {
        if (!Number.isInteger(n) || n < 0) throw new Error(`bad baseline entry ${file}: ${n}`);
        if (n > 0) counts.set(file, n);
    }
    return counts;
}

/** What changed against the baseline. `risen` is what fails the check. */
export function compare(baseline, current) {
    const risen = [];
    const fallen = [];
    for (const file of new Set([...baseline.keys(), ...current.keys()])) {
        const was = baseline.get(file) ?? 0;
        const now = current.get(file) ?? 0;
        if (now > was) risen.push({ file, was, now });
        else if (now < was) fallen.push({ file, was, now });
    }
    return { risen, fallen, was: totalOf(baseline), now: totalOf(current) };
}

function runTsc() {
    const result = spawnSync(
        process.execPath,
        [
            path.join(REPO_ROOT, "node_modules", "typescript", "bin", "tsc"),
            "-p",
            path.join(REPO_ROOT, "tsconfig.test.json"),
            "--noEmit",
            "--pretty",
            "false",
        ],
        { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }
    );
    if (result.error) throw result.error;
    const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    assertTscRan(result.status, result.signal, out);
    return out;
}

/** tsc exits 0 (no errors) or 2 (errors reported, nothing emitted): that is a run. Anything else
 *  (1 = a config problem, 134 / 137 = it died, a signal) may have printed a few error lines
 *  before it stopped, and a partial count must never read as "fewer errors": it is a failure to
 *  run, and `--update` must not write it down. */
export function assertTscRan(status, signal, out) {
    if (status === 0 || status === 2) return;
    throw new Error(
        `tsc did not complete (exit ${status}${signal ? `, ${signal}` : ""}):\n${out.slice(0, 2000)}`
    );
}

function report(delta) {
    const lines = [];
    for (const r of delta.risen.sort((a, b) => b.now - b.was - (a.now - a.was))) {
        lines.push(`  + ${r.file}: ${r.was} -> ${r.now}`);
    }
    return lines.join("\n");
}

export function main(
    argv = process.argv.slice(2),
    { log = console.log, err = console.error, baselinePath = DEFAULT_BASELINE } = {}
) {
    const update = argv.includes("--update");
    const allowRaise = argv.includes("--allow-raise");
    const fromIndex = argv.indexOf("--from");

    let output;
    try {
        output = fromIndex >= 0 ? fs.readFileSync(argv[fromIndex + 1], "utf8") : runTsc();
    } catch (e) {
        err(`test type check could not run: ${e instanceof Error ? e.message : e}`);
        return 1;
    }
    const current = parseTscOutput(output);
    let baseline;
    try {
        baseline = fs.existsSync(baselinePath)
            ? parseBaseline(fs.readFileSync(baselinePath, "utf8"))
            : new Map();
    } catch (e) {
        // A bad merge (conflict markers, a trailing comma) is not "the count rose".
        err(
            `the baseline ${path.relative(REPO_ROOT, baselinePath)} cannot be read: ${e instanceof Error ? e.message : e}`
        );
        return 1;
    }
    const delta = compare(baseline, current);

    if (update) {
        if (delta.risen.length > 0 && !allowRaise) {
            err(
                `Refusing to RAISE the baseline (${delta.was} -> ${delta.now}); fix the new errors, or pass --allow-raise with a reason in the PR:\n${report(delta)}`
            );
            return 1;
        }
        fs.writeFileSync(baselinePath, serializeBaseline(current));
        log(`baseline written: ${delta.was} -> ${delta.now} errors in ${current.size} files`);
        return 0;
    }

    if (delta.risen.length > 0) {
        err(
            `Test type errors rose (${delta.was} -> ${delta.now}). Fix them (npx tsc -p tsconfig.test.json --noEmit), ` +
                `do not raise the baseline:\n${report(delta)}`
        );
        return 1;
    }
    log(
        `test type errors: ${delta.now} (baseline ${delta.was})` +
            (delta.fallen.length > 0
                ? `; ${delta.fallen.length} file(s) fell, run \`npm run typecheck:tests:update\` and commit the baseline`
                : "")
    );
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main());
}
