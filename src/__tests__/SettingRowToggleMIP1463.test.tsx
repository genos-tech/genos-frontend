/**
 * MIP-1463: a click on a Settings row's text flips its switch, every row that holds a switch is
 * a `SettingRow` (so the hover plate and the click agree), and every switch has an accessible name.
 *
 * jsdom lays nothing out and runs no `:active`, so the touch tint and the real hit areas are not
 * covered here; the click behaviour and the names are.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { useState } from "react";
import { Button, Switch, Typography } from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cssWithMediaOf } from "./utils/cssOf";

import { SettingRow } from "../components/ui/settings/SettingRow";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

const Harness = ({
    disabledSwitch = false,
    disabledRow = false,
    second = false,
    onButton = () => {},
}: {
    disabledSwitch?: boolean;
    disabledRow?: boolean;
    second?: boolean;
    onButton?: () => void;
}) => {
    const [on, setOn] = useState(false);
    const [other, setOther] = useState(false);
    return (
        <CssVarsProvider>
            <SettingRow
                alignItems="center"
                data-testid="row"
                direction="row"
                disabled={disabledRow}
                justifyContent="space-between"
            >
                <div>
                    <Typography level="title-sm">Label</Typography>
                    <Typography level="body-xs">Description</Typography>
                </div>
                <Button onClick={onButton}>Action</Button>
                <Switch
                    checked={on}
                    disabled={disabledSwitch}
                    slotProps={{ input: { "aria-label": "Label" } }}
                    onChange={(e) => setOn(e.target.checked)}
                />
                {second && (
                    <Switch
                        checked={other}
                        slotProps={{ input: { "aria-label": "Second" } }}
                        onChange={(e) => setOther(e.target.checked)}
                    />
                )}
            </SettingRow>
        </CssVarsProvider>
    );
};

const sw = (name = "Label") => screen.getByRole("switch", { name }) as HTMLInputElement;

describe("a click on a row's text flips its switch", () => {
    it("on the label", () => {
        render(<Harness />);
        fireEvent.click(screen.getByText("Label"));
        expect(sw().checked).toBe(true);
        fireEvent.click(screen.getByText("Label"));
        expect(sw().checked).toBe(false);
    });

    it("on the description, and on the empty space of the row", () => {
        render(<Harness />);
        fireEvent.click(screen.getByText("Description"));
        expect(sw().checked).toBe(true);
        fireEvent.click(screen.getByTestId("row"));
        expect(sw().checked).toBe(false);
    });

    it("a click on the switch itself flips it once, not twice", () => {
        render(<Harness />);
        fireEvent.click(sw());
        expect(sw().checked).toBe(true);
    });

    it("a click on another control in the row is that control's own", () => {
        const onButton = vi.fn();
        render(<Harness onButton={onButton} />);
        fireEvent.click(screen.getByRole("button", { name: "Action" }));
        expect(onButton).toHaveBeenCalledTimes(1);
        expect(sw().checked).toBe(false);
    });

    it("flips nothing while the switch is disabled, or the row is", () => {
        const { unmount } = render(<Harness disabledSwitch />);
        fireEvent.click(screen.getByText("Label"));
        expect(sw().checked).toBe(false);
        unmount();
        render(<Harness disabledRow />);
        fireEvent.click(screen.getByText("Label"));
        expect(sw().checked).toBe(false);
    });

    it("flips nothing in a row with two switches (which one is meant?)", () => {
        render(<Harness second />);
        fireEvent.click(screen.getByText("Label"));
        expect(sw().checked).toBe(false);
        expect(sw("Second").checked).toBe(false);
    });

    it("flips nothing when the click ends a text selection", () => {
        render(<Harness />);
        vi.spyOn(window, "getSelection").mockReturnValue({
            toString: () => "Description",
        } as unknown as Selection);
        fireEvent.click(screen.getByText("Description"));
        expect(sw().checked).toBe(false);
    });

    it("the row shows the pointer cursor only while it has an enabled switch, in its own rule", () => {
        render(<Harness />);
        const css = cssWithMediaOf(screen.getByTestId("row"));
        expect(css).toMatch(
            /:has\(input\[type=["']checkbox["']\]:not\(:disabled\)\)[^{]*\{[^}]*cursor: pointer/
        );
        cleanup();
        render(<Harness disabledRow />);
        expect(cssWithMediaOf(screen.getByTestId("row"))).not.toMatch(/cursor: pointer/);
    });
});

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/** The text of every `<Switch ... />` opening tag in `text`. */
const switchTags = (text: string): string[] =>
    [...text.matchAll(/<Switch\b[\s\S]*?\/>/g)].map((m) => m[0]);

describe("every switch in the touched panels has an accessible name", () => {
    it.each([
        "components/layout/SettingsModal.tsx",
        "features/genos/memory/McpUseSection.tsx",
        "features/genos/memory/SharedAnswersSection.tsx",
        "features/tasks/components/modals/ModalCustomizeTaskFields.tsx",
        "features/tasks/components/table/TaskTableColumnSettings.tsx",
        "features/admin/components/modals/sub/UserProfileLocationShare.tsx",
    ])("%s", (file) => {
        const tags = switchTags(source(file));
        expect(tags.length).toBeGreaterThan(0);
        for (const tag of tags) expect(tag).toContain('"aria-label"');
    });

    it("every switch row of SettingsModal is a SettingRow", () => {
        const text = source("components/layout/SettingsModal.tsx");
        // One row per switch (the sidebar's rows are one SettingRow in a map), and the label +
        // control rows of the other tabs' sections too.
        expect(text.match(/<SettingRow\b/g)!.length).toBeGreaterThanOrEqual(
            text.match(/<Switch\b/g)!.length
        );
        expect(text.match(/<SettingRow\b/g)!.length).toBeGreaterThanOrEqual(15);
    });
});
