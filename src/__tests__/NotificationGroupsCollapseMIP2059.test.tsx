/**
 * MIP-2059: Settings -> Notifications starts with the groups that have sub-rows collapsed
 * (Mentions, Inbox, What my AI apps do, Email notifications). The title of each is a disclosure
 * button (aria-expanded, keyboard); the group's own switch keeps working while collapsed.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { NotificationsProvider } from "../services/notifications/NotificationsContext";
import { NotificationSettingsPanel } from "../services/notifications/NotificationSettingsPanel";
import { DEFAULT_NOTIFICATION_PREFERENCE } from "../services/notifications/types";

afterEach(cleanup);

const noop = () => undefined;
const setGroupEnabled = vi.fn();

const renderPanel = () => {
    const ctx = {
        preferences: { ...DEFAULT_NOTIFICATION_PREFERENCE },
        permission: "granted",
        requestPermission: noop,
        setMasterEnabled: noop,
        setEmailEnabled: noop,
        setEmailCategoryEnabled: noop,
        setGroupEnabled,
        setSubCategoryEnabled: noop,
        unmute: noop,
        unmuteTarget: noop,
        isPausedNow: false,
        snoozeUntil: null,
        snoozeSchedule: null,
        pauseFor: noop,
        pauseUntilTomorrow: noop,
        pauseUntilNextWeek: noop,
        pauseUntil: noop,
        resume: noop,
        setSchedule: noop,
    };
    return render(
        <I18nProvider>
            <CssVarsProvider>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <NotificationsProvider value={ctx as any}>
                    <NotificationSettingsPanel />
                </NotificationsProvider>
            </CssVarsProvider>
        </I18nProvider>
    );
};

const GROUPS = ["Mentions", "Inbox", "What my AI apps do", "Email notifications"];

describe("Notifications groups collapse (MIP-2059)", () => {
    it("starts with every group collapsed and no sub-rows mounted", () => {
        renderPanel();
        for (const name of GROUPS) {
            const btn = screen.getByRole("button", { name });
            expect(btn.getAttribute("aria-expanded")).toBe("false");
        }
        // sub-rows (per-surface mention toggles, per-category email toggles) are not in the DOM
        expect(screen.queryByRole("switch", { name: "Mentions: In a chat message" })).toBeNull();
        // the group switches themselves are always there
        expect(screen.getByRole("switch", { name: "Mentions" })).toBeTruthy();
        expect(screen.getByRole("switch", { name: "Email notifications" })).toBeTruthy();
    });

    it("opens and closes on click, and says so with aria-expanded", () => {
        renderPanel();
        const btn = screen.getByRole("button", { name: "Mentions" });
        fireEvent.click(btn);
        expect(btn.getAttribute("aria-expanded")).toBe("true");
        const controls = btn.getAttribute("aria-controls");
        expect(controls).toBeTruthy();
        expect(document.getElementById(controls as string)).toBeTruthy();
        expect(screen.getByRole("switch", { name: "Mentions: In a chat message" })).toBeTruthy();
        fireEvent.click(btn);
        expect(btn.getAttribute("aria-expanded")).toBe("false");
        expect(screen.queryByRole("switch", { name: "Mentions: In a chat message" })).toBeNull();
    });

    it("opens one group without opening the others", () => {
        renderPanel();
        fireEvent.click(screen.getByRole("button", { name: "Email notifications" }));
        expect(
            screen
                .getByRole("button", { name: "Email notifications" })
                .getAttribute("aria-expanded")
        ).toBe("true");
        expect(
            screen.getByRole("button", { name: "Mentions" }).getAttribute("aria-expanded")
        ).toBe("false");
    });

    it("is a real button, so Enter and Space work (focusable, not a div)", () => {
        renderPanel();
        const btn = screen.getByRole("button", { name: "Inbox" });
        expect(btn.tagName).toBe("BUTTON");
        expect(btn.getAttribute("type")).toBe("button");
        expect(btn.tabIndex).toBe(0);
    });

    it("keeps the group switch working while collapsed", () => {
        renderPanel();
        fireEvent.click(screen.getByRole("switch", { name: "Mentions" }));
        expect(setGroupEnabled).toHaveBeenCalledWith("mentions", false);
    });
});
