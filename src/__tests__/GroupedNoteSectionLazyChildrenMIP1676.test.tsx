/**
 * MIP-1676. A folder of the notes sidebar mounted every row it holds even while it was closed (the
 * section only animated a `0fr` grid row), so with 720 task notes the closed sidebar was 22,000 DOM
 * nodes and each commit of the app above it re-rendered every row, about half a second each. The
 * rows of a folder nobody has opened are now not mounted; once opened it keeps them.
 */
import { useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { GroupedNoteSection } from "../features/notes/common/components/GroupedNoteSection";

// One row, counting how often it renders and holding some state of its own.
const renders = { row: 0 };
const Row = () => {
    renders.row += 1;
    const [text, setText] = useState("");
    return <input aria-label="row draft" value={text} onChange={(e) => setText(e.target.value)} />;
};

const section = (defaultExpanded: boolean) => (
    <CssVarsProvider>
        <GroupedNoteSection defaultExpanded={defaultExpanded} groupKey="k" groupLabel="Folder">
            <Row />
        </GroupedNoteSection>
    </CssVarsProvider>
);
const header = () => screen.getByText("Folder");
const hasRow = () => screen.queryByLabelText("row draft") !== null;

beforeEach(() => {
    renders.row = 0;
});

describe("a folder nobody has opened", () => {
    it("does not mount its rows", () => {
        render(section(false));
        expect(hasRow()).toBe(false);
        expect(renders.row).toBe(0);
    });

    it("does not render them when the parent renders again", () => {
        const { rerender } = render(section(false));
        rerender(section(false));
        rerender(section(false));
        expect(renders.row).toBe(0);
    });

    it("mounts them when it is opened, in the same pass (never open and empty)", () => {
        render(section(false));
        fireEvent.click(header());
        expect(hasRow()).toBe(true);
        expect(renders.row).toBe(1);
    });

    it("mounts them when the open note moves into it after mount (auto-reveal)", () => {
        const { rerender } = render(section(false));
        expect(hasRow()).toBe(false);
        act(() => {
            rerender(section(true));
        });
        expect(hasRow()).toBe(true);
    });
});

describe("a folder that starts open", () => {
    it("has its rows from the first render", () => {
        render(section(true));
        expect(hasRow()).toBe(true);
    });
});

describe("a folder that has been opened", () => {
    it("keeps its rows (and what they hold) when it is closed again", () => {
        render(section(false));
        fireEvent.click(header());
        fireEvent.change(screen.getByLabelText("row draft"), { target: { value: "unsaved" } });
        fireEvent.click(header()); // close
        expect(hasRow()).toBe(true);
        fireEvent.click(header()); // open again
        expect((screen.getByLabelText("row draft") as HTMLInputElement).value).toBe("unsaved");
        // The row was not thrown away and rebuilt.
        expect(renders.row).toBeLessThan(6);
    });
});
