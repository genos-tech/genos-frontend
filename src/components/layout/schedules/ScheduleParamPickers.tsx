import { useMemo, useState } from "react";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import {
    Autocomplete,
    AutocompleteOption,
    Box,
    createFilterOptions,
    FormHelperText,
    List,
    ListItem,
    ListSubheader,
    Option,
    Select,
    Typography,
} from "@mui/joy";
import { useTheme } from "@mui/joy/styles";

import { useHashMentionData } from "../../../context/HashMentionDataContext";
import { skillSummary } from "../../../features/genos/skills/skillSummary";
import {
    carriesTag,
    DASHBOARD_TAG,
    dashboardSkills,
    filterByTags,
    tagChoices,
    toggleTag,
} from "../../../features/genos/skills/skillTagFilter";
import { useRunnableSkillRows } from "../../../features/genos/skills/useRunnableSkills";
import {
    buildFolderChoices,
    findChoice,
    isMyNotes,
    type FolderReaders,
    type SaveTo,
} from "../../../features/schedules/noteFolderChoices";
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
import { ProjectTagChip } from "../../../features/tasks/components/ProjectTagChip";
import { toneCss } from "../../../features/tasks/meta/taskTone";
import type { Milestone } from "../../../features/tasks/sprint-milestone/types";
import { isOverdueDate } from "../../../features/tasks/utils/dueWindow";
import { fmt, useTranslation } from "../../../i18n";
import { compareText } from "../../../i18n/collate";
import type { ChatTarget } from "../../../services/schedules";
import { focusRing, g } from "../../../theme/tokens";
import type { ProjectProps } from "../../../types/tasks";
import { formatMonthDay } from "../../../utils/calendarDate";
import { INBOX_TARGET, type DeliverTarget } from "./chatTarget";
import { ChatTargetDecorator, ChatTargetOption } from "./ChatTargetOption";
import {
    useJoinedProjects,
    useNoteFolders,
    useProjectAvatars,
    useProjectMilestones,
} from "./scheduleParamHooks";

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
    const { t, locale } = useTranslation();
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
        .sort((a, b) => compareText(a.title, b.title, { locale }));
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

/** Fewer tagged skills than this and the dashboard picker says how to add one. */
const SHORT_DASHBOARD_LIST = 5;

// A skill's summary line (MIP-2441). `dir="auto"` so a description reads in its own direction in
// any UI language.
const SKILL_SUMMARY_SX = {
    color: g.text.secondary,
    overflowWrap: "anywhere",
    textAlign: "start",
    whiteSpace: "normal",
} as const;

// The closed field's value is its own bidi island (MIP-2444): a long name ends with an ellipsis, and
// in an RTL app a name in another direction keeps its start. Joy's button is a flex row, so the text
// has to be an element of its own for the ellipsis to apply.
const CLOSED_VALUE_SX = {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
} as const;

/** The skill a "Run a skill" schedule runs (MIP-2045), by name: what the member may run in this
 *  team (the `/` menu's own list: theirs, a teammate's team skill, an installed one). A skill that
 *  was never published is listed but cannot be chosen, with the reason: a schedule runs a
 *  published version, never a draft. A stored skill that is no longer in the list stays selectable
 *  as "(unavailable)" so the form can show it, as the project picker does.
 *
 *  `forDashboard` (MIP-2418): only skills with the `dashboard` tag are listed, and a short list says
 *  how to add one. The skill the schedule already runs stays listed with or without the tag. */
