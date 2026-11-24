/**
 * MIP-2323: `?settings=<tab>` opens Settings on that tab, so a guide answer can link to it.
 *
 * Covers every tab key, an unknown key (General), the parameter being removed from the
 * address, a request made before any modal is mounted, other query parameters surviving, and
 * the parameter surviving the sign-in redirect. Layout at 1440 and 390 is checked in a real
 * browser (see the PR).
 */
import { useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestOpenSettings, useOpenSettingsRequest } from "../components/layout/settingsEvents";
import { SETTINGS_TABS, SettingsModal } from "../components/layout/SettingsModal";
import { AuthGuard } from "../features/admin/authGuard";
import { en } from "../i18n/locales/en";
import { SETTINGS_MAP, type SettingsTabKey } from "../manual/settingsMap";
import { isAllowedReturn, takeReturn, takeWorkspaceReturn } from "../utils/pendingReturn";
import {
    readSettingsParam,
    resolveSettingsTab,
    stripSettingsParam,
    useSettingsDeepLink,
} from "../utils/settingsDeepLink";

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../features/integrations/services/connections", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/integrations/services/connections")>()),
    listConnections: () => Promise.resolve({ connections: [] }),
}));
vi.mock("../features/integrations/services/calendar", () => ({
    listCalendars: () => Promise.resolve([]),
}));
vi.mock("../components/layout/settings/CreditBalance", () => ({
    CreditUsageSection: () => <div />,
}));
vi.mock("../components/layout/settings/PlanUsageSection", () => ({
    PlanUsageSection: () => <div />,
}));
vi.mock("../components/layout/MentionGroupsPanel", () => ({ MentionGroupsPanel: () => <div /> }));
vi.mock("../components/layout/DeveloperSettingsSection", () => ({
    DeveloperSettingsSection: () => null,
}));
vi.mock("../components/layout/TeamEmojiPanel", () => ({ TeamEmojiPanel: () => <div /> }));

const KEYS = Object.keys(SETTINGS_MAP) as SettingsTabKey[];
const labelOf = (key: SettingsTabKey) => SETTINGS_TABS.find((d) => d.key === key)!.label(en);

/** The same wiring as the sidebar: a listener that owns the modal. */
const Host = () => {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<SettingsTabKey | undefined>(undefined);
    useOpenSettingsRequest((requested) => {
        setTab(requested as SettingsTabKey | undefined);
        setOpen(true);
    });
    return <SettingsModal initialTab={tab} open={open} onClose={() => setOpen(false)} />;
};

const Link = () => {
    useSettingsDeepLink();
    return null;
};

const Where = () => {
    const location = useLocation();
    return <output data-testid="where">{location.pathname + location.search}</output>;
};

const renderAt = (url: string, withHost = true) =>
    render(
        <CssVarsProvider>
            <MemoryRouter initialEntries={[url]}>
                <Link />
                <Where />
                {withHost && <Host />}
            </MemoryRouter>
        </CssVarsProvider>
    );

const selectedTab = () => screen.getByRole("tab", { selected: true }).textContent ?? "";

describe("settings deep link helpers (MIP-2323)", () => {
    it("resolves every key of the map, and anything else to general", () => {
        for (const key of KEYS) expect(resolveSettingsTab(key)).toBe(key);
        for (const bad of ["nope", "", "Security", "../x", null, undefined]) {
            expect(resolveSettingsTab(bad as string | null | undefined)).toBe("general");
        }
    });

    it("reads and strips only the settings parameter", () => {
        expect(readSettingsParam("?a=1&settings=security")).toBe("security");
        expect(readSettingsParam("?a=1")).toBeNull();
        expect(stripSettingsParam("?a=1&settings=security")).toBe("?a=1");
        expect(stripSettingsParam("?settings=security")).toBe("");
    });
});

