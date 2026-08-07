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
 *
 * `SprintMilestonePicker` is that consumer: its two-line sprint and
 * milestone rows don't fit Joy's option component. The pickers that DO
 * use `AutocompleteOption` (the project and task dropdowns) are covered
 * by `ProjectPickerIdentity.test.tsx` — driving one of those here would
 * make this file pass no matter what, since Joy's own option swallows
 * `ownerState` on its own.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SprintMilestonePicker } from "../features/tasks/sprint-milestone/components/SprintMilestonePicker";
import type { SprintMilestoneManagementState } from "../hooks/tasks/useSprintMilestoneManagement";

describe("Autocomplete bespoke option rows", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        errorSpy.mockRestore();
    });

    it("do not forward Joy's ownerState to the DOM", () => {
        // Active sprint / Open milestone: both survive the picker's
        // visibility filters, so the option rows actually mount.
        const useSM = {
            projectSprints: {
                1: [
                    {
                        sprintId: 11,
                        projectId: 1,
                        name: "Sprint 4",
                        status: "active",
                        startDate: "2026-01-01",
                        endDate: "2026-01-14",
                        isDeleted: false,
                    },
                ],
            },
            projectMilestones: {
                1: [
                    {
                        milestoneId: 21,
                        projectId: 1,
                        sprintId: 11,
                        title: "Beta launch",
                        status: "Open",
                        isDeleted: false,
                    },
                ],
            },
        } as unknown as SprintMilestoneManagementState;

        render(
            <CssVarsProvider>
                <SprintMilestonePicker
                    milestoneId={null}
                    projectId={1}
                    sprintId={null}
                    useSM={useSM}
                    onChangeMilestone={vi.fn()}
                    onChangeSprint={vi.fn()}
                />
            </CssVarsProvider>
        );

        // Open the sprint autocomplete so its bespoke renderOption rows
        // actually mount (the warning fires per rendered option).
        const sprintInput = screen.getAllByRole("combobox")[0];
        fireEvent.focus(sprintInput);
        fireEvent.keyDown(sprintInput, { key: "ArrowDown" });
        expect(screen.getByRole("option", { name: /Sprint 4/ })).toBeTruthy();

        const ownerStateWarnings = errorSpy.mock.calls.filter((args) =>
            args.some((a) => typeof a === "string" && a.includes("ownerState"))
        );
        expect(ownerStateWarnings).toEqual([]);
    });
});
