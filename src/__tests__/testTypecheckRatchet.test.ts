// @vitest-environment node
/**
 * MIP-1315: the test type-check ratchet (scripts/test-typecheck-ratchet.mjs).
 *
 * `tsc -b` leaves the tests out on purpose, so their type errors are counted by a
 * separate, non-blocking CI step that compares the count with a committed baseline.
 * This file pins the parts that can lie: reading tsc's output (every error line
 * counted once, continuation lines not at all), the baseline file format, what
 * counts as a rise (per file, so a fix cannot hide a new error elsewhere), and the
 * check / update rules. It does NOT run tsc (about 30 s): the CI step does.
 *
 * It also pins that the build still excludes the tests (tsconfig.app.json) and that
 * the test config is not part of `tsc -b` (tsconfig.json), because that is the
 * point of the whole design.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    compare,
    DEFAULT_BASELINE,
    GLOBAL_KEY,
    main,
    parseBaseline,
    parseTscOutput,
    REPO_ROOT,
    serializeBaseline,
    totalOf,
} from "../../scripts/test-typecheck-ratchet.mjs";

const TSC = [
    "src/__tests__/a.test.ts(10,5): error TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'.",
    "  Type 'X' is missing the following properties from type 'Y': id, name",
    "src/__tests__/a.test.ts(22,1): error TS2322: Type 'string' is not assignable to type 'number'.",
    "src/features/b.test.tsx(3,9): error TS7006: Parameter 'x' implicitly has an 'any' type.",
    "error TS6053: File 'nope.ts' not found.",
    "Found 4 errors in 2 files.",
    "",
].join("\n");

const tmp: string[] = [];
const tmpDir = () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "tt-ratchet-"));
    tmp.push(d);
    return d;
};
afterEach(() => {
    for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
    vi.restoreAllMocks();
});

describe("reading tsc's output", () => {
    it("counts each error line once, per file; continuation lines and the summary are not errors", () => {
        const counts = parseTscOutput(TSC);
        expect([...counts]).toEqual([
            [GLOBAL_KEY, 1],
            ["src/__tests__/a.test.ts", 2],
            ["src/features/b.test.tsx", 1],
        ]);
        expect(totalOf(counts)).toBe(4);
    });

    it("reads the `file:line:col - error` form too, and Windows separators", () => {
        const counts = parseTscOutput(
            "src\\x.test.ts:4:2 - error TS2304: Cannot find name 'q'.\nsrc/y.test.ts:1:1 - error TS1005: ';' expected.\n"
        );
        expect([...counts.keys()]).toEqual(["src/x.test.ts", "src/y.test.ts"]);
    });

    it("clean output is zero", () => {
        expect(totalOf(parseTscOutput(""))).toBe(0);
    });
});

describe("baseline file", () => {
    it("is flat, sorted, zeros omitted, and round-trips", () => {
        const text = serializeBaseline(
            new Map([
                ["src/z.test.ts", 2],
                ["src/a.test.ts", 5],
                ["src/gone.test.ts", 0],
            ])
        );
        expect(text).toBe('{\n    "src/a.test.ts": 5,\n    "src/z.test.ts": 2\n}\n');
        expect([...parseBaseline(text)]).toEqual([
            ["src/a.test.ts", 5],
            ["src/z.test.ts", 2],
        ]);
        expect(serializeBaseline(new Map())).toBe("{}\n");
    });

    it("rejects a malformed entry", () => {
        expect(() => parseBaseline('{"src/a.test.ts": -1}')).toThrow();
        expect(() => parseBaseline('{"src/a.test.ts": "3"}')).toThrow();
    });

    it("the committed baseline parses", () => {
        expect(() => parseBaseline(fs.readFileSync(DEFAULT_BASELINE, "utf8"))).not.toThrow();
    });
});

describe("what counts as a rise", () => {
    const base = new Map([
        ["a.test.ts", 3],
        ["b.test.ts", 2],
    ]);
    it("a fall is fine and is reported", () => {
        const d = compare(
            base,
            new Map([
                ["a.test.ts", 1],
                ["b.test.ts", 2],
            ])
        );
        expect(d.risen).toEqual([]);
        expect(d.fallen).toEqual([{ file: "a.test.ts", was: 3, now: 1 }]);
    });
    it("a fix in one file does not pay for a new error in another (per file, not only in total)", () => {
        const d = compare(
            base,
            new Map([
                ["a.test.ts", 2],
                ["b.test.ts", 3],
            ])
        );
        expect(d.now).toBe(d.was);
        expect(d.risen).toEqual([{ file: "b.test.ts", was: 2, now: 3 }]);
    });
    it("a new test file starts at 0, so its first error is a rise", () => {
        const d = compare(base, new Map([...base, ["new.test.ts", 1]]));
        expect(d.risen).toEqual([{ file: "new.test.ts", was: 0, now: 1 }]);
    });
});

describe("the check and the update (CLI, tsc output read from a file)", () => {
    const setup = (baseline: string | null, output: string) => {
        const dir = tmpDir();
        const baselinePath = path.join(dir, "baseline.json");
        if (baseline !== null) fs.writeFileSync(baselinePath, baseline);
        const out = path.join(dir, "tsc.txt");
        fs.writeFileSync(out, output);
        const log = vi.fn();
        const err = vi.fn();
        return { baselinePath, out, log, err };
    };

    it("passes at the baseline and below it, and says when the baseline can be lowered", () => {
        const t = setup(
            '{\n    "(global)": 1,\n    "src/__tests__/a.test.ts": 5,\n    "src/features/b.test.tsx": 1\n}\n',
            TSC
        );
        expect(main(["--from", t.out], t)).toBe(0);
        expect(t.log.mock.calls[0][0]).toContain("4 (baseline 7)");
        expect(t.log.mock.calls[0][0]).toContain("typecheck:tests:update");
    });

    it("fails when a count rises, naming the file", () => {
        const t = setup('{\n    "src/__tests__/a.test.ts": 1\n}\n', TSC);
        expect(main(["--from", t.out], t)).toBe(1);
        expect(t.err.mock.calls[0][0]).toContain("src/__tests__/a.test.ts: 1 -> 2");
    });

    it("update lowers the baseline, refuses to raise it, and --allow-raise raises it", () => {
        const lower = setup('{\n    "src/__tests__/a.test.ts": 9\n}\n', TSC);
        // TSC raises b.test.tsx and (global) from 0, so a plain update refuses.
        expect(main(["--update", "--from", lower.out], lower)).toBe(1);
        expect(fs.readFileSync(lower.baselinePath, "utf8")).toContain("9");

        expect(main(["--update", "--allow-raise", "--from", lower.out], lower)).toBe(0);
        expect(parseBaseline(fs.readFileSync(lower.baselinePath, "utf8"))).toEqual(
            parseTscOutput(TSC)
        );

        const fell = setup(fs.readFileSync(lower.baselinePath, "utf8"), "");
        expect(main(["--update", "--from", fell.out], fell)).toBe(0);
        expect(fs.readFileSync(fell.baselinePath, "utf8")).toBe("{}\n");
    });

    it("a tsc output that cannot be read is a failure, not '0 errors'", () => {
        const t = setup("{}\n", "");
        expect(main(["--from", path.join(path.dirname(t.out), "missing.txt")], t)).toBe(1);
        expect(t.err.mock.calls[0][0]).toContain("could not run");
    });
});

describe("the design: the build still excludes the tests", () => {
    const read = (p: string) => fs.readFileSync(path.join(REPO_ROOT, p), "utf8");
    // tsconfig is JSON with comments: read it the way tsc does.
    const jsonc = (p: string) => {
        const parsed = ts.parseConfigFileTextToJson(p, read(p));
        if (parsed.error) throw new Error(String(parsed.error.messageText));
        return parsed.config;
    };

    it("tsconfig.app.json (what `tsc -b` checks) still leaves out the tests", () => {
        expect(jsonc("tsconfig.app.json").exclude).toEqual(
            expect.arrayContaining(["src/__tests__", "src/**/*.test.ts", "src/**/*.test.tsx"])
        );
    });

    it("tsconfig.test.json includes them, and tsconfig.json does not reference it", () => {
        const test = jsonc("tsconfig.test.json");
        expect(test.extends).toBe("./tsconfig.app.json");
        expect(test.exclude).toEqual([]);
        expect(test.compilerOptions.types).toEqual(["vitest/globals", "node"]);
        expect(JSON.stringify(jsonc("tsconfig.json").references)).not.toContain("tsconfig.test");
    });
});
