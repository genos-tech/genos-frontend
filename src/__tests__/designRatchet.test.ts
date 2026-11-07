// @vitest-environment node
/**
 * MIP-1137: the design ratchet.
 *
 * Two halves. The first runs the real guard: the old design patterns outside
 * src/theme (literal colors, isDark branching, gradients, the numeric brand
 * scale, heavy weights, blur, @mui/material) may only fall, per area, against
 * `scripts/design-ratchet-baseline.json`. The second pins the counting itself on
 * small fixtures (comment stripping, every metric's regex, the areas, the update
 * rules, and the failure message), because a ratchet that miscounts either blocks
 * honest work or lets the patterns back in.
 *
 * If the guard fails for you: see the message (it names the area, the metric, the
 * old and new count and the biggest files) and genos-docs/design/DESIGN_SYSTEM.md,
 * section Guardrails.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { findFilesystemTests } from "../../scripts/ci-test-selection.mjs";
import {
    areaOf,
    changedFiles,
    countText,
    countTree,
    DEFAULT_BASELINE,
    DEFAULT_SRC,
    findRises,
    formatRises,
    listSourceFiles,
    METRIC_NAMES,
    parseBaseline,
    planUpdate,
    serializeBaseline,
    stripComments,
    totalsByMetric,
} from "../../scripts/design-ratchet.mjs";

// Not `new URL(…, import.meta.url)`: Vite rewrites that form as an asset import.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT = path.join(repoRoot, "scripts", "design-ratchet.mjs");

describe("the guard: old design patterns may only decrease", () => {
    const baselineText = () => fs.readFileSync(DEFAULT_BASELINE, "utf8");

    it("no area has more of any pattern than the baseline allows", () => {
        // Reads every counted source file once (about half a second on a laptop).
        const { counts, files } = countTree(DEFAULT_SRC);
        const rises = findRises(counts, parseBaseline(baselineText()));
        if (rises.length > 0) expect.fail(formatRises(rises, files, { changed: changedFiles() }));
    });

    it("the baseline file is canonical (sorted, one entry per line, no zeros)", () => {
        // A hand-merged baseline must still be the exact output of the script, so
        // two sweep PRs touching neighbouring lines cannot leave it malformed.
        expect(
            serializeBaseline(parseBaseline(baselineText())),
            "run `npm run ratchet:update` to rewrite the baseline in canonical form"
        ).toBe(baselineText());
    });

    it("this test is always run by CI's selective test run (it reads files)", () => {
        // scripts/ci-test-selection.mjs only runs tests it cannot find by imports when
        // they read files themselves. If this stopped matching, a sweep PR would skip it.
        expect(findFilesystemTests(repoRoot)).toContain("src/__tests__/designRatchet.test.ts");
    });

    it("counts only what it should: no tests, theme, marketing pages, locales or gallery", () => {
        const listed = listSourceFiles(DEFAULT_SRC);
        expect(listed.length).toBeGreaterThan(500);
        for (const rel of listed) {
            expect(rel).not.toMatch(
                /^(?:__tests__|theme|lp|i18n\/locales|features\/designSystem)\/|\.test\.|\.spec\.|\.d\.ts$/
            );
        }
        expect(listed).toContain("App.tsx");
    });
});

describe("stripComments", () => {
    const strip = (code: string, css = false) => stripComments(code, { css });

    it("removes line and block comments", () => {
        const out = strip(
            "const a = 1; // #fff\n/* rgba(0,0,0,0.5)\n  isDark ? */ const b = 2;\n"
        );
        expect(out).not.toMatch(/#fff|rgba|isDark/);
        expect(out).toContain("const a = 1;");
        expect(out).toContain("const b = 2;");
    });

    it("removes JSX comments but keeps JSX attributes", () => {
        const out = strip('<Box>{/* linear-gradient(#fff) */}<i color="#abc" /></Box>');
        expect(out).not.toContain("gradient");
        expect(out).toContain('color="#abc"');
    });

    it("does not treat // inside strings as a comment (URLs, protocol-relative)", () => {
        const out = strip(
            `const u = "http://a.b/#fff"; const v = 'https://c.d'; // #000\nconst w = "x";`
        );
        expect(out).toContain('"http://a.b/#fff"');
        expect(out).toContain("'https://c.d'");
        expect(out).not.toContain("#000");
        expect(out).toContain('const w = "x";');
    });

    it("does not treat /* inside strings as a comment", () => {
        const out = strip(`const glob = "src/*/x.ts"; const c = "#fff"; /* #000 */`);
        expect(out).toContain('"src/*/x.ts"');
        expect(out).toContain('"#fff"');
        expect(out).not.toContain("#000");
    });

    it("handles escaped quotes inside strings", () => {
        const out = strip(`const s = "a \\" // #fff"; // #000\nconst t = 1;`);
        expect(out).toContain('// #fff"');
        expect(out).not.toContain("#000");
        expect(out).toContain("const t = 1;");
    });

    it("keeps template literal text, including // and /*, and strips code comments in ${}", () => {
        const out = strip("const a = `url(http://x) /* #fff */ ${/* #111 */ x} // #222`; // #333");
        expect(out).toContain("`url(http://x) /* #fff */");
        expect(out).toContain("// #222`");
        expect(out).not.toContain("#111");
        expect(out).not.toContain("#333");
    });

    it("follows nested templates and braces inside ${}", () => {
        const out = strip(
            "const a = `a ${`b // c ${ {k: 1}.k }`} d // keep`; // #drop\nconst z = 1;"
        );
        expect(out).toContain("// keep`");
        expect(out).not.toContain("#drop");
        expect(out).toContain("const z = 1;");
    });

    it("does not let a regex literal with quotes or slashes derail the scan", () => {
        const quotes = strip(`const r = /["']/g; // #abc\nconst k = 1;`);
        expect(quotes).toContain(`/["']/g`);
        expect(quotes).not.toContain("#abc");
        const slashes = strip(`const r = /^https?:\\/\\//; // #abc\nconst k = 1;`);
        expect(slashes).toContain("const k = 1;");
        expect(slashes).not.toContain("#abc");
        const afterReturn = strip(`function f(s) { return /["'\\/]/.test(s); } // #abc`);
        expect(afterReturn).not.toContain("#abc");
        const inClass = strip(`const r = /[/*]/; /* #abc */ const k = 1;`);
        expect(inClass).toContain("/[/*]/");
        expect(inClass).not.toContain("#abc");
    });

    it("reads division as division", () => {
        const out = strip("const a = (x + 1) / 2; // #abc\nconst b = y / z; /* #def */");
        expect(out).not.toMatch(/#abc|#def/);
        expect(out).toContain("(x + 1) / 2;");
    });

    it("an unterminated quote (an apostrophe in JSX text) does not eat the next lines", () => {
        const out = strip("<p>Don't do it</p>\n// #abc\nconst c = '#fff';\n");
        expect(out).not.toContain("#abc");
        expect(out).toContain("'#fff'");
    });

    it("tolerates CRLF line endings and a BOM", () => {
        const out = strip("﻿const a = 1; // #fff\r\nconst b = '#000';\r\n");
        expect(out).not.toContain("#fff");
        expect(out).toContain("'#000'");
        expect(out.charCodeAt(0)).not.toBe(0xfeff);
    });

    it("css mode: only /* */ comments; // is not a comment and urls survive", () => {
        const out = strip(
            "a { color: #fff; /* #000 */ background: url(//cdn.x/y.png); b: 'x // y'; }",
            true
        );
        expect(out).toContain("#fff");
        expect(out).not.toContain("#000");
        expect(out).toContain("url(//cdn.x/y.png)");
        expect(out).toContain("'x // y'");
    });

    it("never throws on unterminated comments or templates", () => {
        expect(() => strip("const a = 1; /* never closed #fff")).not.toThrow();
        expect(() => strip("const a = `never closed ${ x")).not.toThrow();
        expect(strip("/* never closed #fff")).not.toContain("#fff");
    });
});

