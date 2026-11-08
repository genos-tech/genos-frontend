/**
 * CellDateInput (MIP-1129): the table row's due date, a custom date field and the
 * quick-add row's due date share one token-styled editor instead of three raw
 * `<input type="date">` with hex colors chosen by `mode`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CellDateInput } from "../features/tasks/components/table/cellEditors";

afterEach(cleanup);

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => fs.readFileSync(path.join(here, "..", rel), "utf8");

describe("CellDateInput", () => {
    it("is a named date input that reports the picked date", () => {
        const onChange = vi.fn();
        render(
            <CssVarsProvider>
                <CellDateInput ariaLabel="Due Date" value="2026-11-08" onChange={onChange} />
            </CssVarsProvider>
        );
        const input = screen.getByLabelText("Due Date") as HTMLInputElement;
        expect(input.type).toBe("date");
        expect(input.value).toBe("2026-11-08");
        fireEvent.change(input, { target: { value: "2026-12-01" } });
        expect(onChange).toHaveBeenCalledWith("2026-12-01");
    });

    it("hands Enter, Escape and blur to the row", () => {
        const onKeyDown = vi.fn();
        const onBlur = vi.fn();
        render(
            <CssVarsProvider>
                <CellDateInput
                    ariaLabel="Due"
                    value=""
                    onBlur={onBlur}
                    onChange={() => {}}
                    onKeyDown={(e) => onKeyDown(e.key)}
                />
            </CssVarsProvider>
        );
        const input = screen.getByLabelText("Due");
        fireEvent.keyDown(input, { key: "Enter" });
        fireEvent.keyDown(input, { key: "Escape" });
        fireEvent.blur(input);
        expect(onKeyDown.mock.calls.map((c) => c[0])).toEqual(["Enter", "Escape"]);
        expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it("sets the browser's color-scheme from the app's mode, not the OS", () => {
        render(
            <CssVarsProvider>
                <CellDateInput ariaLabel="Due" value="" onChange={() => {}} />
            </CssVarsProvider>
        );
        const css = Array.from(document.querySelectorAll("style"))
            .map((s) => s.textContent)
            .join("");
        expect(css).toContain('[data-joy-color-scheme="dark"]');
        expect(css).toMatch(/color-scheme:\s*dark/);
        expect(css).toMatch(/color-scheme:\s*light/);
    });

    it("the rows no longer carry a raw date input or the old hex colors", () => {
        for (const file of [
            "features/tasks/components/table/DraggableTaskRow.tsx",
            "features/tasks/components/table/QuickAddTaskRow.tsx",
        ]) {
            const source = read(file);
            expect(source, file).not.toMatch(/<input[^>]*type="date"/);
            expect(source, file).not.toMatch(/type="date"/);
            expect(source, file).not.toContain("#1e1e1e");
            expect(source, file).toContain("CellDateInput");
        }
    });
});
