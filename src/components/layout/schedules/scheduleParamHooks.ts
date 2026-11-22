import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../../../context/authState";
import { useHashMentionData } from "../../../context/HashMentionDataContext";
import { loadProjectMilestones } from "../../../features/tasks/sprint-milestone/services/loadProjectMilestones";
import type { Milestone } from "../../../features/tasks/sprint-milestone/types";
import { projectAvatarSrcMap } from "../../../features/tasks/utils/projectAvatar";
import type { ProjectProps } from "../../../types/tasks";

/** The projects the member is in, from the list the app already holds (the `#`
 *  mention data, loaded at sign-in and kept fresh): no request of ours. A
 *  project the member has not joined is left out, as in the Spotlight filter,
 *  because a report cannot read it for them. */
export const useJoinedProjects = (): ProjectProps[] => {
    const { projects } = useHashMentionData();
    return useMemo(() => projects.filter((p) => p.isJoined === true), [projects]);
};

/** The avatars of those projects, resolved the way the Genos search filter gets them
 *  (the project's PM chat image), so a project looks the same in both pickers. */
export const useProjectAvatars = (): Map<number, string> => {
    const { allChats } = useHashMentionData();
    return useMemo(() => projectAvatarSrcMap(allChats), [allChats]);
};

/** The milestones of every joined project. The app holds milestones only for
 *  projects the member has opened, and a picker that listed those alone would
 *  silently miss the rest, so this asks for each project's list once (the same
 *  `/milestone/list/` call the task screens use), when the picker is on screen.
 *  A project whose list fails contributes nothing. */
export const useProjectMilestones = (projects: ProjectProps[]) => {
    const { accessToken } = useAuth();
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    // Some project's list could not be read: an empty picker then is not "no milestones".
    const [failed, setFailed] = useState(false);
    // The effect runs for the SET of projects, not for a new array of the same ones, and a
    // refreshed token must not refetch every list (and flash the picker back to "Loading").
    const projectsRef = useRef(projects);
    projectsRef.current = projects;
    const tokenRef = useRef(accessToken);
    tokenRef.current = accessToken;
    const ids = projects.map((p) => p.projectId).join(",");

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        void Promise.all(
            projectsRef.current.map(async (project) => {
                const res = await loadProjectMilestones(project.projectId, tokenRef.current);
                return { project, milestones: res?.milestones ?? [], ok: !!res };
            })
        ).then((next) => {
            if (cancelled) return;
            setGroups(next.filter((g) => g.milestones.length > 0));
            setFailed(next.some((g) => !g.ok));
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [ids]);

    return { groups, loading, failed };
};

export type Group = { project: ProjectProps; milestones: Milestone[] };
