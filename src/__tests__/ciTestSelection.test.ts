// @vitest-environment node
// Which tests a pull request runs (scripts/ci-test-selection.mjs, MIP-1095).
//
// `vitest related` skips tests, so the one thing that must hold is that it never
// skips one that mattered. Everything here is a case where the answer is "run
// everything", or where a test that cannot be found by its imports is still run.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    CODE_EXTENSIONS,
    FILE_READER,
    findFilesystemTests,
    MAX_FILES,
    parseNameStatus,
    run,
    RUN_EVERYTHING_FILES,
    selectTests,
} from "../../scripts/ci-test-selection.mjs";

const M = (file: string) => ({ status: "M", path: file });
const A = (file: string) => ({ status: "A", path: file });
const FS_TESTS = ["src/__tests__/GuardA.test.ts", "src/__tests__/GuardB.test.tsx"];

const choose = (changes: Array<{ status: string; path: string }>, filesystemTests = FS_TESTS) =>
    selectTests({ changes, filesystemTests });

describe("a change that only touches source files", () => {
    it("runs the tests that import it, plus the tests that read files", () => {
        const picked = choose([M("src/features/tasks/diagram/utils/layoutDiagram.ts")]);
        expect(picked.mode).toBe("related");
        expect(picked.files).toEqual([
            "src/__tests__/GuardA.test.ts",
            "src/__tests__/GuardB.test.tsx",
            "src/features/tasks/diagram/utils/layoutDiagram.ts",
        ]);
    });

    it("takes several files once each, in a fixed order", () => {
        const picked = choose([
            M("src/z.ts"),
            A("src/a.tsx"),
            M("src/z.ts"),
            // Already in the always-run list: not twice.
            M("src/__tests__/GuardA.test.ts"),
        ]);
        expect(picked.mode).toBe("related");
        expect(picked.files).toEqual([
            "src/__tests__/GuardA.test.ts",
            "src/__tests__/GuardB.test.tsx",
            "src/a.tsx",
            "src/z.ts",
        ]);
    });

    it("runs a changed or added test file (it selects itself)", () => {
        const picked = choose([M("src/__tests__/foo.test.ts"), A("src/__tests__/bar.test.tsx")]);
        expect(picked.mode).toBe("related");
        expect(picked.files).toContain("src/__tests__/foo.test.ts");
        expect(picked.files).toContain("src/__tests__/bar.test.tsx");
    });

    it.each(["ts", "tsx", "js", "jsx", "mts", "cts", "mjs", "cjs", "css"])(
        "follows a .%s file",
        (ext) => {
            expect(choose([M(`src/x/y.${ext}`)]).mode).toBe("related");
        }
    );

    it("explains itself in one line", () => {
        const one = choose([M("src/a.ts")]);
        expect(one.reason).toBe(
            "1 source file changed: running the tests that import it, plus 2 tests that read files"
        );
        expect(choose([M("src/a.ts"), M("src/b.ts")]).reason).toMatch(/^2 source files changed:/);
    });

    it("stays selective at the limit and runs everything above it", () => {
        const many = (n: number) => Array.from({ length: n }, (_, i) => M(`src/f${i}.ts`));
        expect(choose(many(MAX_FILES)).mode).toBe("related");
        const over = choose(many(MAX_FILES + 1));
        expect(over.mode).toBe("all");
        expect(over.reason).toMatch(/source files changed/);
    });

    it("ignores a change that cannot affect a test (docs, markdown outside src)", () => {
        expect(choose([M("README.md"), M("src/a.ts")]).mode).toBe("related");
        expect(choose([M("docs/guide.md"), M("src/a.ts")]).mode).toBe("related");
        expect(choose([M("LICENSE"), M(".gitignore"), M("src/a.ts")]).mode).toBe("related");
    });
});

