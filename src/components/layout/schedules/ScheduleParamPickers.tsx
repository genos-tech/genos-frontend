import { useEffect, useMemo, useRef, useState } from "react";
import {
    Autocomplete,
    AutocompleteOption,
    List,
    ListItem,
    ListSubheader,
    Typography,
} from "@mui/joy";
import { useTheme } from "@mui/joy/styles";

import { useAuth } from "../../../context/AuthContext";
import { useHashMentionData } from "../../../context/HashMentionDataContext";
import {
    isSameProject,
    projectListboxSlotProps,
    projectOptionLabel,
    renderProjectOption,
} from "../../../features/tasks/components/autocompletes/ProjectPickerParts";
import {
    ProjectIdentityDecorator,
    ProjectIdentityRow,
} from "../../../features/tasks/components/ProjectIdentityRow";
import { loadProjectMilestones } from "../../../features/tasks/sprint-milestone/services/loadProjectMilestones";
import type { Milestone } from "../../../features/tasks/sprint-milestone/types";
import { projectAvatarSrcMap } from "../../../features/tasks/utils/projectAvatar";
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

/** The avatars of those projects, resolved the way the Genos search filter gets them
 *  (the project's PM chat image), so a project looks the same in both pickers. */
export const useProjectAvatars = (): Map<number, string> => {
    const { allChats } = useHashMentionData();
    return useMemo(() => projectAvatarSrcMap(allChats), [allChats]);
};

/** A dropdown is portaled to <body>, so it must clear the dialog it opens from. Both
 *  hosts of the schedules (Settings, the Genos page's dialog) are Joy modals, and a
 *  Joy modal's own popups sit one above its layer. */
const useDialogPopupZIndex = (): number => useTheme().zIndex.modal + 1;

type Props = {
    /** The stored value: an id as text, "" when nothing is chosen. */
    value: string;
    onChange: (next: string) => void;
    "aria-labelledby"?: string;
};

// Stand-in ids for the two rows that are not a project. Real ids start at 1.
const ALL_PROJECTS_ID = 0;
const UNAVAILABLE_ID = -1;

/** The optional project parameter: "All projects" or one project, by name. The same
 *  dropdown, rows and avatars as the project filter under the Genos search box
 *  (`ProjectPickerParts`), here as a single choice. */
export const ProjectParamSelect = ({ value, onChange }: Props) => {
    const { t } = useTranslation();
    const s = t.settings.schedules;
    const projects = useJoinedProjects();
    const avatars = useProjectAvatars();
    const popupZIndex = useDialogPopupZIndex();

    const all: ProjectProps = {
        projectId: ALL_PROJECTS_ID,
        projectName: s.allProjects,
        projectTags: [],
    };
    const known = projects.some((p) => String(p.projectId) === value);
    // A stored id the member can no longer see stays selectable so the form can show it.
    const unavailable: ProjectProps | null =
        value !== "" && !known
            ? { projectId: UNAVAILABLE_ID, projectName: s.unavailable, projectTags: [] }
            : null;
    const options = [all, ...(unavailable ? [unavailable] : []), ...projects];
    const selected =
        value === ""
            ? all
            : (unavailable ?? projects.find((p) => String(p.projectId) === value) ?? all);

    return (
        <Autocomplete<ProjectProps, false, true, false>
            getOptionLabel={(option) => projectOptionLabel(option)}
            isOptionEqualToValue={(option, value) => isSameProject(option, value)}
            options={options}
            renderOption={renderProjectOption(avatars)}
            slotProps={projectListboxSlotProps(popupZIndex)}
            sx={{ minWidth: 0 }}
            value={selected}
            startDecorator={
                // The closed field is a text input, so only the name fits in it: the
                // avatar rides beside it, as in the task pickers.
                selected.projectId > ALL_PROJECTS_ID ? (
                    <ProjectIdentityDecorator
                        avatarSrc={avatars.get(selected.projectId)}
                        project={selected}
                    />
                ) : undefined
            }
            disableClearable
            onChange={(_, option) => {
                if (option.projectId === UNAVAILABLE_ID) return;
                onChange(option.projectId === ALL_PROJECTS_ID ? "" : String(option.projectId));
            }}
        />
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

// One row of the milestone dropdown. `group` is the owning project's id as text ("" for
// the stand-in row of a milestone that can no longer be listed).
type MilestoneOption = { id: string; title: string; label: string; group: string };

/** The required milestone parameter: a milestone by name, grouped by project. The same
 *  field, dropdown and project rows (avatar, name) as the project picker above. */
export const MilestoneParamSelect = ({ value, onChange }: Props) => {
    const { t } = useTranslation();
    const s = t.settings.schedules;
    const projects = useJoinedProjects();
    const avatars = useProjectAvatars();
    const popupZIndex = useDialogPopupZIndex();
    const { groups, loading, failed } = useProjectMilestones(projects);

    // A finished milestone is not worth a report, but one that is already chosen stays listed.
    const options: MilestoneOption[] = groups.flatMap((g) =>
        g.milestones
            .filter((m) => m.status !== "Closed" || String(m.milestoneId) === value)
            .map((m) => ({
                id: String(m.milestoneId),
                title: m.title,
                label: `${g.project.projectName} / ${m.title}`,
                group: String(g.project.projectId),
            }))
    );
    const known = options.some((o) => o.id === value);
    // A stored milestone that is not listed: "Loading" while the lists are on their way (it
    // may be among them), "(unavailable)" once they are in and it is not.
    const stray: MilestoneOption | null =
        value !== "" && !known
            ? {
                  id: value,
                  title: loading ? s.milestoneLoading : s.unavailable,
                  label: loading ? s.milestoneLoading : s.unavailable,
                  group: "",
              }
            : null;
    const all = stray ? [stray, ...options] : options;
    const projectById = new Map(projects.map((p) => [String(p.projectId), p]));

    return (
        <Autocomplete<MilestoneOption, false, false, false>
            getOptionLabel={(o) => o.label}
            groupBy={(o) => o.group}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            loading={loading}
            loadingText={s.milestoneLoading}
            noOptionsText={failed ? s.milestoneLoadFailed : s.milestoneNone}
            options={all}
            placeholder={loading ? s.milestoneLoading : s.milestonePlaceholder}
            slotProps={projectListboxSlotProps(popupZIndex)}
            sx={{ minWidth: 0 }}
            value={all.find((o) => o.id === value) ?? null}
            renderGroup={({ key, group, children }) => {
                const project = projectById.get(group);
                return (
                    <ListItem key={key} nested>
                        {project && (
                            <ListSubheader
                                sticky
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    minWidth: 0,
                                    // The group header is the project row, as in the project
                                    // dropdown: not Joy's small uppercase subheader.
                                    textTransform: "none",
                                    letterSpacing: 0,
                                }}
                            >
                                <ProjectIdentityRow
                                    avatarSrc={avatars.get(project.projectId)}
                                    maxLabels={2}
                                    project={project}
                                />
                            </ListSubheader>
                        )}
                        <List>{children}</List>
                    </ListItem>
                );
            }}
            renderOption={(optionProps, option) => (
                <AutocompleteOption {...optionProps} key={option.id}>
                    <Typography level="body-sm" noWrap sx={{ color: "inherit", minWidth: 0 }}>
                        {option.title}
                    </Typography>
                </AutocompleteOption>
            )}
            onChange={(_, option) => onChange(option ? option.id : "")}
        />
    );
};