describe("the metrics (each regex, with its false positives)", () => {
    const count = (metric: string, code: string, css = false) =>
        (countText(code, { css }) as Record<string, number>)[metric];

    const cases: Array<[string, string, number]> = [
        // literalColors: hex 3/4/6/8 and rgb(a) with a digit; nothing else.
        ["literalColors", 'color: "#fff"', 1],
        ["literalColors", 'color: "#FFFa"', 1],
        ["literalColors", 'color: "#a1b2c3"', 1],
        ["literalColors", 'color: "#a1b2c3d4"', 1],
        ["literalColors", "a: '#fff', b: '#000000', c: '#0008'", 3],
        ["literalColors", 'color: "#12345"', 0], // 5 digits is not a color
        ["literalColors", 'color: "#1234567"', 0], // neither is 7
        ["literalColors", 'color: "#ab"', 0],
        ["literalColors", "const x = '&#039;'", 0], // HTML entity
        ["literalColors", 'href="route#cafe"', 0], // a fragment on a word
        ["literalColors", 'fill="url(#abc)"', 0], // SVG reference
        ["literalColors", "const id = '#fff-wrapper'", 0], // a selector, not a color
        ["literalColors", "background: rgba(0, 0, 0, 0.5)", 1],
        ["literalColors", "background: rgb(12 34 56 / 50%)", 1],
        ["literalColors", "background: rgba(0,0,0,.2)", 1],
        ["literalColors", "background: rgba(var(--g-shadow-rgb), 0.2)", 0], // a variable: allowed
        ["literalColors", "background: rgba(${r}, ${g}, ${b}, 1)", 0], // computed
        ["literalColors", "const rgbaFn = rgba(color)", 0],
        ["literalColors", "/* #fff */ // rgba(0,0,0,1)\nconst a = 1", 0], // comments never count
        ["literalColors", "x: `#fff ${a} rgba(1,2,3,1)`", 2], // template text does
        // isDarkTernaries
        ["isDarkTernaries", 'c: isDark ? "#fff" : "#000"', 1],
        ["isDarkTernaries", 'c: !isDark ? "a" : "b"', 1],
        ["isDarkTernaries", "c: isDark\n    ? a\n    : b", 1], // prettier's broken form
        ["isDarkTernaries", 'a: isDark ? "x" : "y", b: isDark ? 1 : 2', 2],
        ["isDarkTernaries", 'if (theme.palette.mode === "dark") x = isDark ? 1 : 2', 1],
        ["isDarkTernaries", 'const c = mode === "dark" ? a : b', 1],
        ["isDarkTernaries", "const c = mode !== 'light' ? a : b", 1],
        ["isDarkTernaries", 'const c = mode === "system" ? a : b', 0],
        ["isDarkTernaries", "interface P { isDark?: boolean }", 0],
        ["isDarkTernaries", "const v = props.isDark ?? false", 0],
        ["isDarkTernaries", "const v = theme?.isDark?.value", 0],
        ["isDarkTernaries", "const v = isDark?.x", 0],
        ["isDarkTernaries", "const v = isDark && 1", 0],
        ["isDarkTernaries", "const v = isDarkMode ? 1 : 2", 0], // other names: not counted
        ["isDarkTernaries", "// isDark ? a : b\nconst a = 1", 0],
        // gradients
        ["gradients", "background: linear-gradient(90deg, a, b)", 1],
        ["gradients", "background: radial-gradient(circle, a, b)", 1],
        ["gradients", "background: conic-gradient(a, b)", 1],
        ["gradients", "background: repeating-linear-gradient(a, b)", 1],
        ["gradients", "a: `linear-gradient(a,b), radial-gradient(c,d)`", 2],
        ["gradients", "background: var(--g-gradient-primary)", 0], // the token is the goal
        ["gradients", "const gradientColor = 1", 0],
        ["gradients", "/* linear-gradient(a, b) */", 0],
        // brandVars
        ["brandVars", "color: var(--gp-brand-700)", 1],
        ["brandVars", "color: var(--gp-brandalt-50, #fff)", 1],
        ["brandVars", "a: 'var(--gp-brand-100)', b: 'var(--gp-brand-900)'", 2],
        ["brandVars", "--gp-brand-500: red", 1], // a declaration outside the theme counts too
        ["brandVars", "color: var(--gp-brand-alpha)", 0],
        ["brandVars", "color: var(--g-accent)", 0],
        ["brandVars", "color: var(--gp-text-700)", 0],
        // heavyFontWeights
        ["heavyFontWeights", "fontWeight: 700", 1],
        ["heavyFontWeights", 'fontWeight: "700"', 1],
        ["heavyFontWeights", 'fontWeight: "bold"', 1],
        ["heavyFontWeights", 'fontWeight="bold"', 1],
        ["heavyFontWeights", "fontWeight={700}", 1],
        ["heavyFontWeights", "fontWeight: 800", 1],
        ["heavyFontWeights", "fontWeight: 900", 1],
        ["heavyFontWeights", "font-weight: 700;", 1],
        ["heavyFontWeights", "font-weight: bold;", 1],
        ["heavyFontWeights", "fontWeight: isActive ? 700 : 500", 1],
        ["heavyFontWeights", "fontWeight: isActive\n  ? 700\n  : 500,", 1],
        ["heavyFontWeights", "fontWeight: on ? 600 : 400, color: 700", 0], // 700 is not a weight here
        ["heavyFontWeights", "fontWeight: 400", 0],
        ["heavyFontWeights", "fontWeight: 500", 0],
        ["heavyFontWeights", "fontWeight: 600", 0],
        ["heavyFontWeights", "fontWeight: 1700", 0],
        ["heavyFontWeights", "fontWeight: isBold ? 600 : 400", 0],
        ["heavyFontWeights", "const w = 700", 0], // not a font weight property
        ["heavyFontWeights", "fontWeight: 600 }, zIndex: 700", 0],
        ["heavyFontWeights", "// fontWeight: 700\nconst a = 1", 0],
        // backdropFilter
        ["backdropFilter", 'backdropFilter: "blur(8px)"', 1],
        ["backdropFilter", "backdrop-filter: blur(8px);", 1],
        ["backdropFilter", 'WebkitBackdropFilter: "blur(8px)"', 0], // the twin never counts alone...
        ["backdropFilter", 'backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)"', 1], // ...nor twice
        ["backdropFilter", "backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);", 1],
        ["backdropFilter", "// backdropFilter: blur(8px)\nconst a = 1", 0],
        // muiMaterial
        ["muiMaterial", 'import { Box } from "@mui/material";', 1],
        ["muiMaterial", "import Box from '@mui/material/Box';", 1],
        ["muiMaterial", 'const m = await import("@mui/material/Button");', 1],
        ["muiMaterial", 'import { X } from "@mui/icons-material";', 0],
        ["muiMaterial", 'import { X } from "@mui/icons-material/Add";', 0],
        ["muiMaterial", 'import { X } from "@mui/joy";', 0],
        ["muiMaterial", 'import { X } from "@mui/material-nextjs";', 0],
        ["muiMaterial", '// import { Box } from "@mui/material";\nconst a = 1;', 0],
    ];

    it.each(cases)("%s: %j -> %i", (metric, code, expected) => {
        expect(count(metric, code)).toBe(expected);
    });

    it("counts in css files too, and ignores css comments", () => {
        const css = "a { color: #fff; background: linear-gradient(a, b); } /* #000 */";
        expect(count("literalColors", css, true)).toBe(1);
        expect(count("gradients", css, true)).toBe(1);
    });

    it("has exactly the metrics the baseline and the docs name", () => {
        expect(METRIC_NAMES).toEqual([
            "literalColors",
            "isDarkTernaries",
            "gradients",
            "brandVars",
            "heavyFontWeights",
            "backdropFilter",
            "muiMaterial",
        ]);
    });
});

