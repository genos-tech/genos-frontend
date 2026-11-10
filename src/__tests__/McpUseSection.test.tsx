/**
 * "What your AI apps open" (MIP-1143): the one switch for the markers Genos keeps of which
 * items a connected AI app opened or changed.
 *
 * What matters here: it is on when the server says so, turning it OFF asks first IN THE PAGE
 * (never `window.confirm`) because it deletes, nothing is sent until that is confirmed, the
 * request carries a real boolean, the switch does not move before the server has answered, and
 * turning it back on needs no question.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { McpUseSection } from "../features/genos/memory/McpUseSection";
import { I18nProvider } from "../i18n";
import { en } from "../i18n/locales/en";

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));
vi.mock("../services/api", () => ({ authApi: () => api }));

const m = en.settings.genosMemory.mcpUse;
const URL = "/user/preferences/member-events/";

const renderSection = () =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <McpUseSection />
            </I18nProvider>
        </CssVarsProvider>
    );

const theSwitch = () =>
    screen.getByRole("switch", { name: m.switchLabel, hidden: true }) as HTMLInputElement;

beforeEach(() => {
    api.get.mockReset();
    api.patch.mockReset();
    api.get.mockResolvedValue({ data: { member_events_enabled: true } });
    vi.spyOn(window, "confirm").mockImplementation(() => true);
});

describe("the AI-app activity switch", () => {
    it("says what is noted, who sees it, how long, and what off does", async () => {
        renderSection();
        await waitFor(() => expect(theSwitch().checked).toBe(true));
        expect(screen.getByText(m.heading)).toBeTruthy();
        expect(screen.getByText(m.switchHelper)).toBeTruthy();
        expect(m.switchHelper).toMatch(/never their text/);
        expect(m.switchHelper).toMatch(/only you can see it/i);
        // The switch also covers the person's own changes that nothing else saves (MIP-1085):
        // the sentence must say so, and so must the confirmation that deletes them.
        expect(m.switchHelper).toMatch(/collaborator/);
        expect(m.switchHelper).toMatch(/dependency/);
        expect(m.switchHelper).toMatch(/to-do/);
        expect(m.switchHelper).toMatch(/share a note/);
        expect(m.offBody).toMatch(/collaborators, dependencies, to-dos and note shares/);
        expect(m.switchHelper).toMatch(/180 days/);
        expect(m.switchHelper).toMatch(/everything noted is deleted/);
        expect(api.get).toHaveBeenCalledWith(URL, expect.anything());
    });

    it("turning it OFF asks first, in the page, and sends nothing until confirmed", async () => {
        const user = userEvent.setup();
        renderSection();
        await waitFor(() => expect(theSwitch().checked).toBe(true));

        await user.click(theSwitch());
        expect(await screen.findByText(m.offTitle)).toBeTruthy();
        expect(screen.getByText(m.offBody)).toBeTruthy();
        expect(api.patch).not.toHaveBeenCalled();
        expect(window.confirm).not.toHaveBeenCalled();
        // The switch has not moved: nothing has been deleted yet.
        expect(theSwitch().checked).toBe(true);

        api.patch.mockResolvedValue({ data: { member_events_enabled: false } });
        await user.click(screen.getByRole("button", { name: m.offConfirm }));
        await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
        expect(api.patch).toHaveBeenCalledWith(
            URL,
            { member_events_enabled: false },
            expect.anything()
        );
        await waitFor(() => expect(theSwitch().checked).toBe(false));
        await waitFor(() => expect(screen.queryByText(m.offTitle)).toBeNull());
        expect(window.confirm).not.toHaveBeenCalled();
    });

    it("cancelling keeps it on and sends nothing", async () => {
        const user = userEvent.setup();
        renderSection();
        await waitFor(() => expect(theSwitch().checked).toBe(true));
        await user.click(theSwitch());
        await user.click(await screen.findByRole("button", { name: en.common.actions.cancel }));
        await waitFor(() => expect(screen.queryByText(m.offTitle)).toBeNull());
        expect(api.patch).not.toHaveBeenCalled();
        expect(theSwitch().checked).toBe(true);
    });

    it("a failed delete says so, keeps the dialog and leaves the switch on", async () => {
        const user = userEvent.setup();
        api.patch.mockRejectedValue(new Error("down"));
        renderSection();
        await waitFor(() => expect(theSwitch().checked).toBe(true));
        await user.click(theSwitch());
        await user.click(await screen.findByRole("button", { name: m.offConfirm }));
        expect(await screen.findByText(m.toggleFailed)).toBeTruthy();
        expect(screen.getByText(m.offTitle)).toBeTruthy();
        expect(theSwitch().checked).toBe(true);
    });

    it("turning it back on needs no question and sends true", async () => {
        const user = userEvent.setup();
        api.get.mockResolvedValue({ data: { member_events_enabled: false } });
        api.patch.mockResolvedValue({ data: { member_events_enabled: true } });
        renderSection();
        await waitFor(() => expect(theSwitch().disabled).toBe(false));
        expect(theSwitch().checked).toBe(false);
        await user.click(theSwitch());
        await waitFor(() =>
            expect(api.patch).toHaveBeenCalledWith(
                URL,
                { member_events_enabled: true },
                expect.anything()
            )
        );
        expect(screen.queryByText(m.offTitle)).toBeNull();
        await waitFor(() => expect(theSwitch().checked).toBe(true));
    });

    it("does not guess when the setting cannot be read", async () => {
        api.get.mockRejectedValue(new Error("down"));
        renderSection();
        expect(await screen.findByText(m.loadFailed)).toBeTruthy();
        expect(theSwitch().disabled).toBe(true);
        expect(theSwitch().checked).toBe(false);
    });

    it("a failed read offers Retry, and Retry asks again and lands the setting", async () => {
        const user = userEvent.setup();
        api.get.mockRejectedValueOnce(new Error("down"));
        renderSection();
        expect(await screen.findByText(m.loadFailed)).toBeTruthy();
        expect(api.get).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole("button", { name: en.common.actions.retry }));

        await waitFor(() => expect(theSwitch().checked).toBe(true));
        expect(theSwitch().disabled).toBe(false);
        expect(screen.queryByText(m.loadFailed)).toBeNull();
        expect(api.get).toHaveBeenCalledTimes(2);
    });
});