describe("a change vitest cannot follow runs everything", () => {
    const allFor = (changes: Array<{ status: string; path: string }>) => {
        const picked = choose(changes);
        expect(picked.mode, picked.reason).toBe("all");
        expect(picked.files).toEqual([]);
        return picked;
    };

    it("when the diff is empty, missing or malformed", () => {
        allFor([]);
        expect(selectTests({ changes: undefined as never, filesystemTests: [] }).mode).toBe("all");
        expect(selectTests({ changes: null as never, filesystemTests: [] }).mode).toBe("all");
        allFor([{ status: "M", path: "" }]);
    });

    it("when a file was deleted, renamed, copied or its type changed", () => {
        expect(allFor([{ status: "D", path: "src/gone.ts" }, M("src/a.ts")]).reason).toMatch(
            /deleted/
        );
        allFor([{ status: "R100", path: "src/new.ts" }]);
        allFor([{ status: "C75", path: "src/copy.ts" }]);
        allFor([{ status: "T", path: "src/a.ts" }]);
        allFor([{ status: "U", path: "src/a.ts" }]);
        allFor([{ status: "?", path: "src/a.ts" }]);
    });

    it.each([
        "package.json",
        "package-lock.json",
        "vite.config.ts",
        "tsconfig.app.json",
        "tsconfig.json",
        "eslint.config.js",
        "index.html",
        "railway.toml",
        "Dockerfile.cloudrun",
        ".github/workflows/ci.yml",
        "scripts/ci-test-selection.mjs",
        "scripts/bundleGuard.ts",
        "public/icon.png",
        "patches/some-package+1.0.0.patch",
        ".prettierrc",
    ])("when %s changes", (file) => {
        expect(allFor([M("src/a.ts"), M(file)]).reason).toContain(file);
    });

    it.each([
        "src/assets/logo.svg",
        "src/data/table.json",
        "src/lp/blog/articles/post.md",
        "src/__tests__/__snapshots__/x.test.ts.snap",
        "src/__tests__/fixtures/payload.json",
        "src/styles/theme.scss",
        "src/fonts/a.woff2",
        "src/types/legacy.d.ts",
        "src/vite-env.d.ts",
    ])("when %s (in src, but not a module tests import) changes", (file) => {
        allFor([M("src/a.ts"), M(file)]);
    });

    it("when the shared test setup changes", () => {
        expect(allFor([M("src/__tests__/setup.ts")]).reason).toContain("test setup");
    });

    it("whenever any one file in a mixed change is out of reach", () => {
        allFor([M("src/a.ts"), M("src/b.ts"), M("src/c.ts"), M("package.json")]);
    });

    it("when only ignorable files changed (nothing to select by)", () => {
        expect(allFor([M("README.md")]).reason).toMatch(/no source file/);
    });

    it("never treats a path that merely contains 'src/' as source", () => {
        allFor([M("tools/src/a.ts")]);
        allFor([M("srcs/a.ts")]);
    });
});

describe("parseNameStatus", () => {
    it("reads git's tab-separated output", () => {
        expect(parseNameStatus("M\tsrc/a.ts\nA\tsrc/b.tsx\nD\tsrc/c.ts\n")).toEqual([
            { status: "M", path: "src/a.ts" },
            { status: "A", path: "src/b.tsx" },
            { status: "D", path: "src/c.ts" },
        ]);
    });

    it("keeps a path with a space or tab, and skips blank lines", () => {
        expect(parseNameStatus("M\tsrc/with space.ts\n\n  \nM\tsrc/a\tb.ts\n")).toEqual([
            { status: "M", path: "src/with space.ts" },
            { status: "M", path: "src/a\tb.ts" },
        ]);
    });

    it("gives nothing for nothing", () => {
        expect(parseNameStatus("")).toEqual([]);
    });
});