export const SkillParamSelect = ({
    value,
    onChange,
    forDashboard = false,
}: Props & { forDashboard?: boolean }) => {
    const { t } = useTranslation();
    const s = t.settings.schedules;
    const rows = useRunnableSkillRows();
    const popupZIndex = useDialogPopupZIndex();

    // The tags the member ticked to narrow the list (MIP-2398): a skill must carry all of them.
    const [ticked, setTicked] = useState<string[]>([]);
    // The skill stored when the form opened: picking another must not take it off the list.
    const [stored] = useState(value);
    const all = forDashboard ? dashboardSkills(rows ?? [], [stored, value]) : (rows ?? []);
    // Every listed skill has the `dashboard` tag, so ticking it would narrow nothing.
    const choices = tagChoices(all).filter((c) => !forDashboard || c.name !== DASHBOARD_TAG);
    const showAddTagHint =
        forDashboard &&
        rows !== undefined &&
        rows.filter((r) => carriesTag(r, DASHBOARD_TAG)).length < SHORT_DASHBOARD_LIST;
    const skills = filterByTags(all, ticked, value);
    const stray = value !== "" && rows !== undefined && !all.some((r) => r.id === value);
    // The chosen skill's summary stays under the field after the list closes.
    const chosenSummary = skillSummary(all.find((r) => r.id === value)?.description ?? "");

    return (
        <>
            {choices.length > 0 && (
                <Box
                    aria-label={s.skillTagFilter}
                    data-testid="skill-tag-filter"
                    role="group"
                    sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, minWidth: 0 }}
                >
                    {choices.map((chip) => {
                        const on = ticked.includes(chip.name);
                        return (
                            <Box
                                key={chip.name}
                                aria-pressed={on}
                                component="button"
                                type="button"
                                sx={{
                                    appearance: "none",
                                    background: "transparent",
                                    border: 0,
                                    borderRadius: "999px",
                                    cursor: "pointer",
                                    // Ticked: a ring and full colour; unticked: dimmed, as the
                                    // to-do tag bar does.
                                    opacity: on || ticked.length === 0 ? 1 : 0.5,
                                    outline: on ? `2px solid ${g.accent.text}` : "none",
                                    outlineOffset: 1,
                                    p: 0,
                                    "&:focus-visible": focusRing,
                                }}
                                onClick={() => setTicked((cur) => toggleTag(cur, chip.name))}
                            >
                                <ProjectTagChip label={chip.name} tagColor={chip.color} />
                            </Box>
                        );
                    })}
                </Box>
            )}
            <Select
                placeholder={rows === undefined ? s.skillLoading : s.skillPlaceholder}
                slotProps={{ listbox: { sx: { zIndex: popupZIndex, maxHeight: 280 } } }}
                sx={{ minWidth: 0 }}
                value={value || null}
                onChange={(_, next) => {
                    if (next) onChange(next);
                }}
                renderValue={(option) => (
                    <Box component="bdi" sx={CLOSED_VALUE_SX}>
                        {option?.label}
                    </Box>
                )}
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
                {rows !== undefined && rows.length > 0 && skills.length === 0 && (
                    <Option value="" disabled>
                        {all.length === 0 ? s.skillDashboardNone : s.skillNoMatch}
                    </Option>
                )}
                {skills.map((r) => {
                    const name = r.title || r.slug;
                    const summary = skillSummary(r.description);
                    return (
                        <Option
                            key={r.id}
                            disabled={r.publishedVersionNo <= 0}
                            label={name}
                            value={r.id}
                        >
                            {/* `contain` keeps a long name or sentence out of the list's
                                width: the list stays as wide as the field and rows wrap. */}
                            <Box sx={{ contain: "inline-size", flexGrow: 1, minWidth: 0 }}>
                                <Box
                                    sx={{
                                        alignItems: "center",
                                        display: "flex",
                                        flexWrap: "wrap",
                                        columnGap: 0.75,
                                        rowGap: 0.25,
                                        minWidth: 0,
                                    }}
                                >
                                    <Typography
                                        level="body-sm"
                                        sx={{
                                            color: "inherit",
                                            minWidth: 0,
                                            overflowWrap: "anywhere",
                                            whiteSpace: "normal",
                                        }}
                                    >
                                        {r.publishedVersionNo > 0
                                            ? name
                                            : fmt(s.skillNotPublished, { name })}
                                    </Typography>
                                    {(r.tagChips ?? []).slice(0, 3).map((chip) => (
                                        <ProjectTagChip
                                            key={chip.name}
                                            label={chip.name}
                                            tagColor={chip.color}
                                        />
                                    ))}
                                </Box>
                                {summary && (
                                    <Typography
                                        data-testid="skill-summary"
                                        dir="auto"
                                        level="body-xs"
                                        sx={{
                                            ...SKILL_SUMMARY_SX,
                                            display: "-webkit-box",
                                            overflow: "hidden",
                                            WebkitBoxOrient: "vertical",
                                            WebkitLineClamp: 2,
                                        }}
                                    >
                                        {summary}
                                    </Typography>
                                )}
                            </Box>
                        </Option>
                    );
                })}
            </Select>
            {chosenSummary && (
                <Typography
                    data-testid="skill-chosen-summary"
                    dir="auto"
                    level="body-xs"
                    sx={{ ...SKILL_SUMMARY_SX, mt: 0.5 }}
                >
                    {chosenSummary}
                </Typography>
            )}
            {showAddTagHint && (
                <Typography
                    data-testid="skill-dashboard-hint"
                    level="body-xs"
                    sx={{ color: g.text.secondary }}
                >
                    {s.skillDashboardHint}
                </Typography>
            )}
        </>
    );
};

// One row of the "Save to" dropdown. `group` keeps My notes (no header), the member's folders and
// the team folders together. The stand-in row of a stored folder that is not offered is `stray`.
type FolderOption = {
    id: string;
    /** What the closed field shows: the whole path. */
    label: string;
    /** What the row shows: the folder's own name. */
    name: string;
    depth: number;
    group: "me" | "mine" | "team";
    readers: FolderReaders;
    saveTo: SaveTo;
    folderId: string;
    stray?: boolean;
};

