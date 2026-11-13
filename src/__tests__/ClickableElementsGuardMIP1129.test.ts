// @vitest-environment node
/**
 * MIP-1129: no clickable Box / div / span left.
 *
 * About fifty `Box onClick` (and the same on div / span / Stack / Sheet /
 * Typography / img) were mouse-only: no name for a screen reader, no Tab stop, no
 * Enter / Space. This parses every .tsx under `src` and fails on a layout element
 * that has an `onClick` and is none of:
 *   - a real control: `component="button"` / `a` / `label` ..., or the native tag;
 *   - keyboard-complete by hand: `role` + `tabIndex` + `onKeyDown` on the element
 *     (rows that hold other buttons cannot be a `<button>`);
 *   - conditionally a button (`component={cond ? "button" : ...}` with an
 *     `onClick` that is `undefined` on the other branch);
 *   - an event boundary whose whole handler is `stopPropagation()` /
 *     `preventDefault()`;
 *   - listed in ALLOWED below, each with its reason.
 *
 * Fix a failure with `PlainButton` (a tile, row or thumbnail), `Clickable` (a
 * region that holds links, menus or inputs, or an inline run), or an `IconButton` /
 * `Button`. Joy `Chip` with `onClick` is not covered: it renders its own button.
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "..");

/** Layout elements that carry no semantics of their own. */
const LAYOUT_TAGS = new Set([
    "Box",
    "div",
    "span",
    "Stack",
    "Sheet",
    "Typography",
    "Card",
    "CardContent",
    "li",
    "ul",
    "section",
    "header",
    "footer",
    "nav",
    "aside",
    "article",
    "p",
    "img",
    "svg",
    "td",
    "tr",
    "th",
    "h1",
    "h2",
    "h3",
    "h4",
    "ListItem",
    "ListItemContent",
    "AspectRatio",
    "FormControl",
]);

const NATIVE_CONTROLS = /^(button|a|label|summary|input|select|textarea)$/;

/** file (relative to src) -> how many such elements are allowed, and why. */
const ALLOWED: Record<string, { count: number; reason: string }> = {
    "components/ui/Clickable.tsx": {
        count: 1,
        reason: "the shared implementation itself: it adds role, tabIndex and the key handler",
    },
    "components/ui/bubble/Bubble.tsx": {
        count: 3,
        reason: "event boundaries (`onClick={stop}`) that keep a click inside the bubble's own menus from opening the message",
    },
    "components/ui/nav/NavItem.tsx": {
        count: 1,
        reason: "aria-hidden chevron, a mouse shortcut: the row's own keydown handler expands with ArrowRight / ArrowLeft",
    },
    "components/ui/feedback/TabStrip.tsx": {
        count: 1,
        reason: "aria-hidden close x, a pointer/touch shortcut: a tablist may own only tabs (MIP-1173), so the keyboard path is Delete on the tab and screen readers get real buttons in a hidden group",
    },
    "components/editors/Mention.tsx": {
        count: 3,
        reason: "the suggestion listbox option (focus stays in the editor, its key handler picks) and two mention chips that are inline content of the rich-text editor: a focusable chip would take the caret out of the document (the same chip in a sent message is a Clickable)",
    },
    "components/editors/HashMention.tsx": {
        count: 1,
        reason: "a #task chip inline in the rich-text editor: a focusable chip would take the caret out of the document (the same chip in a sent message is a Clickable)",
    },
    "features/calendar/components/MonthView.tsx": {
        count: 1,
        reason: "the day cell creates an event on click; it holds the event chips, so making it a button would nest buttons and add a tab stop per day (the chips are Clickables)",
    },
    "components/editors/genos/GenosNoteEditor.tsx": {
        count: 1,
        reason: "delegated click over the rendered note body (image zoom); not a control itself",
    },
    "features/genos/GenosHome.tsx": {
        count: 1,
        reason: "scrim behind the mobile drawer: taps dismiss it, the drawer has its own close control",
    },
    "features/calendar/components/TimelineView.tsx": {
        count: 1,
        reason: "day column: the click creates an event at the HOUR under the pointer (position-based); the keyboard path is the day header's New event stop (MIP-1405)",
    },
};

const collect = (dir: string, out: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (entry.name === "__tests__" || entry.name === "node_modules") continue;
            collect(path.join(dir, entry.name), out);
        } else if (/\.tsx$/.test(entry.name) && !/\.test\./.test(entry.name)) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out;
};

const text = (node: ts.Node | undefined) => (node ? node.getText() : "");

/** `onClick={(e) => { e.stopPropagation(); }}` and nothing else. */
const isBoundaryHandler = (init: ts.JsxAttribute["initializer"]): boolean => {
    if (!init || !ts.isJsxExpression(init) || !init.expression) return false;
    const fn = init.expression;
    if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) return false;
    const body = fn.body;
    const statements = ts.isBlock(body)
        ? body.statements.map((s) => (ts.isExpressionStatement(s) ? s.expression : undefined))
        : [body];
    if (statements.length === 0 || statements.some((s) => !s)) return false;
    return statements.every(
        (s) =>
            !!s &&
            ts.isCallExpression(s) &&
            /\.(stopPropagation|preventDefault)$/.test(text(s.expression))
    );
};

