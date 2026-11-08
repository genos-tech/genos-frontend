/**
 * MIP-1217: Status, Priority and Effort Level are ONE row in the task / milestone preview, in
 * that order, and one row per field on a narrow panel. Layout is jsdom-blind (the browser
 * numbers are in the PR), so this pins the structure in the source.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const block = readFileSync(
    join(SRC, "features/tasks/components/contents/base/TaskMainBlock.tsx"),
    "utf8"
);

describe("preview meta row", () => {
    const start = block.indexOf("Status, Priority and Effort Level: ONE row");
    const end = block.indexOf("Due Date — the only date field");
    const row = block.slice(start, end);

    it("holds status, then priority, then effort level, in one grid", () => {
        expect(start).toBeGreaterThan(0);
        const order = ["<ACTaskStatus", "<ACTaskPriority", "<ACTaskEffortLevel"].map((t) =>
            row.indexOf(t)
        );
        expect(order.every((i) => i > 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        // The old second row for status is gone.
        expect(block.match(/<ACTaskStatus/g)).toHaveLength(1);
    });

    it("splits by the panel's width, not the window's: three columns from 680px, one below", () => {
        expect(row).toMatch(/containerType: "inline-size"/);
        expect(row).toMatch(/gridTemplateColumns: "minmax\(0, 1fr\)"/);
        expect(row).toMatch(/@container \(min-width: \$\{isPreviewMode \? 680 : 440\}px\)/);
        expect(row).toMatch(/repeat\(\$\{isPreviewMode \? 3 : 2\}, minmax\(0, 1fr\)\)/);
    });
});
