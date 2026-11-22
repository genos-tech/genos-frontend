import { startTransition } from "react";

import { beginMilestoneSwitch } from "../../state/milestoneSwitchStore";
import type { SidebarTreePM, SidebarTreeTM } from "./useSidebarSlices";

/**
 * What clicking a milestone in the task sidebar does, shared by the project tree
 * and the Favorites list (MIP-1053) so the two cannot drift: switch to the
 * milestone's project if another one is open, show the milestone's preview, and
 * scope the task table / sprint board to it.
 *
 * A second click on the milestone that is already scoped (in the same project)
 * lifts the scope again; a click that changes project always scopes on.
 */
export const openMilestoneFromSidebar = (
    { usePM, useTM }: { usePM: SidebarTreePM; useTM: SidebarTreeTM },
    milestoneId: number,
    projectId: number
) => {
    const needsProjectSwitch = projectId !== usePM.currentProject?.projectId;
    const target = needsProjectSwitch
        ? usePM.teamProjects?.find((p) => p.projectId === projectId)
        : undefined;
    if (needsProjectSwitch && !target) return;
    const isAlreadyScoped = !needsProjectSwitch && useTM.tableMilestoneFilterId === milestoneId;

    // MIP-1972: the click paints at once (the table's loading skeleton), then the page's
    // own state moves in a transition. Without this the whole task page re-rendered inside
    // the click (about a second on a big project) with the old milestone's rows on screen.
    // A second click that lifts the scope is a plain rebuild: nothing to wait behind.
    if (!isAlreadyScoped) beginMilestoneSwitch(milestoneId);
    startTransition(() => {
        // If the clicked milestone belongs to a different project than the one in focus,
        // switch projects first. MilestonePreviewInner resolves the milestone via
        // `useSM.projectMilestones[currentProject.projectId]` (TaskPreview.tsx:913-919), so
        // without the switch it would never find the milestone and would fall back to the
        // "Loading milestone…" branch that auto-closes after 3s.
        if (target) {
            // Close the existing preview first: while `isTaskPreviewVisible` is true,
            // useTaskRouting's URL-update effect skips its navigate(), which leaves
            // `targetUrlProjectId.current` stale and lets the enforce-match effect revert the
            // project switch.
            useTM.closeTaskPreview();
            useTM.setTableMilestoneFilter(null);
            // Set in this click, not after the project list and the tasks have been awaited.
            // The preview and the scope below are set in the same commit; the milestone is
            // already in the sidebar's list, so the preview finds it.
            usePM.openProject(target);
        }

        // Open the milestone preview AND scope the task table to this milestone (its backing
        // task as the root + its children).
        useTM.setCurrentPreviewKind("milestone");
        useTM.setCurrentPreviewMilestoneId(milestoneId);
        useTM.setIsTaskPreviewVisible(true);
        // Stamped with the milestone's own project, so the scope deactivates itself if the
        // user navigates elsewhere.
        useTM.setTableMilestoneFilter(isAlreadyScoped ? null : { milestoneId, projectId });
    });
};
