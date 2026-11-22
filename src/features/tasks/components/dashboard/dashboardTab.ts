import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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
 * On the tasks route the address IS the tab: it is read straight from `?view=`, so a link,
 * Back, or arriving from another service with a new `view` can never be undone by a stale
 * local copy. The kept-mounted Home (genos-ui rule 6) only touches the address on that route.
 */
export const useDashboardTab = (userId: string) => {
    const location = useLocation();
    const navigate = useNavigate();
    const onTasks = location.pathname.startsWith(TASKS_PATH);
    const viewParam = new URLSearchParams(location.search).get(DASHBOARD_VIEW_PARAM);
    const [localTab, setLocalTab] = useState<TaskDashboardTab>(() =>
        isDashboardTab(viewParam) ? viewParam : readLastTab(userId)
    );
    const activeTab: TaskDashboardTab =
        onTasks && isDashboardTab(viewParam) ? viewParam : localTab;

    // The latest address, for the writes and the cleanup below (never a stale render's).
    const latest = useRef({ pathname: location.pathname, search: location.search });
    latest.current = { pathname: location.pathname, search: location.search };

    const writeView = (tab: TaskDashboardTab | null) => {
        const { pathname, search } = latest.current;
        const next = new URLSearchParams(search);
        if (tab) next.set(DASHBOARD_VIEW_PARAM, tab);
        else next.delete(DASHBOARD_VIEW_PARAM);
        const qs = next.toString();
        navigate({ pathname, search: qs ? `?${qs}` : "" }, { replace: true });
    };

    const setActiveTab = (tab: TaskDashboardTab) => {
        setLocalTab(tab);
        if (onTasks) writeView(tab);
    };

    // The address names a tab: remember it (and keep the local copy for off-route renders).
    useEffect(() => {
        if (!onTasks || !isDashboardTab(viewParam)) return;
        setLocalTab(viewParam);
        writeLastTab(userId, viewParam);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewParam, onTasks]);

    // The address names none (a route change dropped it): put the open tab back.
    useEffect(() => {
        if (onTasks && !isDashboardTab(viewParam)) writeView(localTab);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewParam, onTasks]);

    // The dashboard closing (Task Table, Board) takes its parameter with it, so the address
    // never re-opens the dashboard behind the user's back. It keeps the CURRENT path and query.
    useEffect(
        () => () => {
            if (!latest.current.pathname.startsWith(TASKS_PATH)) return;
            writeView(null);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    return [activeTab, setActiveTab] as const;
};
