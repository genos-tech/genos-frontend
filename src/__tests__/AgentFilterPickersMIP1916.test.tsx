// MIP-1916: the Agent Activity filters "Project" and "Person" are the same Autocomplete
// components the other pages use (the project picker's identity row, the Member's Tasks picker's
// avatar row), not plain Selects with a name-only list.
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_AGENT_FILTERS } from "../features/tasks/agentActivity/agentActivityFilters";
import { AgentFilterBar } from "../features/tasks/components/dashboard/agentActivity/AgentFilterBar";
import { I18nProvider } from "../i18n";

vi.mock("../components/ui/avatars/UserAvatar", () => ({
    UserAvatar: ({ userId }: { userId: string }) => <span data-testid={`user-avatar-${userId}`} />,
}));

const mount = (onChange = vi.fn()) => {
    render(
        <CssVarsProvider>
            <I18nProvider>
                <AgentFilterBar
                    filters={DEFAULT_AGENT_FILTERS}
                    projectAvatars={new Map()}
                    projects={[{ id: 1, name: "Launch" }]}
                    people={[
                        { id: "u1", name: "Ada" },
                        { id: "u2", name: "Ben" },
                    ]}
                    projectRecords={[
                        {
                            projectId: 1,
                            projectName: "Launch",
                            isPrivate: true,
                            projectLabels: [],
                        },
                    ]}
                    onChange={onChange}
                    onClear={vi.fn()}
                />
            </I18nProvider>
        </CssVarsProvider>
    );
    return onChange;
};

describe("Agent Activity Project and Person filters (MIP-1916)", () => {
    it("are typeable Autocompletes (an input), like the other project and member pickers", () => {
        mount();
        expect(screen.getByRole("combobox", { name: /project/i }).tagName).toBe("INPUT");
        expect(screen.getByRole("combobox", { name: /person/i }).tagName).toBe("INPUT");
    });

    it("the Person options carry the member avatar, as in Member's Tasks", () => {
        mount();
        fireEvent.keyDown(screen.getByRole("combobox", { name: /person/i }), { key: "ArrowDown" });
        const list = screen.getByRole("listbox");
        expect(within(list).getByTestId("user-avatar-u1")).toBeTruthy();
        expect(within(list).getByTestId("user-avatar-u2")).toBeTruthy();
    });

    it("choosing a person or a project sets the filter", () => {
        const onChange = mount();
        fireEvent.keyDown(screen.getByRole("combobox", { name: /person/i }), { key: "ArrowDown" });
        fireEvent.click(screen.getByText("Ben"));
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ userId: "u2" }));
        fireEvent.keyDown(screen.getByRole("combobox", { name: /project/i }), {
            key: "ArrowDown",
        });
        fireEvent.click(screen.getByText("Launch"));
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ projectId: 1 }));
    });
});