describe("?settings=<tab> opens the modal on that tab (MIP-2323)", () => {
    it.each(KEYS)("opens %s and removes the parameter", (key) => {
        renderAt(`/workspace/genos?settings=${key}`);
        expect(screen.getByRole("dialog")).toBeTruthy();
        expect(selectedTab()).toContain(labelOf(key));
        expect(screen.getByTestId("where").textContent).toBe("/workspace/genos");
    });

    it("opens General for an unknown key", () => {
        renderAt("/workspace/genos?settings=nonsense");
        expect(selectedTab()).toContain(labelOf("general"));
        expect(screen.getByTestId("where").textContent).toBe("/workspace/genos");
    });

    it("keeps other query parameters", () => {
        renderAt("/workspace/genos?x=1&settings=security");
        expect(selectedTab()).toContain(labelOf("security"));
        expect(screen.getByTestId("where").textContent).toBe("/workspace/genos?x=1");
    });

    it("does nothing without the parameter", () => {
        renderAt("/workspace/genos");
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("waits for a modal that mounts after the request", () => {
        // Link renders first with no listener yet; the host mounts a moment later.
        const Late = () => {
            const [show, setShow] = useState(false);
            return (
                <>
                    <button onClick={() => setShow(true)}>mount</button>
                    {show && <Host />}
                </>
            );
        };
        render(
            <CssVarsProvider>
                <MemoryRouter initialEntries={["/workspace/genos?settings=security"]}>
                    <Link />
                    <Late />
                </MemoryRouter>
            </CssVarsProvider>
        );
        expect(screen.queryByRole("dialog")).toBeNull();
        act(() => screen.getByText("mount").click());
        expect(selectedTab()).toContain(labelOf("security"));
    });

    it("a stale tab key sent by event opens General, not a blank panel", () => {
        render(
            <CssVarsProvider>
                <MemoryRouter>
                    <Host />
                </MemoryRouter>
            </CssVarsProvider>
        );
        act(() => requestOpenSettings("removedTab"));
        expect(selectedTab()).toContain(labelOf("general"));
    });
});

describe("the parameter survives sign-in (MIP-2323)", () => {
    beforeEach(() => {
        localStorage.removeItem("isSigningIn");
        sessionStorage.clear();
    });
    afterEach(() => sessionStorage.clear());

    const guardAt = (url: string) =>
        render(
            <MemoryRouter initialEntries={[url]}>
                <Routes>
                    <Route element={<AuthGuard />}>
                        <Route element={<div>workspace</div>} path="/workspace/*" />
                    </Route>
                    <Route element={<div>signin</div>} path="/signin" />
                </Routes>
            </MemoryRouter>
        );

    it("a signed-out visit is remembered, then returned to once", async () => {
        guardAt("/workspace/genos?settings=security");
        expect(await screen.findByText("signin")).toBeTruthy();
        // Sign-in goes to the team picker first, so it does not take the link; the picker does.
        expect(takeReturn()).toBeNull();
        expect(takeWorkspaceReturn()).toBe("/workspace?settings=security");
        expect(takeWorkspaceReturn()).toBeNull();
    });

    it("remembers General for an unknown key", async () => {
        guardAt("/workspace?settings=%3Cscript%3E");
        await screen.findByText("signin");
        expect(takeWorkspaceReturn()).toBe("/workspace?settings=general");
    });

    it("remembers nothing for a plain workspace visit", async () => {
        guardAt("/workspace/genos");
        await screen.findByText("signin");
        expect(takeWorkspaceReturn()).toBeNull();
    });

    it("accepts only the exact Settings form as a return path", () => {
        expect(isAllowedReturn("/workspace?settings=security")).toBe(true);
        for (const bad of [
            "/workspace",
            "/workspace?settings=security&next=//evil.example",
            "/workspace?settings=",
            "/workspace/genos?settings=security",
            "//workspace?settings=security",
            "/workspace?settings=a/b",
        ]) {
            expect(isAllowedReturn(bad), bad).toBe(false);
        }
    });
});
