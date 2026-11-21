// The ESLint warning ratchet (MIP-1849): the number of ESLint WARNINGS may only fall.
//
// `npx eslint .` fails on errors only: the relaxed/stylistic rules are warnings, so the
// warning count had no gate and it rose unseen (1,142 on main at MIP-1849). This script
// runs ESLint over the whole app, counts the warnings, and compares the total with the
// committed baseline (scripts/lint-warning-baseline.json). CI runs it inside
// `frontend-quality (report-only)`, after the error gate; it fails when the total rises.
//
//   npm run lint:ratchet           check against the baseline (exit 1 when the total rose)
//   npm run lint:ratchet:update    rewrite the baseline after a sweep lowered the count
//                                  (refuses to raise it)
//   --from <file>                  read ESLint's `-f json` output from a file instead of running it
//
// WHAT IS COUNTED: every ESLint message with severity 1 (warning). Errors are not counted
// here: `npx eslint .` already fails on them.
//
// KNOWN LIMIT: it counts, it does not diff. A PR that fixes one warning and adds another
// keeps the total and passes. The sweeps are what lower the baseline.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = path.join(REPO_ROOT, "scripts", "lint-warning-baseline.json");

function readEslintJson(fromFile) {
    if (fromFile) return fs.readFileSync(fromFile, "utf8");
    const run = spawnSync("npx", ["eslint", ".", "-f", "json"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        maxBuffer: 256 * 1024 * 1024,
    });
    if (run.error) throw run.error;
    // ESLint exits 1 when there are errors, which the error gate reports; the JSON is still valid.
    return run.stdout;
}

export function countWarnings(json) {
    let total = 0;
    for (const file of JSON.parse(json)) {
        for (const message of file.messages) if (message.severity === 1) total += 1;
    }
    return total;
}

function main(argv) {
    const fromIndex = argv.indexOf("--from");
    const fromFile = fromIndex >= 0 ? argv[fromIndex + 1] : null;
    const update = argv.includes("--update");
    const total = countWarnings(readEslintJson(fromFile));
    const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8")).total;

    if (update) {
        if (total > baseline) {
            console.error(`Refusing to raise the warning baseline (${baseline} -> ${total}).`);
            return 1;
        }
        fs.writeFileSync(BASELINE, `${JSON.stringify({ total }, null, 4)}\n`);
        console.log(`Warning baseline set to ${total} (was ${baseline}).`);
        return 0;
    }

    if (total > baseline) {
        console.error(
            `ESLint warnings rose: ${total} > baseline ${baseline}. Fix the new ones, or, if the rise is intended, explain it in the PR.`
        );
        return 1;
    }
    console.log(
        `ESLint warnings: ${total} (baseline ${baseline}${total < baseline ? ", can be lowered" : ""}).`
    );
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = main(process.argv.slice(2));
}
