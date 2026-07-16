/**
 * Regression canary for the `ownerState` DOM-leak warning.
 *
 * Joy's Autocomplete injects its internal `ownerState` into the props it
 * hands `renderOption`. Sites that render a bespoke `<li>`/Box (instead
 * of Joy's `<AutocompleteOption>`, which consumes the prop) and spread
 * those props straight through forward `ownerState` to the DOM node —
 * React then warns "does not recognize the `ownerState` prop" on EVERY
 * rendered option. `stripOwnerState` (utils/joyAutocomplete.ts) is the
 * shared fix; this drives one real bespoke-row consumer end-to-end and
 * fails if the strip is dropped.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACTaskSelector } from "../features/tasks/components/autocompletes/ACTaskSelector";
import type { ProjectManagementState } from "../hooks/common/useProjectManagement";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));

describe("Autocomplete bespoke option rows", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        errorSpy.mockRestore();
    });

    it("do not forward Joy's ownerState to the DOM", () => {
        const usePM = {
            teamProjects: [
                { projectId: 1, projectName: "Alpha", projectTags: [] },
                { projectId: 2, projectName: "Beta", projectTags: [] },
            ],
            setCurrentProject: vi.fn(),
        } as unknown as ProjectManagementState;

        render(
            <CssVarsProvider>
                <ACTaskSelector
                    defaultProjectId={1}
                    excludeTaskIds={new Set()}
                    myself={{ userId: "u1" } as never}
                    usePM={usePM}
                    onPick={vi.fn()}
                />
            </CssVarsProvider>
        );

        // Open the project autocomplete so its bespoke renderOption rows
        // actually mount (the warning fires per rendered option).
        const projectInput = screen.getAllByRole("combobox")[0];
        fireEvent.focus(projectInput);
        fireEvent.keyDown(projectInput, { key: "ArrowDown" });
        expect(screen.getByRole("option", { name: /Beta/ })).toBeTruthy();

        const ownerStateWarnings = errorSpy.mock.calls.filter((args) =>
            args.some((a) => typeof a === "string" && a.includes("ownerState"))
        );
        expect(ownerStateWarnings).toEqual([]);
    });
});
