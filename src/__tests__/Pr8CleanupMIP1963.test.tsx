import type { ReactElement } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectAvatar } from "../components/ui/avatars/ProjectAvatar";
import { TaskVelocityChart } from "../features/tasks/components/dashboard/TaskVelocityChart";
import { I18nProvider } from "../i18n";

// MIP-1963 clean-up: the Velocity plot with no activity is the shared empty state, and the project
// avatar in a picker is a picture, not a button that opens the project profile (MIP-1981).

vi.mock("../features/admin/components/modals/ModalProjectProfile", () => ({
    ModalProjectProfile: () => null,
}));
vi.mock("../features/admin/components/modals/ModalUserProfile", () => ({
    UserProfile: () => null,
}));

const day = (date: string, n = 0) => ({ date, created: n, started: 0, closed: 0, updated: 0 });

describe("Velocity with nothing in the window", () => {
    const mount = (data: ReturnType<typeof day>[]) =>
        render(
            <CssVarsProvider>
                <I18nProvider>
                    <TaskVelocityChart
                        data={data}
                        granularity="day"
                        isDark={false}
                        textMuted="gray"
                        textSecondary="gray"
                    />
                </I18nProvider>
            </CssVarsProvider>
        );

    it("shows the shared empty state, not an empty axis", () => {
        const { container } = mount([day("2026-11-22")]);
        expect(container.querySelector('[data-empty="task-velocity"]')).toBeTruthy();
        expect(screen.getByText("No task activity in this window yet.")).toBeTruthy();
    });

    it("draws the chart once any day has activity", () => {
        const { container } = mount([day("2026-11-21"), day("2026-11-22", 2)]);
        expect(container.querySelector('[data-empty="task-velocity"]')).toBeNull();
    });
});

describe("ProjectAvatar in a picker (MIP-1981)", () => {
    // The real props are a dozen app-state objects; the test only needs the two it reads.
    const Avatar = ProjectAvatar as unknown as (p: Record<string, unknown>) => ReactElement;
    const props: Record<string, unknown> = {
        socket: null,
        useTEM: { teamMemberProfiles: {} },
        myself: { userId: "me" },
        setMyself: vi.fn(),
        pmChat: { profileImagePath: null },
        useCM: { allChats: [] },
        useUISM: {},
    };

    it("is clickable by default and a plain picture with clickable={false}", () => {
        const { container, rerender } = render(
            <CssVarsProvider>
                <Avatar {...props} />
            </CssVarsProvider>
        );
        const clickable = container.querySelector('[role="button"], button');
        expect(clickable).toBeTruthy();
        rerender(
            <CssVarsProvider>
                <Avatar {...props} clickable={false} />
            </CssVarsProvider>
        );
        expect(container.querySelector('[role="button"], button')).toBeNull();
        // A click on the picture goes to whatever holds it (the picker), not to a dialog.
        const parent = vi.fn();
        container.addEventListener("click", parent);
        fireEvent.click(container.firstElementChild as Element);
        expect(parent).toHaveBeenCalled();
    });
});
