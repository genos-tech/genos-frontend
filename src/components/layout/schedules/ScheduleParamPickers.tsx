import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { List, ListDivider, ListItem, Option, Select, Typography } from "@mui/joy";

import { useAuth } from "../../../context/AuthContext";
import { useHashMentionData } from "../../../context/HashMentionDataContext";
import { loadProjectMilestones } from "../../../features/tasks/sprint-milestone/services/loadProjectMilestones";
import type { Milestone } from "../../../features/tasks/sprint-milestone/types";
import { useTranslation } from "../../../i18n";
import type { ProjectProps } from "../../../types/tasks";

/** The projects the member is in, from the list the app already holds (the `#`
 *  mention data, loaded at sign-in and kept fresh): no request of ours. A
 *  project the member has not joined is left out, as in the Spotlight filter,
 *  because a report cannot read it for them. */
export const useJoinedProjects = (): ProjectProps[] => {
    const { projects } = useHashMentionData();
    return useMemo(() => projects.filter((p) => p.isJoined === true), [projects]);
};

type Props = {
    /** The stored value: an id as text, "" when nothing is chosen. */
    value: string;
    onChange: (next: string) => void;
    "aria-labelledby"?: string;
};

/** The optional project parameter: "All projects" or one project, by name. */
export const ProjectParamSelect = ({ value, onChange }: Props) => {
    const { t } = useTranslation();
    const s = t.settings.schedules;
    const projects = useJoinedProjects();
    const known = projects.some((p) => String(p.projectId) === value);
    return (
        <Select sx={{ minWidth: 0 }} value={value} onChange={(_, v) => onChange(v ?? "")}>
            <Option value="">{s.allProjects}</Option>
            {value !== "" && !known && <Option value={value}>{s.unavailable}</Option>}
            {projects.map((p) => (
                <Option key={p.projectId} value={String(p.projectId)}>
                    {p.projectName}
                </Option>
            ))}
        </Select>
    );
};

type Group = { project: ProjectProps; milestones: Milestone[] };

/** The milestones of every joined project. The app holds milestones only for
 *  projects the member has opened, and a picker that listed those alone would
 *  silently miss the rest, so this asks for each project's list once (the same
 *  `/milestone/list/` call the task screens use), when the picker is on screen.
 *  A project whose list fails contributes nothing. */
export const useProjectMilestones = (projects: ProjectProps[]) => {
    const { accessToken } = useAuth();
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    // The effect runs for the SET of projects, not for a new array of the same ones.
    const projectsRef = useRef(projects);
    projectsRef.current = projects;
    const ids = projects.map((p) => p.projectId).join(",");

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        void Promise.all(
            projectsRef.current.map(async (project) => {
                const res = await loadProjectMilestones(project.projectId, accessToken);
                return { project, milestones: res?.milestones ?? [] };
            })
        ).then((next) => {
            if (cancelled) return;
            setGroups(next.filter((g) => g.milestones.length > 0));
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [ids, accessToken]);

    return { groups, loading };
};

/** The required milestone parameter: a milestone by name, grouped by project. */
export const MilestoneParamSelect = ({ value, onChange }: Props) => {
    const { t } = useTranslation();
    const s = t.settings.schedules;
    const projects = useJoinedProjects();
    const { groups, loading } = useProjectMilestones(projects);

    // A finished milestone is not worth a report, but one that is already chosen stays listed.
    const shown = groups
        .map((g) => ({
            ...g,
            milestones: g.milestones.filter(
                (m) => m.status !== "Closed" || String(m.milestoneId) === value
            ),
        }))
        .filter((g) => g.milestones.length > 0);
    const known = shown.some((g) => g.milestones.some((m) => String(m.milestoneId) === value));

    return (
        <Select
            placeholder={loading ? s.milestoneLoading : s.milestonePlaceholder}
            sx={{ minWidth: 0 }}
            value={value === "" ? null : value}
            onChange={(_, v) => onChange(v ?? "")}
        >
            {value !== "" && !known && (
                <Option value={value}>{loading ? s.milestoneLoading : s.unavailable}</Option>
            )}
            {!loading && shown.length === 0 && value === "" && (
                <Typography level="body-sm" sx={{ px: 1.5, py: 1 }}>
                    {s.milestoneNone}
                </Typography>
            )}
            {shown.map((group, i) => (
                <Fragment key={group.project.projectId}>
                    {i > 0 && <ListDivider role="none" />}
                    <List aria-labelledby={`schedule-ms-group-${group.project.projectId}`}>
                        <ListItem id={`schedule-ms-group-${group.project.projectId}`} sticky>
                            <Typography level="body-xs" sx={{ textTransform: "uppercase" }}>
                                {group.project.projectName}
                            </Typography>
                        </ListItem>
                        {group.milestones.map((m) => (
                            <Option
                                key={m.milestoneId}
                                label={`${group.project.projectName} / ${m.title}`}
                                value={String(m.milestoneId)}
                            >
                                {m.title}
                            </Option>
                        ))}
                    </List>
                </Fragment>
            ))}
        </Select>
    );
};
