import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import { todayCalendarIso } from "../../../../utils/calendarDate";
import type { TaskDashboardTab } from "./taskHomeTypes";

/** Where the Tasks area lives. The dashboard is kept mounted while other services show. */
export const TASKS_PATH = "/workspace/tasks";
/** The address-bar parameter that names the open dashboard tab: `?view=today`. */
export const DASHBOARD_VIEW_PARAM = "view";

export const DASHBOARD_TABS: readonly TaskDashboardTab[] = [
    "today",
    "overall",
    "sprint",
    "milestones",
    "mytasks",
    "members",
    "agent",
];

export const isDashboardTab = (v: unknown): v is TaskDashboardTab =>
    typeof v === "string" && (DASHBOARD_TABS as readonly string[]).includes(v);

const storageKey = (userId: string) => `genos.taskStats.lastTab.${userId}`;

/**
 * The tab to open when the address names none: Today on the first open of each day, then
 * the one used last. A per-user, per-browser convenience (localStorage), never state anyone
 * depends on, so a blocked or empty store just means Today.
 */
export const readLastTab = (
    userId: string,
    todayIso: string = todayCalendarIso()
): TaskDashboardTab => {
    try {
        const raw = window.localStorage.getItem(storageKey(userId));
        if (!raw) return "today";
        const saved = JSON.parse(raw) as { tab?: unknown; day?: unknown };
        return saved.day === todayIso && isDashboardTab(saved.tab) ? saved.tab : "today";
    } catch {
        return "today";
    }
};

const writeLastTab = (userId: string, tab: TaskDashboardTab) => {
    try {
        window.localStorage.setItem(
            storageKey(userId),
            JSON.stringify({ tab, day: todayCalendarIso() })
        );
    } catch {
        // Private window or blocked storage: the tab just resets to Today next time.
    }
};

/**
 * The open dashboard tab, kept in the address bar as `?view=<tab>` so a reload or a shared
 * link lands on it (and "Open Today" can link to the Today tab).
 *
 * The Tasks home stays mounted while another service is on screen, so only the tasks route
 * may read the query or write it back (genos-ui rule 6).
 */
export const useDashboardTab = (userId: string) => {
    const location = useLocation();
    const [search, setSearch] = useSearchParams();
    const onTasks = location.pathname.startsWith(TASKS_PATH);
    const viewParam = search.get(DASHBOARD_VIEW_PARAM);
    const pathRef = useRef(location.pathname);
    pathRef.current = location.pathname;

    const [activeTab, setActiveTab] = useState<TaskDashboardTab>(() =>
        isDashboardTab(viewParam) ? viewParam : readLastTab(userId)
    );

    // Address -> tab: a link or the browser's back button names another tab.
    useEffect(() => {
        if (onTasks && isDashboardTab(viewParam) && viewParam !== activeTab) {
            setActiveTab(viewParam);
        }
        // Only an address change may move the tab.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewParam, onTasks]);

    const writeView = (tab: TaskDashboardTab) =>
        setSearch(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.set(DASHBOARD_VIEW_PARAM, tab);
                return next;
            },
            { replace: true }
        );

    // Tab -> address: the user picked a tab.
    useEffect(() => {
        if (!onTasks) return;
        writeLastTab(userId, activeTab);
        if (viewParam !== activeTab) writeView(activeTab);
        // The address is read here only to skip a write that changes nothing.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, onTasks]);

    // A route change (a project pick, a task link) that drops the parameter gets it back.
    useEffect(() => {
        if (onTasks && viewParam === null) writeView(activeTab);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewParam, onTasks]);

    // The dashboard closing (Task Table, Board) takes its parameter with it, so the address
    // never re-opens the dashboard behind the user's back.
    useEffect(
        () => () => {
            if (!pathRef.current.startsWith(TASKS_PATH)) return;
            setSearch(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete(DASHBOARD_VIEW_PARAM);
                    return next;
                },
                { replace: true }
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    return [activeTab, setActiveTab] as const;
};
