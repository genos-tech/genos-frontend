import {
    Autocomplete,
    AutocompleteOption,
    Box,
    createFilterOptions,
    List,
    ListItem,
    ListSubheader,
    Option,
    Select,
    Typography,
} from "@mui/joy";
import { useTheme } from "@mui/joy/styles";

import { useHashMentionData } from "../../../context/HashMentionDataContext";
import { useRunnableSkillRows } from "../../../features/genos/skills/useRunnableSkills";
import {
    isSameProject,
    projectListboxSlotProps,
    projectOptionLabel,
    renderProjectOption,
} from "../../../features/tasks/components/autocompletes/ProjectPickerParts";
import { StatusLabel } from "../../../features/tasks/components/meta/StatusLabel";
import {
    ProjectIdentityDecorator,
    ProjectIdentityRow,
} from "../../../features/tasks/components/ProjectIdentityRow";
import { toneCss } from "../../../features/tasks/meta/taskTone";
import type { Milestone } from "../../../features/tasks/sprint-milestone/types";
import { isOverdueDate } from "../../../features/tasks/utils/dueWindow";
import { fmt, useTranslation } from "../../../i18n";
import type { ChatTarget } from "../../../services/schedules";
import type { ProjectProps } from "../../../types/tasks";
import { formatMonthDay } from "../../../utils/calendarDate";
import { INBOX_TARGET, type DeliverTarget } from "./chatTarget";
import { ChatTargetDecorator, ChatTargetOption } from "./ChatTargetOption";
import { useJoinedProjects, useProjectAvatars, useProjectMilestones } from "./scheduleParamHooks";

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

/** The project parameter, by name. Optional (`what_to_do_today`): "All projects" or one project.
 *  `required` (`project_updates`): no "All projects" row, because it is not a valid answer, and a
 *  placeholder until one is chosen, as in the milestone picker below. The same dropdown, rows and
 *  avatars as the project filter under the Genos search box (`ProjectPickerParts`), here as a
 *  single choice. */
export const ProjectParamSelect = ({
    value,
    onChange,
    required = false,
}: Props & { required?: boolean }) => {
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
    const options = [
        ...(required ? [] : [all]),
        ...(unavailable ? [unavailable] : []),
        ...projects,
    ];
    // Nothing chosen: "All projects" when that is an answer, the placeholder when it is not.
    const selected: ProjectProps | null =
        value === ""
            ? required
                ? null
                : all
            : (unavailable ?? projects.find((p) => String(p.projectId) === value) ?? null);

    return (
        <Autocomplete<ProjectProps, false, boolean, false>
            disableClearable={!required}
            getOptionLabel={(option) => projectOptionLabel(option)}
            isOptionEqualToValue={(option, value) => isSameProject(option, value)}
            noOptionsText={projects.length === 0 ? s.projectNone : t.common.empty.noResults}
            options={options}
            placeholder={required ? s.projectPlaceholder : undefined}
            renderOption={renderProjectOption(avatars)}
            slotProps={projectListboxSlotProps(popupZIndex)}
            sx={{ minWidth: 0 }}
            // "All projects" is how the optional picker says "none", so it cannot be cleared;
            // the required one can be emptied again, like the milestone picker.
            value={selected}
            startDecorator={
                // The closed field is a text input, so only the name fits in it: the
                // avatar rides beside it, as in the task pickers.
                selected && selected.projectId > ALL_PROJECTS_ID ? (
                    <ProjectIdentityDecorator
                        avatarSrc={avatars.get(selected.projectId)}
                        project={selected}
                    />
                ) : undefined
            }
            onChange={(_, option) => {
                if (!option) {
                    onChange("");
                    return;
                }
                if (option.projectId === UNAVAILABLE_ID) return;
                onChange(option.projectId === ALL_PROJECTS_ID ? "" : String(option.projectId));
            }}
        />
    );
};

// One row of the milestone dropdown. `group` is the owning project's id as text ("" for
// the stand-in row of a milestone that can no longer be listed). `milestone` is absent on
// that stand-in row, which therefore shows no chips.
type MilestoneOption = {
    id: string;
    title: string;
    label: string;
    group: string;
    milestone?: Milestone;
};

// Type-to-filter matches the title and the display id (as well as the project name).
const filterMilestones = createFilterOptions<MilestoneOption>({
    stringify: (o) => `${o.label} ${o.milestone?.displayId ?? ""}`,
});