describe("which tests read files", () => {
    it.each([
        'const text = fs.readFileSync("x", "utf8");',
        "const names = readdirSync(dir);",
        "await readFile(path)",
        "if (existsSync(p)) {}",
        "statSync(p)",
        "lstatSync(p)",
        "globSync('src/**')",
        'import fs from "node:fs";',
        "import fs from 'fs';",
        'import { readFile } from "fs/promises";',
        'const fs = require("node:fs");',
        'import.meta.glob("./x/*.ts")',
        "path.join(__dirname, 'x')",
        "process.cwd()",
        'import path from "node:path";',
        'import text from "./a.md?raw";',
        "import url from './a.svg?url';",
    ])("matches %s", (source) => {
        expect(FILE_READER.test(source)).toBe(true);
    });

    it.each([
        'import { render } from "@testing-library/react";',
        "expect(screen.getByText('x')).toBeTruthy();",
        "const readFileSyncX = 1;",
        "// we do not touch the disk here",
        "const processed = process.env.CI;",
        'import { x } from "../utils/filesystem";',
    ])("does not match %s", (source) => {
        expect(FILE_READER.test(source)).toBe(false);
    });
});

describe("finding the tests that read files", () => {
    const dirs: string[] = [];
    afterEach(() => {
        for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
    });
    const tree = (files: Record<string, string>) => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "ci-select-"));
        dirs.push(root);
        for (const [name, body] of Object.entries(files)) {
            const full = path.join(root, name);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, body);
        }
        return root;
    };

    it("lists test files that read files, sorted, as repo-relative paths", () => {
        const root = tree({
            "src/__tests__/b.test.ts": 'fs.readFileSync("x")',
            "src/__tests__/a.test.tsx": "process.cwd()",
            "src/__tests__/plain.test.ts": "expect(1).toBe(1);",
            "src/__tests__/sub/deep.test.ts": 'import fs from "node:fs";',
        });
        expect(findFilesystemTests(root)).toEqual([
            "src/__tests__/a.test.tsx",
            "src/__tests__/b.test.ts",
            "src/__tests__/sub/deep.test.ts",
        ]);
    });

    it("skips helpers and fixtures, even when they read files", () => {
        const root = tree({
            "src/__tests__/helpers/readSource.ts": 'fs.readFileSync("x")',
            "src/__tests__/setup.ts": "process.cwd()",
            "src/__tests__/fixtures/data.json": "{}",
            "src/other/file.test.ts": 'fs.readFileSync("x")',
        });
        expect(findFilesystemTests(root)).toEqual([]);
    });

    it("finds the real guard tests in this repository, and this file", () => {
        const found = findFilesystemTests(process.cwd());
        expect(found.length).toBeGreaterThan(20);
        for (const guard of [
            "src/__tests__/CssVarAlphaConcatGuard.test.ts",
            "src/__tests__/LazyRenderersGuard.test.ts",
            "src/__tests__/uptimeProbe.test.ts",
            "src/__tests__/ciTestSelection.test.ts",
        ]) {
            expect(found, guard).toContain(guard);
        }
    });
});