describe("areaOf", () => {
    it.each([
        ["features/chat/components/Foo.tsx", "features/chat"],
        ["features/tasks/diagram/utils/x.ts", "features/tasks"],
        ["components/ui/Button.tsx", "components/ui"],
        ["components/editors/sub/styles.css", "components/editors"],
        ["components/FeatureErrorBoundary.tsx", "other"],
        ["features/loose.ts", "other"],
        ["App.tsx", "other"],
        ["hooks/common/useX.ts", "other"],
        ["services/api.ts", "other"],
        ["index.css", "other"],
    ])("%s -> %s", (rel, area) => {
        expect(areaOf(rel)).toBe(area);
    });

    it.each([
        "__tests__/Foo.test.tsx",
        "theme/tokens/roles.ts",
        "theme/themePalettes.ts",
        "features/designSystem/Gallery.tsx",
        "lp/Landing.tsx",
        "i18n/locales/en.ts",
        "features/chat/Foo.test.tsx",
        "features/chat/Foo.spec.ts",
        "features/chat/__tests__/Foo.tsx",
        "features/chat/__mocks__/Foo.tsx",
        "vite-env.d.ts",
        "assets/logo.png",
        "features/chat/data.json",
        "features/chat/README.md",
    ])("%s is not counted", (rel) => {
        expect(areaOf(rel)).toBeNull();
    });

    it("still counts i18n code that is not a locale file", () => {
        expect(areaOf("i18n/index.ts")).toBe("other");
    });
});

