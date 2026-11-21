/* eslint-disable react-refresh/only-export-components -- a page entry, nothing imports it */
/**
 * The page the real-browser probe loads (`DependenciesPhoneMIP1580.test.ts`): the REAL
 * `ModalManageDependencies` (so the real `ACTaskSelector`, `ModalFrame`, `TaskIdentityRow`) inside
 * the app's theme, with seeded tasks (long titles, one milestone) and no backend. Nothing imports
 * this file; Vite only serves it to the probe.
 *
 * `?mode=dark` selects the dark scheme. A pick is logged on `window.__added` as "blocker>blocked".
 */
import "@fontsource-variable/geist/index.css";
import "../../index.css";

import { useEffect } from "react";
import { useColorScheme } from "@mui/joy/styles";
import { createRoot } from "react-dom/client";

import { ModalManageDependencies } from "../../features/tasks/components/modals/ModalManageDependencies";
import { I18nProvider } from "../../i18n";
import { ColorThemeProvider } from "../../theme/ColorThemeProvider";

const task = (id: number, title: string, status: string, isMilestone = false) => ({
    id: String(id),
    displayId: `GEN-${id}`,
    title,
    status,
    projectId: 1,
    isMilestone,
    parentTaskId: null,
});
const TITLES: [string, string, boolean][] = [
    [
        "Migrate the notification delivery pipeline to the new queue and backfill every historical subscription record",
        "Open",
        false,
    ],
    [
        "Fix the extremely long task title that wraps over several lines on a narrow phone screen",
        "WIP",
        false,
    ],
    ["Q4 launch milestone", "WIP", true],
    ["Short", "Open", false],
    [
        "Review accessibility of the manage dependencies dialog on iOS Safari and Android",
        "WIP",
        false,
    ],
    ["Another quite long title about reworking the onboarding flow end to end", "WIP", false],
    ["Task seven", "Open", false],
    ["Task eight", "WIP", false],
];
const ROWS = TITLES.map(([title, status, ms], i) => task(100 + i, title, status, ms));
const PROJECTS = [
    { projectId: 1, projectName: "Genos platform rewrite", projectTags: [] },
    { projectId: 2, projectName: "Website", projectTags: [] },
];
const dep = (id: number, title: string, isMilestone = false) => ({
    dependencyId: id,
    otherTaskId: id,
    displayId: `GEN-${id}`,
    projectId: 1,
    projectName: "Genos platform rewrite",
    title,
    status: { code: 1, status: "Open", color: null, textColor: null },
    assigneeUserId: null,
    isMilestone,
});

const w = window as unknown as { __added: string[] };
w.__added = [];

const usePM = { teamProjects: PROJECTS, currentProject: PROJECTS[0] } as never;
const useTM = {
    allTasks: ROWS,
    taskDependencies: {
        1: {
            blocking: [dep(50, TITLES[0][0])],
            blockedBy: [dep(51, "Q4 launch milestone", true)],
        },
    },
    addTaskDependency: async (a: { blockerTaskId: number; blockedTaskId: number }) => {
        w.__added.push(`${a.blockerTaskId}>${a.blockedTaskId}`);
        return { ok: true };
    },
    removeTaskDependency: async () => true,
    refreshTaskStatuses: async () => {},
} as never;
const HOST = { id: 1, title: "Host", project: PROJECTS[0] } as never;

const Page = () => {
    const { setMode } = useColorScheme();
    const mode =
        new URLSearchParams(window.location.search).get("mode") === "dark" ? "dark" : "light";
    useEffect(() => setMode(mode), [mode, setMode]);
    return (
        <ModalManageDependencies
            myself={{ teamId: "t" } as never}
            taskContent={HOST}
            useCM={undefined}
            usePM={usePM}
            useTM={useTM}
            open
            onClose={() => {}}
        />
    );
};

createRoot(document.getElementById("root")!).render(
    <ColorThemeProvider>
        <I18nProvider>
            <Page />
        </I18nProvider>
    </ColorThemeProvider>
);