/** One milestone row: the title, then ONE meta line that always starts with the status, so
 *  rows with and without a due date or progress have the same height. The due date turns red
 *  AND says "Overdue" (colour alone is not an answer); a finished milestone is never overdue. */
const MilestoneOptionRow = ({ milestone }: { milestone: Milestone }) => {
    const { t, locale } = useTranslation();
    const s = t.settings.schedules;
    const due = formatMonthDay(milestone.dueDate, locale);
    const overdue = milestone.status !== "Closed" && isOverdueDate(milestone.dueDate);
    const total = milestone.tasksTotal ?? 0;
    const closed = milestone.tasksClosed ?? 0;
    const meta = {
        flexShrink: 0,
        whiteSpace: "nowrap",
        fontSize: "var(--g-type-body-xs-size, 0.75rem)",
        color: "var(--g-text-tertiary)",
    } as const;
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, minWidth: 0, flex: 1 }}>
            <Typography level="body-sm" sx={{ color: "inherit", minWidth: 0 }} noWrap>
                {milestone.title}
            </Typography>
            <Box
                data-testid="milestone-option-meta"
                sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}
            >
                <Box sx={{ flexShrink: 0, display: "inline-flex" }}>
                    <StatusLabel status={milestone.status} />
                </Box>
                {milestone.displayId && (
                    <Box
                        component="span"
                        sx={{
                            ...meta,
                            flexShrink: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {milestone.displayId}
                    </Box>
                )}
                {due && (
                    <Box
                        component="span"
                        sx={{ ...meta, color: overdue ? toneCss("danger").text : meta.color }}
                    >
                        {fmt(overdue ? s.milestoneOverdue : s.milestoneDue, { date: due })}
                    </Box>
                )}
                {total > 0 && (
                    <Box component="span" sx={meta}>
                        {fmt(t.tasks.dashboard.assignedMilestones.progress, { closed, total })}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

/** The required milestone parameter: a milestone by name, grouped by project. The same
 *  field, dropdown and project rows (avatar, name) as the project picker above; each row
 *  adds what the milestone is (status, id, due date, progress), and the closed field carries
 *  the chosen milestone's status icon the way the project picker carries its avatar. */
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
                milestone: m,
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
    const selected = all.find((o) => o.id === value) ?? null;

    return (
        <Autocomplete<MilestoneOption, false, false, false>
            filterOptions={filterMilestones}
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
            value={selected}
            renderGroup={({ key, group, children }) => {
                const project = projectById.get(group);
                return (
                    <ListItem key={key} nested>
                        {project && (
                            <ListSubheader
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
                                sticky
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
                <AutocompleteOption
                    {...optionProps}
                    key={option.id}
                    sx={{ display: "flex", alignItems: "center", minWidth: 0 }}
                >
                    {option.milestone ? (
                        <MilestoneOptionRow milestone={option.milestone} />
                    ) : (
                        <Typography level="body-sm" sx={{ color: "inherit", minWidth: 0 }} noWrap>
                            {option.title}
                        </Typography>
                    )}
                </AutocompleteOption>
            )}
            startDecorator={
                // The closed field is a text input, so only the name fits in it: the status
                // rides beside it as an icon (its name is the accessible label).
                selected?.milestone ? (
                    <StatusLabel status={selected.milestone.status} iconOnly />
                ) : undefined
            }
            onChange={(_, option) => onChange(option ? option.id : "")}
        />
    );
};

/** "Send the report to" (MIP-2347): the Inbox or a chat, as the Project updates picker draws a
 *  project: an Autocomplete whose rows carry the picture, the kind and the tags, and whose closed
 *  field keeps the picture. `chats` already holds a saved place that is no longer offered
 *  (`stray`, shown muted as "(unavailable)"), so the form never shows a blank for what is saved. */
export const ChatTargetSelect = ({
    chats,
    stray,
    value,
    onChange,
    label,
    allLabel,
}: {
    chats: ChatTarget[];
    /** Words for the empty row when it means "every chat" instead of the Inbox. */
    allLabel?: string;
    /** Id of the chat in `chats` that the member's list no longer offers, if any. */
    stray?: string;
    /** The chat's id, "" for the Inbox. */
    value: string;
    onChange: (next: string) => void;
    /** The text of a chat in the closed field and for filtering. */
    label: (c: ChatTarget) => string;
}) => {
    const { t } = useTranslation();
    const popupZIndex = useDialogPopupZIndex();
    // `null` is the Inbox row.
    const options: DeliverTarget[] = [INBOX_TARGET, ...chats];
    const selected: DeliverTarget = chats.find((c) => c.id === value) ?? INBOX_TARGET;

    return (
        <Autocomplete<DeliverTarget, false, true, false>
            isOptionEqualToValue={(o, v) => o.id === v.id}
            noOptionsText={t.common.empty.noResults}
            options={options}
            slotProps={projectListboxSlotProps(popupZIndex)}
            startDecorator={<ChatTargetDecorator allLabel={allLabel} target={selected} />}
            sx={{ minWidth: 0 }}
            value={selected}
            getOptionLabel={(o) =>
                o.kind === "inbox" ? (allLabel ?? t.settings.schedules.deliverInbox) : label(o)
            }
            renderOption={(optionProps, option) => (
                <AutocompleteOption
                    {...optionProps}
                    key={option.id || "inbox"}
                    sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
                >
                    <ChatTargetOption
                        allLabel={allLabel}
                        target={option}
                        unavailable={option.id !== "" && option.id === stray}
                    />
                </AutocompleteOption>
            )}
            disableClearable
            onChange={(_, option) => onChange(option ? option.id : "")}
        />
    );
};

/** The group chat a catch-up covers (MIP-2348): the same dropdown and rows as "Send the report
 *  to", with "All busy chats" as the empty row. It lists the group chats the member is in, read
 *  from what the app already holds (no request); the server checks again on save and at every
 *  run. A stored chat that is no longer listed stays selectable as "(unavailable)". */
export const ChatParamSelect = ({ value, onChange }: Props) => {
    const { t } = useTranslation();
    const s = t.settings.schedules;
    const { allChats } = useHashMentionData();
    const chats = allChats
        .filter((c) => c.chatType === 2 && !c.isExternal && c.chatName)
        .map(
            (c): ChatTarget => ({
                id: String(c.chatId),
                title: c.chatName,
                kind: "group",
                projectId: null,
            })
        )
        .sort((a, b) => a.title.localeCompare(b.title));
    const stray = value !== "" && !chats.some((c) => c.id === value);
    const options: ChatTarget[] = stray
        ? [{ id: value, title: s.unavailable, kind: "group", projectId: null }, ...chats]
        : chats;
    return (
        <ChatTargetSelect
            allLabel={s.chatAllBusy}
            chats={options}
            label={(c) => c.title}
            stray={stray ? value : undefined}
            value={value}
            onChange={onChange}
        />
    );
};

/** The skill a "Run a skill" schedule runs (MIP-2045), by name: what the member may run in this
 *  team (the `/` menu's own list: theirs, a teammate's team skill, an installed one). A skill that
 *  was never published is listed but cannot be chosen, with the reason: a schedule runs a
 *  published version, never a draft. A stored skill that is no longer in the list stays selectable
 *  as "(unavailable)" so the form can show it, as the project picker does. */
export const SkillParamSelect = ({ value, onChange }: Props) => {
    const { t } = useTranslation();
    const s = t.settings.schedules;
    const rows = useRunnableSkillRows();
    const popupZIndex = useDialogPopupZIndex();

    const skills = rows ?? [];
    const stray = value !== "" && rows !== undefined && !skills.some((r) => r.id === value);

    return (
        <Select
            placeholder={rows === undefined ? s.skillLoading : s.skillPlaceholder}
            slotProps={{ listbox: { sx: { zIndex: popupZIndex, maxHeight: 280 } } }}
            sx={{ minWidth: 0 }}
            value={value || null}
            onChange={(_, next) => {
                if (next) onChange(next);
            }}
        >
            {stray && (
                <Option value={value} disabled>
                    {s.unavailable}
                </Option>
            )}
            {rows?.length === 0 && (
                <Option value="" disabled>
                    {s.skillNone}
                </Option>
            )}
            {skills.map((r) => {
                const name = r.title || r.slug;
                return (
                    <Option
                        key={r.id}
                        disabled={r.publishedVersionNo <= 0}
                        label={name}
                        value={r.id}
                    >
                        <Typography level="body-sm" sx={{ color: "inherit", minWidth: 0 }} noWrap>
                            {r.publishedVersionNo > 0 ? name : fmt(s.skillNotPublished, { name })}
                        </Typography>
                    </Option>
                );
            })}
        </Select>
    );
};
