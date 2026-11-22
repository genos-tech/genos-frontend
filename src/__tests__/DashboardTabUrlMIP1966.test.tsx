import { act, render } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import {
    isDashboardTab,
    readLastTab,
    useDashboardTab,
} from "../features/tasks/components/dashboard/dashboardTab";

let seenSearch = "";
let setTab: ((t: "today" | "overall" | "agent") => void) | null = null;
let currentTab = "";
let seenPath = "";
let go: ((to: string) => void) | null = null;

const Probe = () => {
    const location = useLocation();
    seenSearch = location.search;
    seenPath = location.pathname;
    go = useNavigate();
    const [tab, set] = useDashboardTab("u1");
    currentTab = tab;
    setTab = set;
    return null;
};

const mount = (entry: string) =>
    render(
        <MemoryRouter initialEntries={[entry]}>
            <Probe />
        </MemoryRouter>
    );

beforeEach(() => {
    window.localStorage.clear();
});

describe("the dashboard tab in the address (MIP-1966, MIP-1963)", () => {
    it("knows its tabs", () => {
        expect(isDashboardTab("today")).toBe(true);
        expect(isDashboardTab("agent")).toBe(true);
        expect(isDashboardTab("nope")).toBe(false);
        expect(isDashboardTab(null)).toBe(false);
    });

    it("opens the tab the address names, and keeps it there", () => {
        mount("/workspace/tasks?view=overall");
        expect(currentTab).toBe("overall");
        expect(seenSearch).toBe("?view=overall");
    });

    it("opens on Today on the first open of a day and writes it to the address", () => {
        mount("/workspace/tasks");
        expect(currentTab).toBe("today");
        expect(seenSearch).toBe("?view=today");
    });

    it("writes a picked tab to the address and remembers it for today", () => {
        mount("/workspace/tasks");
        act(() => setTab?.("agent"));
        expect(currentTab).toBe("agent");
        expect(seenSearch).toBe("?view=agent");
        expect(readLastTab("u1")).toBe("agent");
    });

    it("reopens on the last tab used the same day, and on Today the next day", () => {
        mount("/workspace/tasks");
        act(() => setTab?.("overall"));
        expect(readLastTab("u1")).toBe("overall");
        expect(readLastTab("u1", "2999-01-01")).toBe("today");
        expect(readLastTab("someone-else")).toBe("today");
    });

    it("an address that names a tab beats the remembered one", () => {
        window.localStorage.setItem(
            "genos.taskStats.lastTab.u1",
            JSON.stringify({ tab: "agent", day: "2999-01-01" })
        );
        mount("/workspace/tasks?view=overall");
        expect(currentTab).toBe("overall");
    });

    it("does not touch the address while another service is on screen (kept mounted)", () => {
        mount("/workspace/chats");
        expect(seenSearch).toBe("");
    });

    it("survives a blocked store", () => {
        const spy = Object.getOwnPropertyDescriptor(window, "localStorage");
        Object.defineProperty(window, "localStorage", {
            configurable: true,
            get: () => {
                throw new Error("blocked");
            },
        });
        try {
            expect(readLastTab("u1")).toBe("today");
        } finally {
            if (spy) Object.defineProperty(window, "localStorage", spy);
        }
    });
});

describe("Open Today (MIP-1966)", () => {
    it("the Genos page links to the Today tab, not the bare Tasks route", async () => {
        const { readFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const src = readFileSync(join(__dirname, "../features/genos/GenosHome.tsx"), "utf8");
        expect(src).toContain('requestAppNavigate("/workspace/tasks?view=today")');
    });

    it("the Tasks home opens the dashboard for a view link", async () => {
        const { readFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const src = readFileSync(join(__dirname, "../features/tasks/taskHome.tsx"), "utf8");
        expect(src).toContain("isDashboardTab(requestedView)");
        expect(src).toContain("setIsTaskDashboardVisible(true)");
    });

    it("follows a new ?view when coming back from another service (Open Today)", () => {
        mount("/workspace/tasks?view=overall");
        act(() => go?.("/workspace/genos"));
        act(() => go?.("/workspace/tasks?view=today"));
        expect(currentTab).toBe("today");
        expect(seenSearch).toBe("?view=today");
    });

    it("on closing, keeps the current path and query and drops only view", () => {
        const { unmount } = render(
            <MemoryRouter initialEntries={["/workspace/tasks?view=today"]}>
                <Probe />
            </MemoryRouter>
        );
        act(() => go?.("/workspace/tasks/project/5/task/9?view=today&x=1"));
        const before = seenPath;
        expect(before).toBe("/workspace/tasks/project/5/task/9");
        unmount();
        expect(before).toBeTruthy();
    });
});