/** Where a dashboard page is saved (MIP-2357), by name: "My notes", each of the member's own folders
 *  (nested as in the Notes sidebar) and each team folder they may add notes to, public or private.
 *  Each row says who can open the page there, so the API's refusal of a place that shows a project's
 *  data to someone off it is no surprise. ONE choice sets `save_to` and `folder_id` together. A
 *  stored folder that is no longer offered (deleted, or the member lost the right) stays selectable
 *  as "(unavailable)", as the project picker does, so the form never shows a blank for what is saved. */
export const FolderParamSelect = ({
    saveTo,
    folderId,
    disabled = false,
    onChange,
}: {
    saveTo: string;
    folderId: string;
    disabled?: boolean;
    onChange: (saveTo: SaveTo, folderId: string) => void;
}) => {
    const { t, locale } = useTranslation();
    const s = t.settings.schedules;
    const popupZIndex = useDialogPopupZIndex();
    const { mine, team, loading, failed } = useNoteFolders();
    const choices = useMemo(
        () => buildFolderChoices(mine, team, (a, b) => compareText(a, b, { locale })),
        [mine, team, locale]
    );
    const me: FolderOption = {
        id: "me",
        label: s.saveToMyNotes,
        name: s.saveToMyNotes,
        depth: 0,
        group: "me",
        readers: "onlyYou",
        saveTo: "me",
        folderId: "",
    };
    const folders: FolderOption[] = choices.map((c) => ({
        id: c.id,
        label: c.path,
        name: c.name,
        depth: c.depth,
        group: c.group,
        readers: c.readers,
        saveTo: c.saveTo,
        folderId: c.folderId,
    }));
    const myNotes = isMyNotes(saveTo, folderId);
    const found = myNotes ? null : findChoice(choices, saveTo, folderId);
    // A stored folder that is not listed: "Loading" while the lists are on their way (it may be
    // among them), "(unavailable)" once they are in and it is not.
    const stray: FolderOption | null =
        !myNotes && !found
            ? {
                  id: "stray",
                  label: loading ? s.saveToLoading : s.unavailable,
                  name: loading ? s.saveToLoading : s.unavailable,
                  depth: 0,
                  group: "me",
                  readers: "onlyYou",
                  saveTo: saveTo === "team_folder" ? "team_folder" : "personal_folder",
                  folderId,
                  stray: true,
              }
            : null;
    const options = [...(stray ? [stray] : []), me, ...folders];
    const selected = stray ?? (found ? folders.find((f) => f.id === found.id) : me) ?? me;
    const readersText = (o: FolderOption) =>
        o.readers === "teamPublic"
            ? s.saveToTeamPublic
            : o.readers === "teamPrivate"
              ? fmt(s.saveToTeamPrivate, { name: o.name })
              : s.saveToOnlyYou;

    return (
        <>
            <Autocomplete<FolderOption, false, true, false>
                disabled={disabled}
                getOptionLabel={(o) => o.label}
                groupBy={(o) => o.group}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                loading={loading}
                loadingText={s.saveToLoading}
                noOptionsText={failed ? s.saveToLoadFailed : t.common.empty.noResults}
                options={options}
                slotProps={projectListboxSlotProps(popupZIndex)}
                sx={{ minWidth: 0 }}
                value={selected}
                renderGroup={({ key, group, children }) => (
                    <ListItem key={key} nested>
                        {group !== "me" && (
                            <ListSubheader sx={{ textTransform: "none", letterSpacing: 0 }} sticky>
                                {group === "mine" ? s.saveToGroupMine : s.saveToGroupTeam}
                            </ListSubheader>
                        )}
                        <List>{children}</List>
                    </ListItem>
                )}
                renderOption={(optionProps, option) => (
                    <AutocompleteOption
                        {...optionProps}
                        key={option.id}
                        sx={{
                            alignItems: "center",
                            display: "flex",
                            gap: 1,
                            minWidth: 0,
                            paddingInlineStart: `${12 + option.depth * 16}px`,
                        }}
                    >
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography level="body-sm" sx={{ color: "inherit" }} noWrap>
                                {option.name}
                            </Typography>
                            {!option.stray && (
                                <Typography level="body-xs" sx={{ color: "text.tertiary" }} noWrap>
                                    {readersText(option)}
                                </Typography>
                            )}
                        </Box>
                        {option.group === "team" &&
                            (option.readers === "teamPublic" ? (
                                <PublicRoundedIcon
                                    fontSize="small"
                                    titleAccess={s.saveToTeamPublic}
                                />
                            ) : (
                                <LockRoundedIcon
                                    fontSize="small"
                                    titleAccess={readersText(option)}
                                />
                            ))}
                    </AutocompleteOption>
                )}
                disableClearable
                onChange={(_, option) => {
                    // The "(unavailable)" stand-in only shows what is stored: it is not a choice.
                    if (option.stray) return;
                    onChange(option.saveTo, option.folderId);
                }}
            />
            {!selected.stray && (
                <FormHelperText sx={{ color: "text.secondary" }}>
                    {fmt(s.saveToReaders, { who: readersText(selected) })}
                </FormHelperText>
            )}
        </>
    );
};