describe("what is not an import", () => {
    it("the setup files in vite.config.ts are all in the run-everything list", () => {
        const config = fs.readFileSync(path.join(process.cwd(), "vite.config.ts"), "utf8");
        const match = config.match(/setupFiles:\s*\[([^\]]*)\]/);
        expect(match, "vite.config.ts has no setupFiles").not.toBeNull();
        const entries = [...(match?.[1] ?? "").matchAll(/["']([^"']+)["']/g)].map((m) =>
            m[1].replace(/^\.\//, "")
        );
        expect(entries.length).toBeGreaterThan(0);
        for (const entry of entries) expect(RUN_EVERYTHING_FILES.has(entry), entry).toBe(true);
    });

    it("the module extensions are the ones vitest's graph follows", () => {
        expect([...CODE_EXTENSIONS].sort()).toEqual(
            [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs", ".css"].sort()
        );
    });
});

describe("run", () => {
    const PR = { GITHUB_EVENT_NAME: "pull_request" };

    const go = (over: Partial<Parameters<typeof run>[0]> = {}) => {
        let out = "";
        const files: Record<string, string> = {};
        const result = run({
            env: PR,
            exec: (() => "M\tsrc/a.ts\n") as never,
            findTests: () => ["src/__tests__/GuardA.test.ts"],
            filesOut: "/tmp/related.txt",
            write: (text: string) => {
                out += text;
            },
            writeFile: ((file: string, body: string) => {
                files[file] = body;
            }) as never,
            ...over,
        });
        return { result, out, files };
    };

    it("reads the pull request's own diff: the merge commit against its first parent", () => {
        const exec = vi.fn(() => "M\tsrc/a.ts\n");
        go({ exec: exec as never });
        expect(exec).toHaveBeenCalledWith(
            "git",
            ["diff", "--name-status", "--no-renames", "HEAD^1", "HEAD"],
            { encoding: "utf8" }
        );
    });

    it("prints key=value lines and writes the files to hand to vitest", () => {
        const { out, files } = go();
        expect(out).toBe(
            "mode=related\nreason=1 source file changed: running the tests that import it, plus 1 tests that read files\n"
        );
        expect(files["/tmp/related.txt"]).toBe("src/__tests__/GuardA.test.ts\nsrc/a.ts\n");
    });

    it("runs everything, without touching git, outside a pull request", () => {
        const exec = vi.fn();
        for (const event of ["push", "workflow_dispatch", "schedule", undefined]) {
            const { out, files } = go({ env: { GITHUB_EVENT_NAME: event }, exec: exec as never });
            expect(out).toBe("mode=all\nreason=not a pull request\n");
            expect(files).toEqual({});
        }
        expect(exec).not.toHaveBeenCalled();
    });

    it("writes no file list when everything runs", () => {
        const { files, out } = go({ exec: (() => "M\tpackage.json\n") as never });
        expect(out).toMatch(/^mode=all\n/);
        expect(files).toEqual({});
    });

    it("runs everything when git fails", () => {
        const { out, result } = go({
            exec: (() => {
                throw new Error("fatal: bad revision 'HEAD^1'");
            }) as never,
        });
        expect(result.mode).toBe("all");
        expect(out).toContain("mode=all");
        expect(out).toContain("could not choose tests (fatal: bad revision 'HEAD^1')");
    });

    it("runs everything when scanning the tests fails", () => {
        const { out } = go({
            findTests: () => {
                throw new Error("ENOENT");
            },
        });
        expect(out).toMatch(/^mode=all\nreason=could not choose tests \(ENOENT\)\n$/);
    });

    it("runs everything when the file list cannot be written", () => {
        const { out } = go({
            writeFile: (() => {
                throw new Error("EACCES");
            }) as never,
        });
        expect(out).toMatch(/^mode=all\n/);
    });

    it("keeps the reason on one line", () => {
        const { out } = go({
            exec: (() => {
                throw new Error("first line\nsecond line");
            }) as never,
        });
        expect(out.trimEnd().split("\n")).toHaveLength(2);
    });
});

describe("end to end, on a real merge commit", () => {
    const dirs: string[] = [];
    afterEach(() => {
        for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
    });

    const git = (cwd: string, ...args: string[]) =>
        execFileSync("git", args, {
            cwd,
            encoding: "utf8",
            env: {
                ...process.env,
                GIT_AUTHOR_NAME: "t",
                GIT_AUTHOR_EMAIL: "t@example.com",
                GIT_COMMITTER_NAME: "t",
                GIT_COMMITTER_EMAIL: "t@example.com",
            },
        });

    /** main moves on after the branch is cut, like a real PR; then a merge commit, as Actions checks out. */
    const mergeCommit = (branchChanges: Record<string, string | null>) => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "ci-merge-"));
        dirs.push(root);
        const write = (name: string, body: string | null) => {
            const full = path.join(root, name);
            if (body === null) return fs.rmSync(full);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, body);
        };
        git(root, "init", "-q", "-b", "main");
        write("src/__tests__/guard.test.ts", 'fs.readFileSync("x")');
        write("src/__tests__/plain.test.ts", "expect(1).toBe(1)");
        write("src/a.ts", "export const a = 1;");
        write("src/b.ts", "export const b = 1;");
        write("package.json", "{}");
        git(root, "add", "-A");
        git(root, "commit", "-q", "-m", "base");
        git(root, "checkout", "-q", "-b", "pr");
        for (const [name, body] of Object.entries(branchChanges)) write(name, body);
        git(root, "add", "-A");
        git(root, "commit", "-q", "-m", "the change");
        git(root, "checkout", "-q", "main");
        // Somebody else's change lands on main meanwhile: it must NOT count as ours.
        write("src/b.ts", "export const b = 2;");
        write("other.txt", "landed on main");
        git(root, "add", "-A");
        git(root, "commit", "-q", "-m", "someone else's change");
        git(root, "merge", "-q", "--no-ff", "-m", "merge", "pr");
        return root;
    };

    const script = path.join(process.cwd(), "scripts", "ci-test-selection.mjs");
    const choose = (root: string, event = "pull_request") => {
        const filesOut = path.join(root, "related.txt");
        const out = execFileSync(process.execPath, [script, "--files-out", filesOut], {
            cwd: root,
            encoding: "utf8",
            env: { ...process.env, GITHUB_EVENT_NAME: event },
        });
        const fields = Object.fromEntries(
            out
                .trim()
                .split("\n")
                .map((line) => [
                    line.slice(0, line.indexOf("=")),
                    line.slice(line.indexOf("=") + 1),
                ])
        );
        return {
            fields,
            files: fs.existsSync(filesOut)
                ? fs.readFileSync(filesOut, "utf8").trim().split("\n")
                : [],
        };
    };

    it("sees only the pull request's files, not what landed on main meanwhile", () => {
        const { fields, files } = choose(mergeCommit({ "src/a.ts": "export const a = 2;" }));
        expect(fields.mode).toBe("related");
        // `other.txt` and `src/b.ts` changed on main, not in the PR: not included.
        expect(files).toEqual(["src/__tests__/guard.test.ts", "src/a.ts"]);
    });

    it("runs everything when the pull request touches package.json", () => {
        const { fields, files } = choose(
            mergeCommit({ "src/a.ts": "export const a = 2;", "package.json": '{"x":1}' })
        );
        expect(fields.mode).toBe("all");
        expect(fields.reason).toContain("package.json");
        expect(files).toEqual([]);
    });

    it("runs everything when the pull request deletes a file", () => {
        const { fields } = choose(mergeCommit({ "src/a.ts": null }));
        expect(fields.mode).toBe("all");
        expect(fields.reason).toMatch(/deleted/);
    });

    it("runs everything when the pull request renames a file", () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "ci-rename-"));
        dirs.push(root);
        git(root, "init", "-q", "-b", "main");
        fs.mkdirSync(path.join(root, "src/__tests__"), { recursive: true });
        fs.writeFileSync(path.join(root, "src/a.ts"), "export const a = 1;\n".repeat(20));
        git(root, "add", "-A");
        git(root, "commit", "-q", "-m", "base");
        git(root, "checkout", "-q", "-b", "pr");
        git(root, "mv", "src/a.ts", "src/renamed.ts");
        git(root, "commit", "-q", "-m", "rename");
        git(root, "checkout", "-q", "main");
        fs.writeFileSync(path.join(root, "unrelated.txt"), "x");
        git(root, "add", "-A");
        git(root, "commit", "-q", "-m", "other");
        git(root, "merge", "-q", "--no-ff", "-m", "merge", "pr");
        expect(choose(root).fields.mode).toBe("all");
    });

    it("runs everything on a push, whatever the commit holds", () => {
        const { fields } = choose(mergeCommit({ "src/a.ts": "export const a = 2;" }), "push");
        expect(fields).toEqual({ mode: "all", reason: "not a pull request" });
    });

    it("runs everything, and exits 0, where there is no git history to read", () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "ci-nogit-"));
        dirs.push(root);
        const { fields } = choose(root);
        expect(fields.mode).toBe("all");
        expect(fields.reason).toContain("could not choose tests");
    });
});
