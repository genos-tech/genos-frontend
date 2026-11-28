import { useEffect, useState } from "react";

import { useAuth } from "../../../context/authState";
import { useHashMentionData } from "../../../context/HashMentionDataContext";
import type { RuleMoveNotice } from "../../../types/chat";
import type { TaskProps } from "../../../types/tasks";
import { loadSpecificTask } from "../../tasks/services/loadSpecificTask";

/**
 * What THIS viewer may be told about a task a rule moved away (MIP-2500). The stored line holds
 * ids only, because the new project may have fewer readers than the old chat.
 *
 * The project is named only to someone who has joined it. The task is asked of the server every
 * time (`forceRefresh`): the copy cached in this browser while it was still in the old project
 * would show its title to someone who can no longer open it. A refusal reads as "nothing".
 */
export type RuleMoveRefs = {
    task: { title: string; displayId: string } | null;
    projectName: string | null;
};

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; load: Promise<TaskProps | null> }>();

export const clearRuleMoveRefs = (): void => cache.clear();

export const useRuleMoveRefs = (notice: RuleMoveNotice): RuleMoveRefs => {
    const { accessToken } = useAuth();
    const { myself, projects } = useHashMentionData();
    const [task, setTask] = useState<RuleMoveRefs["task"]>(null);
    const { projectId, taskId } = notice;

    useEffect(() => {
        setTask(null);
        if (!myself || !accessToken) return;
        let cancelled = false;
        const key = `${myself.userId}:${myself.teamId}:${projectId}:${taskId}`;
        let hit = cache.get(key);
        if (!hit || Date.now() - hit.at >= TTL_MS) {
            hit = {
                at: Date.now(),
                load: loadSpecificTask(myself, projectId, taskId, accessToken, {
                    forceRefresh: true,
                }).then((rows) => rows[0] ?? null),
            };
            cache.set(key, hit);
        }
        void hit.load.then((row) => {
            if (!cancelled && row) {
                setTask({ displayId: row.displayId || "", title: row.title || "" });
            }
        });
        return () => {
            cancelled = true;
        };
    }, [myself, accessToken, projectId, taskId]);

    const project = projects.find((p) => Number(p.projectId) === projectId && p.isJoined === true);
    return { projectName: project?.projectName ?? null, task };
};
