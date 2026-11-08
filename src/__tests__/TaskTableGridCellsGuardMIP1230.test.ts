// @vitest-environment node
/**
 * MIP-1230: no button in the task table that the roving tabindex does not know.
 *
 * The table has one tab stop; `useGridNav` finds cells by `data-grid-col`. A button
 * added to a row or the header WITHOUT that marker would be a stop of its own again
 * (hundreds of them, one per row), and the keyboard model would not reach it. This
 * parses the files that render the grid and fails on an interactive element that is
 * not covered by one of:
 *   - a `data-grid-col` marker on the element itself (the gutter's buttons);
 *   - a marked ancestor (a header cell's sort button; the body's column cell);
 *   - being rendered by `renderCellContent` / `renderCustomFieldCell`, whose output
 *     goes into the marked column cell of the row;
 *   - ALLOWED below, with its reason.
 *
 * Fix a failure by giving the cell its marker, not by allowlisting.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "..");
const TABLE = "features/tasks/components/table";

/** Elements that are, or render, a focusable control. */
const INTERACTIVE = new Set([
    "Clickable",
    "CellButton",
    "IconButton",
    "PlainButton",
    "Button",
    "button",
    "a",
]);

/** Functions whose JSX is rendered inside a column cell that carries the marker. */
const CELL_RENDERERS = new Set(["renderCellContent", "renderCustomFieldCell"]);

/** file -> why its controls are not grid cells. */
const ALLOWED: Record<string, string> = {
    [`${TABLE}/QuickAddTaskRow.tsx`]:
        "the inline create row is a transient form (always-editable inputs and a Create button), not a place to arrow through: Tab walks its fields, Escape closes it",
};

const SCANNED = [`${TABLE}/DraggableTaskRow.tsx`, `${TABLE}/DraggableTaskTable.tsx`];

const tagName = (node: ts.JsxOpeningLikeElement) => node.tagName.getText();

const hasMarker = (node: ts.JsxOpeningLikeElement) =>
    node.attributes.properties.some(
        (p) =>
            (ts.isJsxAttribute(p) && p.name.getText() === "data-grid-col") ||
            (ts.isJsxSpreadAttribute(p) && p.getText().includes("GRID_COL_ATTR"))
    );

const openingOf = (node: ts.Node): ts.JsxOpeningLikeElement | null => {
    if (ts.isJsxSelfClosingElement(node)) return node;
    if (ts.isJsxElement(node)) return node.openingElement;
    return null;
};

/** Interactive elements in `source` that the grid does not cover. */
export const uncoveredControls = (source: string): string[] => {
    const file = ts.createSourceFile(
        "x.tsx",
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
    );
    const found: string[] = [];

    const covered = (node: ts.Node): boolean => {
        for (let cur: ts.Node | undefined = node; cur; cur = cur.parent) {
            const opening = openingOf(cur);
            if (opening && hasMarker(opening)) return true;
            if (
                ts.isVariableDeclaration(cur) &&
                ts.isIdentifier(cur.name) &&
                CELL_RENDERERS.has(cur.name.text)
            ) {
                return true;
            }
        }
        return false;
    };

    const visit = (node: ts.Node) => {
        const opening = openingOf(node);
        if (opening && INTERACTIVE.has(tagName(opening)) && !covered(node)) {
            const { line } = file.getLineAndCharacterOfPosition(opening.getStart());
            found.push(`<${tagName(opening)}> at line ${line + 1}`);
        }
        ts.forEachChild(node, visit);
    };
    visit(file);
    return found;
};

describe("the scanner itself", () => {
    const wrap = (jsx: string, fn = "Row") => `const ${fn} = () => { return (${jsx}); };`;

    it("flags a bare control", () => {
        expect(uncoveredControls(wrap("<IconButton>x</IconButton>"))).toHaveLength(1);
        expect(uncoveredControls(wrap("<div><PlainButton /></div>"))).toHaveLength(1);
        expect(uncoveredControls(wrap("<button>x</button>"))).toHaveLength(1);
    });

    it("accepts a marked control, a marked ancestor and a cell renderer", () => {
        expect(
            uncoveredControls(wrap('<IconButton {...{ [GRID_COL_ATTR]: "__add" }}>x</IconButton>'))
        ).toEqual([]);
        expect(uncoveredControls(wrap('<IconButton data-grid-col="x">x</IconButton>'))).toEqual(
            []
        );
        expect(
            uncoveredControls(wrap("<div {...{ [GRID_COL_ATTR]: c.field }}><PlainButton /></div>"))
        ).toEqual([]);
        expect(uncoveredControls(wrap("<Clickable>x</Clickable>", "renderCellContent"))).toEqual(
            []
        );
    });
});

describe("the task table's controls are grid cells", () => {
    for (const rel of SCANNED) {
        it(`${rel}: every button is in a marked cell`, () => {
            const source = fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
            expect(uncoveredControls(source), `unmarked controls in ${rel}`).toEqual([]);
        });
    }

    it("the cell wrappers carry the ARIA roles and the marker", () => {
        const row = fs.readFileSync(path.join(SRC_ROOT, `${TABLE}/DraggableTaskRow.tsx`), "utf8");
        const table = fs.readFileSync(
            path.join(SRC_ROOT, `${TABLE}/DraggableTaskTable.tsx`),
            "utf8"
        );
        expect(row).toContain('role="row"');
        expect(row).toContain('role="gridcell"');
        expect(row).toContain("[GRID_COL_ATTR]: column.field");
        expect(row).toContain("[GRID_ROW_ATTR]: taskIdStr");
        expect(table).toContain('role="treegrid"');
        expect(table).toContain('role="columnheader"');
        expect(table).toContain('role="rowgroup"');
        expect(table).toContain("ref={gridRef}");
        expect(table).toContain("<GridNavContext.Provider");
    });

    it("the drag handle is a grid cell, not a stop of its own", () => {
        const row = fs.readFileSync(path.join(SRC_ROOT, `${TABLE}/DraggableTaskRow.tsx`), "utf8");
        // The library hands the handle tabIndex 0; the row overrides it.
        const handle = row.match(/<div\s[^>]*?dragHandleProps[\s\S]*?>/)?.[0] ?? "";
        expect(handle).toContain('[GRID_COL_ATTR]: "__drag"');
        expect(handle).toContain("tabIndex={-1}");
    });

    it("avatars inside the editable cells are not buttons of their own", () => {
        const row = fs.readFileSync(path.join(SRC_ROOT, `${TABLE}/DraggableTaskRow.tsx`), "utf8");
        const avatars = row.match(/<UserAvatar\s[\s\S]*?\/>/g) ?? [];
        expect(avatars.length).toBeGreaterThanOrEqual(2);
        for (const avatar of avatars) expect(avatar).toContain("clickable={false}");
    });

    it("every allowlisted file still exists and is explained", () => {
        for (const [rel, reason] of Object.entries(ALLOWED)) {
            expect(fs.existsSync(path.join(SRC_ROOT, rel)), rel).toBe(true);
            expect(reason.length).toBeGreaterThan(20);
        }
    });
});
