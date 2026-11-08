/**
 * MIP-1192: the schedule editor opened from a task graph node had English literals ("Edit
 * schedule", "Start date", "Due date", "Cancel", "Save"). It now reads the catalog, in every
 * locale, and reuses the keys the rest of the app already has.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NodeDateEditor } from "../features/tasks/diagram/components/nodeParts";
import { getMessages, I18nProvider, loadLocale } from "../i18n";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";

afterEach(() => {
    cleanup();
    localStorage.removeItem(LOCALE_STORAGE_KEY);
    document.documentElement.dir = "ltr";
});

const mount = () =>
    render(
        <I18nProvider>
            <CssVarsProvider>
                <NodeDateEditor
                    dueDate="2026-11-20"
                    startDate="2026-11-10"
                    zIndex={10020}
                    onClose={vi.fn()}
                    onSave={vi.fn()}
                />
            </CssVarsProvider>
        </I18nProvider>
    );

describe("NodeDateEditor", () => {
    it("shows the catalog's words in English", async () => {
        const m = await loadLocale("en");
        mount();
        expect(screen.getByRole("dialog", { name: m.tasks.diagram.editSchedule })).toBeTruthy();
        expect(screen.getByText(m.tasks.fields.startDate)).toBeTruthy();
        expect(screen.getByText(m.tasks.fields.dueDate)).toBeTruthy();
        expect(screen.getByRole("button", { name: m.common.actions.cancel })).toBeTruthy();
        expect(screen.getByRole("button", { name: m.common.actions.save })).toBeTruthy();
    });

    it.each(["ja", "zh", "es", "fr", "hi", "ar"] as const)(
        "speaks %s: no English literal is left",
        async (locale) => {
            const m = await loadLocale(locale);
            localStorage.setItem(LOCALE_STORAGE_KEY, locale);
            mount();
            const en = getMessages("en");
            expect(m.tasks.diagram.editSchedule).not.toBe(en.tasks.diagram.editSchedule);
            expect(
                screen.getByRole("dialog", { name: m.tasks.diagram.editSchedule })
            ).toBeTruthy();
            expect(screen.queryByText("Edit schedule")).toBeNull();
            expect(screen.queryByText("Start date")).toBeNull();
            expect(screen.queryByText("Due date")).toBeNull();
            expect(screen.getByRole("button", { name: m.common.actions.save })).toBeTruthy();
        }
    );
});
