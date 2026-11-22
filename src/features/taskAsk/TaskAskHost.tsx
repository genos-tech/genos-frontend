// The window "Ask Genos about this task or milestone" opens (MIP-1057, AGENT_PARITY_TOOLS).
//
// It lives at the App root and listens for `genos:ask-about-task` (`taskAskLink`), so the menus that
// raise it (a task's and a milestone's "..." menu) know nothing of it. One instance for the whole app:
// the conversation it holds is the task's own, and it is a separate machine from the Cmd-K / Genos page
// conversation (`useSpotlight`), which this never reads or writes.
//
// It sits inside the provider tree (the mention picker of its input needs the hash-mention data, the
// avatars and the link-preview modal), next to `CalendarEventLinkHost`.

import { memo, useCallback, useEffect, useRef } from "react";

import { useAuth } from "../../context/authState";
import type { ProjectProps } from "../../types/tasks";
import type { SpotlightResult } from "../spotlight/types";
import { onAskGenosAboutTask } from "./taskAskLink";
import { TaskAskModal } from "./TaskAskModal";
import { resolveTaskTeamId } from "./taskAskTarget";
import { useTaskAsk } from "./useTaskAsk";

interface TaskAskHostProps {
    /** The team the person is looking at. */
    teamId: string | null | undefined;
    /** That team's projects: where the host team of a shared project is known. */
    projects: ReadonlyArray<Pick<ProjectProps, "projectId" | "isExternal" | "hostTeamId">>;
    /** A citation with no preview to open: the app navigates to it. */
    onSelectSource?: (source: SpotlightResult) => void;
    /** The general Ask, with `draft` as its draft (the window closes itself first). */
    onAskInGeneral?: (draft?: string) => void;
}

const TaskAskHostInner = ({
    teamId,
    projects,
    onSelectSource,
    onAskInGeneral,
}: TaskAskHostProps) => {
    const { accessToken } = useAuth();
    const state = useTaskAsk({ accessToken, teamId });

    // Read at the moment a request arrives, so the listener is attached once.
    const latest = useRef({ projects, teamId, open: state.open });
    latest.current = { projects, teamId, open: state.open };
    useEffect(
        () =>
            onAskGenosAboutTask((request) => {
                const { projects: known, teamId: current, open } = latest.current;
                const taskTeamId = resolveTaskTeamId(request.projectId, known, current);
                if (!taskTeamId) return;
                open({
                    taskId: request.taskId,
                    teamId: taskTeamId,
                    displayId: request.displayId,
                    title: request.title,
                    isMilestone: request.isMilestone,
                });
            }),
        []
    );

    // A citation the app has to navigate to leaves this window behind it (a preview, which opens over
    // it, does not come here).
    const { close } = state;
    const selectSource = useCallback(
        (source: SpotlightResult) => {
            close();
            onSelectSource?.(source);
        },
        [close, onSelectSource]
    );

    return (
        <TaskAskModal
            state={state}
            onAskInGeneral={onAskInGeneral}
            onSelectSource={selectSource}
        />
    );
};

// The App root re-renders often; this is idle until a menu asks, so it only follows its own props.
export const TaskAskHost = memo(TaskAskHostInner);
