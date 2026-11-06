// Which vitest tests a pull request needs to run (MIP-1095).
//
// `vitest related <files>` runs only the tests that import (directly or through
// other modules, static or dynamic) one of the changed files. It is exact for what
// it can see, and blind to everything that is not an import, so this script only
// uses it when the whole change is something it can see, and otherwise says "run
// everything". A skipped test that mattered is the one failure this must never
// have, so every doubt resolves to "all":
//
//   - not a pull request (a push to main always runs everything);
//   - the diff cannot be read, or is empty;
//   - a file was deleted or renamed (a test may still import the old path);
//   - a changed file is not TypeScript/JavaScript/CSS inside src/ (package.json,
//     the lockfile, configs, workflows, scripts, assets, snapshots, fixtures,
//     markdown that the blog reads with ?raw, ...);
//   - the shared test setup (src/__tests__/setup.ts) or a type declaration changed;
//   - more than MAX_FILES source files changed (the saving is gone anyway).
//
// Tests that READ files from disk (guards that scan the source for a forbidden
// pattern, workflow and config checks, ...) are not found by `related`, because
// they have no import of what they read. They always run: they are found by
// scanning the tests for file-reading calls, so a new one is included on its own.
//
// Output is `key=value` lines for $GITHUB_OUTPUT, and the files to hand to
// `vitest related` (changed files plus the file-reading tests), one per line, in
// the file named by --files-out.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** More changed source files than this and a full run is about as fast. */
export const MAX_FILES = 100;

/** The only files `related` can follow: modules inside src/. */
export const CODE_EXTENSIONS = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mts",
    ".cts",
    ".mjs",
    ".cjs",
    ".css",
]);

/**
 * Files inside src/ that affect tests without being imported by them, so a change
 * means "run everything". `vite.config.ts` lists the setup file under `setupFiles`;
 * a test pins that this list contains every entry.
 */
export const RUN_EVERYTHING_FILES = new Set(["src/__tests__/setup.ts"]);

/** Changes that cannot affect a test (same denylist as the workflow's `changes` job). */
const IGNORABLE = /^docs\/|\.md$|^LICENSE|^\.gitignore$/;

/**
 * A test that touches the filesystem or builds paths from its own location. It
 * reads something no import leads to, so `related` cannot know when it is
 * affected. `?raw`, `?url` and `?inline` imports are the same blind spot: vite
 * loads the file, but not as a module the graph follows. Deliberately wide: a test
 * that matches by accident only runs more often, which is safe; one that is
 * missed would be skipped, which is not.
 */
export const FILE_READER =
    /\b(?:readFileSync|readdirSync|readFile|existsSync|statSync|lstatSync|globSync|opendirSync)\b|from\s+["'](?:node:)?fs(?:\/promises)?["']|require\(\s*["'](?:node:)?fs|import\.meta\.glob|__dirname|process\.cwd\(|["']node:path["']|\?(?:raw|url|inline)["']/;

const TEST_FILE = /\.test\.(?:ts|tsx)$/;

const all = (reason) => ({ mode: "all", reason, files: [] });

/** `git diff --name-status --no-renames` output as [{ status, path }]. */
export function parseNameStatus(text) {
    return text
        .split("\n")
        .map((line) => line.trimEnd())
        .filter(Boolean)
        .map((line) => {
            const [status, ...rest] = line.split("\t");
            return { status: status.trim(), path: rest.join("\t") };
        });
}

/**
 * Decide what to run.
 * @param {{ changes: Array<{status: string, path: string}>, filesystemTests: string[] }} input
 * @returns {{ mode: "all" | "related", reason: string, files: string[] }}
 */
export function selectTests({ changes, filesystemTests }) {
    if (!Array.isArray(changes) || changes.length === 0) {
        return all("no changed files were found");
    }
    const code = new Set();
    for (const { status, path: file } of changes) {
        // Added and modified are the only changes `related` can follow. Anything
        // else (deleted, renamed, copied, type change, unmerged, unknown) may leave
        // a test importing a path that moved.
        if (status !== "A" && status !== "M") {
            return all(`${file} was ${status === "D" ? "deleted" : `changed (${status})`}`);
        }
        const inSrc = file.startsWith("src/");
        if (!inSrc && IGNORABLE.test(file)) continue;
        if (!inSrc) return all(`${file} is outside src/`);
        if (!CODE_EXTENSIONS.has(path.extname(file))) {
            return all(`${file} is not a module that tests import`);
        }
        if (file.endsWith(".d.ts")) return all(`${file} is a type declaration`);
        if (RUN_EVERYTHING_FILES.has(file)) return all(`${file} is the shared test setup`);
        code.add(file);
    }
    if (code.size === 0) return all("no source file changed");
    if (code.size > MAX_FILES) return all(`${code.size} source files changed`);

    const files = [...new Set([...code, ...filesystemTests])].sort();
    return {
        mode: "related",
        reason:
            `${code.size} source file${code.size === 1 ? "" : "s"} changed: running the tests ` +
            `that import ${code.size === 1 ? "it" : "them"}, plus ${filesystemTests.length} ` +
            "tests that read files",
        files,
    };
}

/** Every test file under `root`/src/__tests__ that reads files (see FILE_READER). */
export function findFilesystemTests(
    root,
    { readFile = fs.readFileSync, readdir = fs.readdirSync } = {}
) {
    const found = [];
    const walk = (dir) => {
        for (const entry of readdir(path.join(root, dir), { withFileTypes: true })) {
            const rel = path.posix.join(dir, entry.name);
            if (entry.isDirectory()) walk(rel);
            else if (
                TEST_FILE.test(entry.name) &&
                FILE_READER.test(readFile(path.join(root, rel), "utf8"))
            ) {
                found.push(rel);
            }
        }
    };
    walk("src/__tests__");
    return found.sort();
}

/** The PR's own changes: the merge commit CI checks out, against its first parent. */
function readChanges(exec) {
    return parseNameStatus(
        exec("git", ["diff", "--name-status", "--no-renames", "HEAD^1", "HEAD"], {
            encoding: "utf8",
        })
    );
}

/**
 * Entry point. Never throws and never returns anything but a valid answer: a
 * failure anywhere means "run everything".
 */
export function run({
    env = process.env,
    exec = execFileSync,
    root = process.cwd(),
    filesOut,
    write = (text) => process.stdout.write(text),
    writeFile = fs.writeFileSync,
    findTests = findFilesystemTests,
} = {}) {
    let result;
    try {
        if (env.GITHUB_EVENT_NAME !== "pull_request") {
            result = all("not a pull request");
        } else {
            result = selectTests({ changes: readChanges(exec), filesystemTests: findTests(root) });
        }
        if (result.mode === "related" && filesOut)
            writeFile(filesOut, `${result.files.join("\n")}\n`);
    } catch (error) {
        result = all(`could not choose tests (${error instanceof Error ? error.message : error})`);
    }
    write(`mode=${result.mode}\nreason=${result.reason.replace(/[\r\n]+/g, " ")}\n`);
    return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const at = process.argv.indexOf("--files-out");
    run({ filesOut: at === -1 ? undefined : process.argv[at + 1] });
}
