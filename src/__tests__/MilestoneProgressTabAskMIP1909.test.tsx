import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { onAskGenosWithDraft } from "../features/spotlight/askGenosAbout";
import { MilestoneProgressTab } from "../features/tasks/components/dashboard/milestoneProgress/MilestoneProgressTab";
import { EffectiveTask } from "../features/tasks/utils/effectiveTasks";
import { I18nProvider } from "../i18n";

// MIP-1909: the Milestones tab groups its cards by sprint, and "Ask Genos" opens the ordinary ask
// with a written question (project or sprint). Nothing is sent by the tab.

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../features/tasks/services/loadTaskProgress", () => ({ loadTaskProgress: vi.fn() }));

const ms = (milestoneId: number, title: string, sprintId: number | null) =>
    ({
        milestoneId,
        taskId: milestoneId * 100,
        projectId: 3,
        title,
        status: "WIP",
        sprintId,
        dueDate: null,
    }) as never;

const sprints = [
    { sprintId: 1, name: "Sprint 12", status: "completed", startDate: "2026-10-01" },
    { sprintId: 2, name: "Sprint 13", status: "active", startDate: "2026-11-01" },
] as never;

const mount = (projectName: string | null = "Falcon") =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <MemoryRouter>
                    <MilestoneProgressTab
                        effectiveTasks={[] as EffectiveTask[]}
                        projectName={projectName}
                        sprints={sprints}
                        milestones={[
                            ms(1, "Old one", 1),
                            ms(2, "Current", 2),
                            ms(3, "Loose", null),
                        ]}
                        milestonesLoaded
                    />
                </MemoryRouter>
            </I18nProvider>
        </CssVarsProvider>
    );

describe("MilestoneProgressTab sprint groups and Ask Genos (MIP-1909)", () => {
    const stops: Array<() => void> = [];
    afterEach(() => stops.splice(0).forEach((s) => s()));

    it("groups by sprint: active first, no-sprint last", () => {
        mount();
        const headings = screen
            .getAllByRole("region")
            .map((r) => r.querySelector("p, h1, h2, h3, h4, h5, h6, div")?.textContent ?? "");
        expect(headings[0]).toContain("Sprint 13");
        expect(headings[1]).toContain("Sprint 12");
        expect(headings[2]).toContain("No sprint");
    });

    it("the sprint button hands the app-level ask a question naming sprint and project", () => {
        const got: string[] = [];
        stops.push(onAskGenosWithDraft((d) => got.push(d)));
        mount();
        const buttons = screen.getAllByRole("button", { name: "Ask Genos about this sprint" });
        expect(buttons).toHaveLength(2); // no button for the no-sprint group
        fireEvent.click(buttons[0]);
        expect(got).toHaveLength(1);
        expect(got[0]).toContain("Sprint 13");
        expect(got[0]).toContain("Falcon");
    });

    it("the project button asks about the whole project and falls back without a name", () => {
        const got: string[] = [];
        stops.push(onAskGenosWithDraft((d) => got.push(d)));
        mount(null);
        fireEvent.click(screen.getByRole("button", { name: "Ask Genos about progress" }));
        expect(got[0]).toContain("this project");
    });
});
