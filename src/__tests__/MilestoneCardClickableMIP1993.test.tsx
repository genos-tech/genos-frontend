import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { MilestoneProgressTab } from "../features/tasks/components/dashboard/milestoneProgress/MilestoneProgressTab";
import { I18nProvider } from "../i18n";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "t" }),
}));
vi.mock("../components/ui/avatars/UserAvatar", () => ({
    UserAvatar: ({ userId }: { userId: string }) => (
        <span data-testid="user-avatar">{userId}</span>
    ),
}));
vi.mock("../features/tasks/services/loadTaskProgress", () => ({
    loadTaskProgress: vi.fn().mockResolvedValue(null),
}));

const NOW = new Date().toISOString();
const milestone = {
    milestoneId: 7,
    taskId: 700,
    projectId: 1,
    title: "Launch",
    status: "WIP",
    dueDate: null,
    sprintId: null,
    assignees: [{ userId: "u1", username: "Ken", profileImageUrl: null }],
};
const row = (over: Record<string, unknown>) =>
    ({
        id: "2",
        title: "Blocked thing",
        displayId: "MIP-2",
        milestoneId: 7,
        parentId: 700,
        status: "Blocked",
        effectiveStatus: "Blocked",
        effectiveCloseDate: null,
        priority: "High",
        tags: [{ tagName: "bug", tagColor: "#ef4444", tagTextColor: "#fff" }],
        lastProgressAt: NOW,
        ...over,
    }) as never;

const mount = (onOpen?: (id: number) => void) =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <MemoryRouter>
                    <MilestoneProgressTab
                        effectiveTasks={[row({ id: "700", isMilestone: true }), row({ id: "2" })]}
                        milestones={[milestone] as never}
                        sprints={[]}
                        milestonesLoaded
                        onOpenMilestone={onOpen}
                    />
                </MemoryRouter>
            </I18nProvider>
        </CssVarsProvider>
    );

describe("Milestone card (MIP-1993)", () => {
    it("opens the milestone from one card-sized button, not an icon button", () => {
        const onOpen = vi.fn();
        mount(onOpen);
        const hits = document.querySelectorAll("button.ms-card-hit");
        expect(hits).toHaveLength(1);
        fireEvent.click(hits[0]);
        expect(onOpen).toHaveBeenCalledWith(7);
        // The assignee is the app's real avatar component, not an initials placeholder.
        expect(screen.getByTestId("user-avatar").textContent).toBe("u1");
    });

    it("has no hit area when nothing can be opened", () => {
        mount();
        expect(document.querySelectorAll("button.ms-card-hit")).toHaveLength(0);
    });

    it("lists status, priority and tags on a task under Show details", () => {
        mount(vi.fn());
        fireEvent.click(screen.getByText("Show details"));
        const r = screen.getByTestId("milestone-attention-row");
        expect(r.textContent).toContain("Blocked thing");
        expect(r.textContent).toContain("bug");
        expect(r.querySelector('[aria-label="High"]')).not.toBeNull();
        expect(screen.getAllByText("Blocked").length).toBeGreaterThan(0);
    });
});
