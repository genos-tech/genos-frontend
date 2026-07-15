import { describe, expect, it } from "vitest";

import { isNoMainPanelVisible } from "../features/tasks/utils/mainPanelVisibility";

const panels = (over: Partial<Parameters<typeof isNoMainPanelVisible>[0]> = {}) => ({
    isSprintBoardVisible: false,
    isTaskDashboardVisible: false,
    isTaskTableVisible: false,
    ...over,
});

describe("isNoMainPanelVisible", () => {
    it("counts the DASHBOARD as a main panel", () => {
        // The bug: a close path tested only the table + sprint board. The
        // three panels are mutually exclusive, so with the dashboard open
        // the table flag is ALREADY false — that path then "restored" the
        // table, which closed the dashboard the user was reading.
        expect(isNoMainPanelVisible(panels({ isTaskDashboardVisible: true }))).toBe(false);
    });

    it("counts the table and the sprint board too", () => {
        expect(isNoMainPanelVisible(panels({ isTaskTableVisible: true }))).toBe(false);
        expect(isNoMainPanelVisible(panels({ isSprintBoardVisible: true }))).toBe(false);
    });

    it("is true only when every main panel is hidden", () => {
        expect(isNoMainPanelVisible(panels())).toBe(true);
    });
});