/** `component={isSelf ? "button" : "div"}` together with `onClick={isSelf ? fn : undefined}`. */
const isConditionallyButton = (
    component: ts.JsxAttribute["initializer"],
    onClick: ts.JsxAttribute["initializer"]
): boolean => {
    const c = text(component);
    const o = text(onClick);
    return /\?[^:]*["']button["']|:\s*["']button["']/.test(c) && /\bundefined\b/.test(o);
};

export type Offender = { file: string; line: number; tag: string };

/** Clickable layout elements in one source file that nothing above excuses. */
export const clickableOffenders = (file: string, source: string): Offender[] => {
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const found: Offender[] = [];
    const visit = (node: ts.Node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            const tag = node.tagName.getText();
            const attrs = new Map<string, ts.JsxAttribute>();
            for (const a of node.attributes.properties) {
                if (ts.isJsxAttribute(a)) attrs.set(a.name.getText(), a);
            }
            const onClick = attrs.get("onClick");
            if (onClick && LAYOUT_TAGS.has(tag)) {
                const component = attrs.get("component");
                const effective = component
                    ? text(component.initializer).replace(/[{}"']/g, "")
                    : tag;
                const native = NATIVE_CONTROLS.test(effective);
                const keyboard =
                    attrs.has("role") && attrs.has("tabIndex") && attrs.has("onKeyDown");
                const boundary = isBoundaryHandler(onClick.initializer);
                const conditional = isConditionallyButton(
                    component?.initializer,
                    onClick.initializer
                );
                if (!native && !keyboard && !boundary && !conditional) {
                    found.push({
                        file,
                        line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
                        tag,
                    });
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return found;
};

describe("no clickable Box / div / span (MIP-1129)", () => {
    it("the rule itself: what it accepts and what it rejects", () => {
        const bad = (s: string) => clickableOffenders("x.tsx", s).length;
        expect(bad(`const A = () => <Box onClick={go}>x</Box>;`)).toBe(1);
        expect(bad(`const A = () => <div onClick={go}>x</div>;`)).toBe(1);
        expect(bad(`const A = () => <Typography onClick={go}>x</Typography>;`)).toBe(1);
        expect(bad(`const A = () => <Box component="span" onClick={go}>x</Box>;`)).toBe(1);
        // real controls
        expect(bad(`const A = () => <Box component="button" onClick={go}>x</Box>;`)).toBe(0);
        expect(bad(`const A = () => <button onClick={go}>x</button>;`)).toBe(0);
        expect(bad(`const A = () => <Chip onClick={go}>x</Chip>;`)).toBe(0);
        expect(bad(`const A = () => <PlainButton onClick={go}>x</PlainButton>;`)).toBe(0);
        expect(bad(`const A = () => <Clickable onActivate={go}>x</Clickable>;`)).toBe(0);
        // by hand: needs all three
        expect(
            bad(
                `const A = () => <Box role="button" tabIndex={0} onKeyDown={k} onClick={go}>x</Box>;`
            )
        ).toBe(0);
        expect(bad(`const A = () => <Box role="button" tabIndex={0} onClick={go}>x</Box>;`)).toBe(
            1
        );
        // event boundaries
        expect(bad(`const A = () => <Box onClick={(e) => e.stopPropagation()}>x</Box>;`)).toBe(0);
        expect(
            bad(
                `const A = () => <Box onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>x</Box>;`
            )
        ).toBe(0);
        expect(
            bad(`const A = () => <Box onClick={(e) => { e.stopPropagation(); open(); }}>x</Box>;`)
        ).toBe(1);
        // conditionally a button
        expect(
            bad(
                `const A = () => <Box component={own ? "button" : "div"} onClick={own ? edit : undefined}>x</Box>;`
            )
        ).toBe(0);
        expect(
            bad(`const A = () => <Box component={own ? "button" : "div"} onClick={edit}>x</Box>;`)
        ).toBe(1);
    });

    it("no layout element with onClick outside the allowlist", { timeout: 120_000 }, () => {
        const offenders: Offender[] = [];
        for (const file of collect(SRC_ROOT)) {
            const rel = path.relative(SRC_ROOT, file).split(path.sep).join("/");
            const found = clickableOffenders(rel, fs.readFileSync(file, "utf8"));
            const allowed = ALLOWED[rel]?.count ?? 0;
            // The allowance is a count, so a new clickable box in an allowed file still fails.
            if (found.length > allowed) offenders.push(...found.slice(allowed));
        }
        expect(offenders.map((o) => `${o.file}:${o.line} <${o.tag}>`)).toEqual([]);
    });

    it("every allowlist entry is still needed and says why", () => {
        for (const [rel, entry] of Object.entries(ALLOWED)) {
            const file = path.join(SRC_ROOT, rel);
            expect(fs.existsSync(file), rel).toBe(true);
            expect(entry.reason.length, rel).toBeGreaterThan(20);
            const found = clickableOffenders(rel, fs.readFileSync(file, "utf8"));
            expect(found.length, `${rel}: allowance no longer used, lower or remove it`).toBe(
                entry.count
            );
        }
        expect(Object.keys(ALLOWED).length).toBeLessThanOrEqual(10);
    });
});
