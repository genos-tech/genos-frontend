import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../../../context/authState";
import { useHashMentionData } from "../../../context/HashMentionDataContext";
import { loadMyNoteFolders } from "../../../features/notes/my-notes/services/loadMyNoteFolders";
import { loadTeamNoteFolders } from "../../../features/notes/team-notes/services/loadTeamNoteFolders";
import { loadProjectMilestones } from "../../../features/tasks/sprint-milestone/services/loadProjectMilestones";
import type { Milestone } from "../../../features/tasks/sprint-milestone/types";
import { projectAvatarSrcMap } from "../../../features/tasks/utils/projectAvatar";
import type { MyNoteFolderProps, TeamNoteFolderProps } from "../../../types/notes";
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

/** The member's own note folders and the team folders they can reach, for the dashboard "Save to"
 *  picker (MIP-2357): the two lists the Notes sidebar reads, asked for once when the picker is on
 *  screen. The API filters the team list to what the member may open; which of those they may add
 *  notes to is decided from each folder's role (`noteFolderChoices`). A failed team list is told
 *  apart from "no team folders", so an empty picker is never mistaken for an answer. */
export const useNoteFolders = () => {
    const { accessToken } = useAuth();
    const { myself } = useHashMentionData();
    const [state, setState] = useState<{
        mine: MyNoteFolderProps[];
        team: TeamNoteFolderProps[];
        loading: boolean;
        failed: boolean;
    }>({ mine: [], team: [], loading: true, failed: false });
    // A refreshed token must not refetch both lists and flash the picker back to "Loading".
    const tokenRef = useRef(accessToken);
    tokenRef.current = accessToken;
    const meRef = useRef(myself);
    meRef.current = myself;
    const teamId = myself?.teamId;
    const userId = myself?.userId;

    useEffect(() => {
        const me = meRef.current;
        if (!me) {
            setState({ mine: [], team: [], loading: false, failed: false });
            return undefined;
        }
        let cancelled = false;
        setState((cur) => ({ ...cur, loading: true }));
        void Promise.all([
            loadMyNoteFolders(me, tokenRef.current),
            loadTeamNoteFolders(me, tokenRef.current),
        ]).then(([mine, team]) => {
            if (cancelled) return;
            setState({ mine, team: team ?? [], loading: false, failed: team === undefined });
        });
        return () => {
            cancelled = true;
        };
    }, [teamId, userId]);

    return state;
};
