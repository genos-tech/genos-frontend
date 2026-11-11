/**
 * MIP-1157 (reopened): the task and milestone preview show status, priority and effort the
 * way the task table does: the shared StatusLabel / PriorityIcon / EffortLabel, not a
 * solid filled Joy Chip. Pinned for the three pickers (options and chosen value), the
 * header status, the sidebar search's chosen task, the sub-task rows and the activity feed.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ACTaskEffortLevel } from "../features/tasks/components/autocompletes/ACTaskEffortLevel";
import { ACTaskPriority } from "../features/tasks/components/autocompletes/ACTaskPriority";
import { ACTaskStatus } from "../features/tasks/components/autocompletes/ACTaskStatus";
import { effortLevels, priorities, statuses } from "../features/tasks/utils/taskMeta";

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(resolve(srcDir, path), "utf8");

const noop = () => {};
const task = (over: object) =>
    ({
        id: "1",
        status: statuses[0],
        priority: priorities[2],
        effortLevel: effortLevels[2],
        ...over,
    }) as never;

const open = () => {
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
};
const wrap = (ui: React.ReactElement) => render(<CssVarsProvider>{ui}</CssVarsProvider>);

describe("the preview pickers draw the table's pieces", () => {
    it("effort: every option is the tinted EffortLabel, and so is the chosen value", () => {
        wrap(<ACTaskEffortLevel setTaskContent={noop} taskContent={task({})} />);
        // The chosen value is shown before opening.
        expect(document.querySelector('[data-effort-level="Moderate"]')).toBeTruthy();
        open();
        const levels = Array.from(document.querySelectorAll("[data-effort-level]")).map((e) =>
            e.getAttribute("data-effort-level")
        );
        for (const e of effortLevels) expect(levels).toContain(e.level);
        // No filled Joy Chip anywhere in the picker.
        expect(document.querySelector(".MuiChip-root")).toBeNull();
    });

    it("status: every option is a StatusLabel (an icon and the word), not a Chip", () => {
        wrap(
            <ACTaskStatus
                setTaskContent={noop}
                socket={null}
                taskContent={task({})}
                onDeleteTask={noop}
            />
        );
        open();
        const options = screen.getAllByRole("option");
        expect(options.length).toBe(statuses.length);
        for (const option of options) expect(option.querySelector("svg")).toBeTruthy();
        expect(document.querySelector(".MuiChip-root")).toBeNull();
    });

    it("priority: every option is a PriorityIcon with its name, not a Chip", () => {
        wrap(<ACTaskPriority setTaskContent={noop} taskContent={task({})} />);
        open();
        const options = screen.getAllByRole("option");
        expect(options.length).toBe(priorities.length);
        for (const option of options) expect(option.querySelector("svg")).toBeTruthy();
        expect(document.querySelector(".MuiChip-root")).toBeNull();
    });
});

describe("the other places in the preview use the shared pieces", () => {
    it.each([
        [
            "header status",
            "features/tasks/components/contents/base/TaskTitleBlock.tsx",
            "<StatusLabel",
        ],
        ["sidebar search", "features/tasks/components/sidebar/SearchBox.tsx", "<StatusLabel"],
        [
            "sub-task rows",
            "features/tasks/components/contents/base/TaskSubTasksBlock.tsx",
            "<StatusLabel",
        ],
        [
            "activity feed effort",
            "features/tasks/components/contents/base/sub/TaskActivityFeed.tsx",
            "<EffortLabel",
        ],
    ])("%s", (_name, file, marker) => {
        const text = source(file);
        expect(text).toContain(marker);
        // The old solid status fill is gone from the file.
        expect(text).not.toMatch(/alpha\([^)]*status[^)]*color/i);
    });
});