describe("the update rules and the failure message", () => {
    it("serializes sorted, one entry per line, zeros omitted, with a trailing newline", () => {
        const text = serializeBaseline({
            "features/tasks:gradients": 2,
            "components/ui:literalColors": 5,
            "features/chat:gradients": 0,
            "Z:gradients": 1,
        });
        expect(text).toBe(
            [
                "{",
                '    "Z:gradients": 1,',
                '    "components/ui:literalColors": 5,',
                '    "features/tasks:gradients": 2',
                "}",
                "",
            ].join("\n")
        );
        expect(parseBaseline(text)).toEqual({
            "Z:gradients": 1,
            "components/ui:literalColors": 5,
            "features/tasks:gradients": 2,
        });
    });

    it("rejects a malformed baseline instead of letting everything pass", () => {
        expect(() => parseBaseline('{"features/chat:gradients": "3"}')).toThrow(/bad entry/);
        expect(() => parseBaseline('{"features/chat:gradients": -1}')).toThrow(/bad entry/);
        expect(() => parseBaseline('{"nonsense": 1}')).toThrow(/bad entry/);
        expect(() => parseBaseline("not json")).toThrow();
    });

    it("a count above the baseline is a rise; equal and below are not; a new key counts from 0", () => {
        const baseline = { "a:gradients": 3, "b:gradients": 3, "c:gradients": 3 };
        const counts = { "a:gradients": 4, "b:gradients": 3, "c:gradients": 1, "d:brandVars": 1 };
        expect(findRises(counts, baseline)).toEqual([
            { key: "a:gradients", was: 3, now: 4 },
            { key: "d:brandVars", was: 0, now: 1 },
        ]);
        expect(findRises({}, baseline)).toEqual([]);
    });

    it("the message names area, metric, old -> new, top files, and how to fix", () => {
        const message = formatRises(
            [{ key: "features/chat:literalColors", was: 10, now: 12 }],
            {
                "features/chat:literalColors": [
                    ["src/features/chat/A.tsx", 7],
                    ["src/features/chat/B.tsx", 3],
                    ["src/features/chat/C.tsx", 1],
                    ["src/features/chat/D.tsx", 1],
                ],
            },
            { topFiles: 2 }
        );
        expect(message).toContain("features/chat");
        expect(message).toContain("literalColors: 10 -> 12");
        expect(message).toContain("7x src/features/chat/A.tsx");
        expect(message).toContain("3x src/features/chat/B.tsx");
        expect(message).not.toContain("C.tsx");
        expect(message).toContain("2 more files");
        expect(message).toMatch(/fix: .*tokens/);
        expect(message).toContain("npm run ratchet:update");
        expect(message).toContain("--allow-raise");
        expect(message).toContain("DESIGN_SYSTEM.md");
    });

    it("points at the files changed on the branch even when they are not the biggest", () => {
        const message = formatRises(
            [{ key: "features/chat:literalColors", was: 10, now: 11 }],
            {
                "features/chat:literalColors": [
                    ["src/features/chat/Big.tsx", 9],
                    ["src/features/chat/Small.tsx", 1],
                ],
            },
            { topFiles: 1, changed: new Set(["src/features/chat/Small.tsx"]) }
        );
        expect(message).toContain("in files you changed:\n      1x src/features/chat/Small.tsx");
        expect(message).toContain("9x src/features/chat/Big.tsx");
    });

    it("changedFiles reads the working tree and the branch from git, and survives no git", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "design-ratchet-git-"));
        try {
            expect(changedFiles(dir).size).toBe(0); // not a repository: no names, no throw
            const git = (...args: string[]) =>
                execFileSync(
                    "git",
                    [
                        ...["-c", "user.email=t@t", "-c", "user.name=t"],
                        // a developer's global config must not make this prompt or hang
                        ...["-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null"],
                        ...args,
                    ],
                    {
                        cwd: dir,
                        stdio: "ignore",
                    }
                );
            git("init", "-q");
            fs.mkdirSync(path.join(dir, "src"));
            fs.writeFileSync(path.join(dir, "src", "kept.ts"), "a\n");
            fs.writeFileSync(path.join(dir, "src", "edited.ts"), "a\n");
            git("add", ".");
            git("commit", "-q", "-m", "base");
            fs.writeFileSync(path.join(dir, "src", "edited.ts"), "b\n");
            fs.writeFileSync(path.join(dir, "src", "new.ts"), "c\n");
            expect([...changedFiles(dir)].sort()).toEqual(["src/edited.ts", "src/new.ts"]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it("planUpdate refuses a rise unless allowRaise, and counts lowered entries", () => {
        const baseline = { "a:gradients": 3, "b:gradients": 3 };
        const refused = planUpdate({ counts: { "a:gradients": 4, "b:gradients": 1 }, baseline });
        expect(refused.ok).toBe(false);
        expect(refused.rises).toHaveLength(1);
        expect(refused.lowered).toBe(1);
        const allowed = planUpdate({
            counts: { "a:gradients": 4, "b:gradients": 1 },
            baseline,
            allowRaise: true,
        });
        expect(allowed.ok).toBe(true);
        expect(allowed.text).toBe(serializeBaseline({ "a:gradients": 4, "b:gradients": 1 }));
        const lower = planUpdate({ counts: { "a:gradients": 2 }, baseline });
        expect(lower.ok).toBe(true);
        expect(lower.lowered).toBe(2); // b went to zero (absent), a went down
    });

    it("totalsByMetric sums over areas", () => {
        const totals = totalsByMetric({ "a/b:gradients": 2, "c:gradients": 3, "c:brandVars": 1 });
        expect(totals.gradients).toBe(5);
        expect(totals.brandVars).toBe(1);
        expect(totals.literalColors).toBe(0);
    });
});

describe("end to end on a scratch tree (the mutation checks, automated)", () => {
    const dirs: string[] = [];
    afterEach(() => {
        for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
    });

    /** A scratch `src/` with two areas and a baseline written by the real script. */
    function scratch() {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "design-ratchet-"));
        dirs.push(dir);
        const src = path.join(dir, "src");
        const baseline = path.join(dir, "baseline.json");
        const write = (rel: string, text: string) => {
            fs.mkdirSync(path.dirname(path.join(src, rel)), { recursive: true });
            fs.writeFileSync(path.join(src, rel), text);
        };
        write("features/chat/Clean.tsx", "export const a = 1;\n");
        write("features/chat/Old.tsx", 'export const c = "#fff"; // #000 in a comment\n');
        write("components/ui/Button.tsx", "export const b = 2;\n");
        write("theme/tokens.ts", 'export const t = "#123456"; // theme may hold literals\n');
        write("__tests__/Fixture.test.ts", 'const x = "#abcdef";\n');
        const run = (...args: string[]) => {
            try {
                const stdout = execFileSync(
                    process.execPath,
                    [SCRIPT, "--src", src, "--baseline", baseline, ...args],
                    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
                );
                return { code: 0, stdout };
            } catch (error) {
                const e = error as { status: number; stdout: string };
                return { code: e.status, stdout: e.stdout };
            }
        };
        return { src, baseline, write, run };
    }

    const base = (s: ReturnType<typeof scratch>) => {
        expect(s.run("--allow-raise").code).toBe(0);
        return parseBaseline(fs.readFileSync(s.baseline, "utf8"));
    };

    it("the first baseline counts only counted files, comments stripped", () => {
        const s = scratch();
        expect(base(s)).toEqual({ "features/chat:literalColors": 1 });
    });

    const mutations: Array<[string, string, string]> = [
        ["a hex literal", 'export const x = "#ff00aa";', "literalColors"],
        ["an rgba literal", 'export const x = "rgba(0, 0, 0, 0.5)";', "literalColors"],
        ["an isDark ternary", 'export const x = isDark ? "a" : "b";', "isDarkTernaries"],
        ["a gradient", 'export const x = "linear-gradient(90deg, a, b)";', "gradients"],
        ["a brand var", 'export const x = "var(--gp-brand-700)";', "brandVars"],
        ["a heavy weight", "export const x = { fontWeight: 700 };", "heavyFontWeights"],
        ["a backdrop blur", 'export const x = { backdropFilter: "blur(4px)" };', "backdropFilter"],
        ["an @mui/material import", 'import { Box } from "@mui/material";', "muiMaterial"],
    ];

    it.each(mutations)("adding %s fails with a useful message", (_name, code, metric) => {
        const s = scratch();
        base(s);
        s.write("components/ui/Button.tsx", `${code}\n`);
        const rises = findRises(
            countTree(s.src).counts,
            parseBaseline(fs.readFileSync(s.baseline, "utf8"))
        );
        expect(rises).toEqual([{ key: `components/ui:${metric}`, was: 0, now: 1 }]);
        const { files } = countTree(s.src);
        const message = formatRises(rises, files);
        expect(message).toContain(`components/ui  ${metric}: 0 -> 1`);
        expect(message).toContain("src/components/ui/Button.tsx");
    });

    it("the update script refuses to raise, names the file, and leaves the baseline alone", () => {
        const s = scratch();
        base(s);
        const before = fs.readFileSync(s.baseline, "utf8");
        s.write("components/ui/Button.tsx", 'export const x = "#ff00aa";\n');
        const result = s.run();
        expect(result.code).toBe(1);
        expect(result.stdout).toContain("components/ui  literalColors: 0 -> 1");
        expect(result.stdout).toContain("src/components/ui/Button.tsx");
        expect(result.stdout).toContain("NOT written");
        expect(fs.readFileSync(s.baseline, "utf8")).toBe(before);
    });

    it("--allow-raise raises on purpose", () => {
        const s = scratch();
        base(s);
        s.write("components/ui/Button.tsx", 'export const x = "#ff00aa";\n');
        expect(s.run("--allow-raise").code).toBe(0);
        expect(parseBaseline(fs.readFileSync(s.baseline, "utf8"))).toEqual({
            "components/ui:literalColors": 1,
            "features/chat:literalColors": 1,
        });
    });

    it("a decrease passes the guard and the script writes the lower number", () => {
        const s = scratch();
        base(s);
        s.write("features/chat/Old.tsx", "export const c = 1;\n");
        const counts = countTree(s.src).counts;
        const baseline = parseBaseline(fs.readFileSync(s.baseline, "utf8"));
        expect(findRises(counts, baseline)).toEqual([]);
        const result = s.run();
        expect(result.code).toBe(0);
        expect(result.stdout).toContain("1 lowered");
        expect(parseBaseline(fs.readFileSync(s.baseline, "utf8"))).toEqual({});
    });

    it("moving a literal into another area is a rise there (needs --allow-raise)", () => {
        const s = scratch();
        base(s);
        s.write("features/chat/Old.tsx", "export const c = 1;\n");
        s.write("features/tasks/Old.tsx", 'export const c = "#fff";\n');
        expect(s.run().code).toBe(1);
    });

    it("a new area starts at zero", () => {
        const s = scratch();
        base(s);
        s.write("features/newthing/X.tsx", "export const c = isDark ? 1 : 2;\n");
        const rises = findRises(
            countTree(s.src).counts,
            parseBaseline(fs.readFileSync(s.baseline, "utf8"))
        );
        expect(rises).toEqual([{ key: "features/newthing:isDarkTernaries", was: 0, now: 1 }]);
    });

    it("--report prints totals and writes nothing", () => {
        const s = scratch();
        const result = s.run("--report");
        expect(result.code).toBe(0);
        expect(result.stdout).toMatch(/literalColors\s+1\b/);
        expect(fs.existsSync(s.baseline)).toBe(false);
    });
});
