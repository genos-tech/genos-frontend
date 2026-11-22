/* eslint-disable react-refresh/only-export-components -- a page entry, nothing imports it */
/**
 * The page the real-browser probe loads (`MobileTaskHomeArchiveMIP1854.test.ts`): the REAL
 * `MobileTaskHome` (phone header, archive banner, Archive menu, read-only list) inside the app's
 * theme and router, with a seeded project and tasks and no backend. Nothing imports this file.
 *
 * Query: `?mode=dark`, `?lang=ja`, `?archived=0` (live project), `?owner=0` (not the owner).
 */
import "@fontsource-variable/geist/index.css";
import "../../index.css";

import { useEffect } from "react";
import { useColorScheme } from "@mui/joy/styles";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

import { setArchivedProjects } from "../../features/archive/archiveState";
import { MobileTaskHome } from "../../features/tasks/MobileTaskHome";
import { I18nProvider } from "../../i18n";
import { persistLocale } from "../../i18n/localeSource";
import { ColorThemeProvider } from "../../theme/ColorThemeProvider";

const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") === "dark" ? "dark" : "light";
const lang = params.get("lang") === "ja" ? "ja" : "en";
const archived = params.get("archived") !== "0";
const owner = params.get("owner") !== "0";
persistLocale(lang);

const PROJECT = {
    projectId: 1,
    projectName: "Genos platform rewrite",
    projectTags: [],
    projectLabels: [],
    isPrivate: false,
    isJoined: true,
    archived,
    archivedAt: archived ? "2026-11-21T00:00:00Z" : null,
};
setArchivedProjects(archived ? [PROJECT] : []);

const task = (id: number, title: string) => ({
    id: String(id),
    displayId: `GEN-${id}`,
    projectId: 1,
    parentTaskId: null,
    title,
    status: "Open",
    assigneeUserId: null,
    isMilestone: false,
});
const TASKS = [
    task(11, "Draft the launch checklist for the archive feature"),
    task(12, "Review the read-only banner copy with counsel before release"),
];

const ME = { userId: "me", teamId: "team-1" } as never;
const usePM = {
    currentProject: PROJECT,
    teamProjects: archived ? [] : [PROJECT],
    setTeamProjects: () => {},
    setCurrentProject: () => {},
    refreshProjectTasks: async () => {},
    setOpenCreateProject: () => {},
} as never;
const useTM = {
    allTasks: TASKS,
    taskFieldRules: owner
        ? { projectId: 1, ownerUserId: "me" }
        : { projectId: 1, ownerUserId: "x" },
    isTaskDashboardVisible: false,
    setIsTaskDashboardVisible: () => {},
    isCreatingTask: { flag: false },
    setIsCreatingTask: () => {},
    isTaskPreviewVisible: false,
    setIsTaskPreviewVisible: () => {},
    currentPreviewTask: null,
    currentPreviewTaskId: -1,
    currentPreviewKind: "task",
    setCurrentPreviewTaskId: () => {},
    setCurrentPreviewTask: () => {},
    handleCreateTask: () => {},
    setOpenManageTags: () => {},
    setCurrentTaskId: () => {},
    setTaskRouteHistory: () => {},
    setCurrentTaskDetailData: () => {},
} as never;
const useNM = {
    tabItems: [],
    selectedTabIndex: 0,
    currentNoteType: 0,
    isTaskNotePaneVisible: false,
    currentTaskNoteChain: null,
} as never;
const none = {} as never;

const Page = () => {
    const { setMode } = useColorScheme();
    useEffect(() => setMode(mode), [setMode]);
    return (
        <MemoryRouter initialEntries={["/workspace/tasks/project/1"]}>
            <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
                <MobileTaskHome
                    myself={ME}
                    setMyself={() => {}}
                    setOpenJoinProject={() => {}}
                    socket={null}
                    useCM={none}
                    useNM={useNM}
                    usePM={usePM}
                    useSM={none}
                    useTEM={none}
                    useTM={useTM}
                    useUISM={none}
                    isActiveRoute
                    onCloseTaskHome={() => {}}
                />
            </div>
        </MemoryRouter>
    );
};

createRoot(document.getElementById("root")!).render(
    <ColorThemeProvider>
        <I18nProvider>
            <Page />
        </I18nProvider>
    </ColorThemeProvider>
);
