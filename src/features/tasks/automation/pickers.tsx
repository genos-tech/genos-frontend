/**
 * The editor's value pickers are the task view's own (MIP-2591). Those edit a task, so each
 * one here hands them a stand-in that holds the one value, and reads it back.
 */
import { ReactNode, useMemo, useState } from "react";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { UserAvatar } from "../../../components/ui/avatars/UserAvatar";
import type { ProjectCustomFieldDef, TagListProps, TaskProps } from "../../../types/tasks";
import { ACProjectTags } from "../components/autocompletes/ACProjectTags";
import { ACTaskPriority } from "../components/autocompletes/ACTaskPriority";
import { ACTaskStatus } from "../components/autocompletes/ACTaskStatus";
import { ACTeamProjects } from "../components/autocompletes/ACTeamProjects";
import { ACTeamUsers } from "../components/autocompletes/ACTeamUsers";
import type { PickerField } from "../components/autocompletes/pickerField";
import { MemberFieldEditor, TagFieldEditor } from "../components/contents/base/CustomFieldsBlock";
import { SprintMilestonePicker } from "../sprint-milestone/components/SprintMilestonePicker";
import { priorities, statuses } from "../utils/taskMeta";
import type { StatusPick } from "./draft";
import { destinationProjects, refusedAsPublic, statusRowOf, useLookups } from "./lookups";
import { useAutomationWords } from "./words";

const noop = () => {};
const noFavorites = () => false;

/** Only what the picker it is given to reads. */
const standIn = (values: object): TaskProps => values as unknown as TaskProps;

/** The width of the slots in the sentence; a touch screen gets the taller, 16px field. */
const Slot = ({ children }: { children: ReactNode }) => (
    <Box
        sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            width: { xs: "100%", sm: 220 },
            minWidth: 0,
            "& .MuiAutocomplete-root": { flex: 1, minWidth: 0 },
            "@media (pointer: coarse)": {
                "& .MuiAutocomplete-root": { minHeight: 44, fontSize: "1rem" },
            },
        }}
    >
        {children}
    </Box>
);

export const StatusSlot = ({
    projectId,
    rows,
    value,
    onChange,
    field,
}: {
    /** Whose statuses are offered. */
    projectId: number;
    rows: Parameters<typeof statusRowOf>[1];
    value: StatusPick | null;
    onChange: (next: StatusPick, statusId: number | undefined) => void;
    field: PickerField;
}) => {
    const words = useAutomationWords();
    const row = value ? statusRowOf(value, rows) : undefined;
    // A saved pick of a status of the project's own carries its id alone. One that was
    // deleted since reads "Unknown", not like an empty field.
    const gone = value?.customStatusId != null && !row && rows.length > 0;
    const category = gone ? words.unknown : value ? value.category || row?.category || "" : "";
    return (
        <Slot>
            <ACTaskStatus
                field={field}
                socket={null}
                setTaskContent={(next) =>
                    onChange(
                        { category: next.status.status ?? "", customStatusId: null },
                        next.customStatusPick ?? undefined
                    )
                }
                taskContent={standIn({
                    id: field.slotId,
                    project: { projectId },
                    status: statuses.find((s) => s.status === category) ?? { status: category },
                    // A whole category is its built-in row: left empty, the field would show
                    // the project's default status of that category instead.
                    customStatusId:
                        value?.customStatusId ??
                        rows.find((r) => r.category === category && r.builtinKey === category)
                            ?.statusId ??
                        null,
                })}
            />
        </Slot>
    );
};

export const TagSlot = ({
    tags,
    value,
    onChange,
    field,
}: {
    tags: TagListProps[];
    /** The tag's name: what a rule matches and adds. */
    value: string;
    onChange: (tagName: string) => void;
    field: PickerField;
}) => {
    const [open, setOpen] = useState(false);
    const picked = value
        ? [tags.find((tag) => tag.tagName === value) ?? { tagName: value, tagColor: "" }]
        : [];
    return (
        <Slot>
            <ACProjectTags
                field={field}
                isOpenTagList={open}
                projectTags={tags}
                setIsOpenTagList={setOpen}
                // One tag: the latest pick replaces the one before.
                setTaskContent={(next) => onChange(next.tags.slice(-1)[0]?.tagName ?? "")}
                taskContent={standIn({ id: field.slotId, tags: picked })}
            />
        </Slot>
    );
};

export const PrioritySlot = ({
    value,
    onChange,
    field,
}: {
    value: string;
    onChange: (priority: string) => void;
    field: PickerField;
}) => (
    <Slot>
        <ACTaskPriority
            field={field}
            setTaskContent={(next) => onChange(next.priority.priority ?? "")}
            taskContent={standIn({
                id: field.slotId,
                priority: priorities.find((p) => p.priority === value) ?? { priority: value },
            })}
        />
    </Slot>
);

export const MemberSlot = ({
    memberIds,
    value,
    onChange,
    placeholder,
    field,
}: {
    /** Who may be picked; everybody on the team without it. */
    memberIds?: string[] | null;
    value: string;
    onChange: (userId: string) => void;
    placeholder?: string;
    field: PickerField;
}) => {
    const words = useAutomationWords();
    const { members, myself, profiles } = useLookups();
    const [open, setOpen] = useState(false);
    const picked = value
        ? (members.find((m) => m.userId === value) ??
          ({ userId: value, userName: words.unknown } as (typeof members)[number]))
        : null;
    return (
        <Slot>
            {/* Beside the field, as the task view's assignee has it. */}
            <UserAvatar
                clickable={false}
                fallbackName={picked?.userName}
                showPulseDot={false}
                userId={picked?.userId}
            />
            <ACTeamUsers
                field={field}
                initialUser={picked}
                isOpenTeamMembersList={open}
                myself={myself}
                placeholder={placeholder ?? words.choose}
                setIsOpenTeamMembersList={setOpen}
                setTaskContent={(next) => onChange(next.assignee?.userId ?? "")}
                setUser={noop}
                taskContent={standIn({ id: field.slotId, assignee: picked })}
                useTEM={{
                    teamMembers: memberIds
                        ? members.filter((m) => memberIds.includes(m.userId))
                        : members,
                    teamMemberProfiles: profiles,
                }}
                isAssignee
            />
        </Slot>
    );
};

/** The projects a rule may move into. */
export const ProjectSlot = ({
    value,
    onChange,
    field,
}: {
    value: number | null;
    onChange: (projectId: number | null) => void;
    field: PickerField;
}) => {
    const words = useAutomationWords();
    const lookups = useLookups();
    const [open, setOpen] = useState(false);
    const destinations = destinationProjects(lookups);
    const picked =
        value == null
            ? undefined
            : (lookups.projects.find((p) => p.projectId === value) ??
                  // Deleted, or one the reader is not on.
                  { projectId: value, projectName: words.unknown });
    return (
        <Slot>
            <ACTeamProjects
                field={field}
                isOpenProjectList={open}
                placeholder={words.choose}
                setIsOpenProjectList={setOpen}
                setTaskContent={(next) => onChange(next.project!.projectId!)}
                taskContent={standIn({ id: field.slotId, project: picked })}
                useCM={{ allChats: lookups.chats }}
                // A rule's draft must not move the app's current project.
                usePM={{ teamProjects: destinations, setCurrentProject: noop }}
                disabledReason={(p) =>
                    refusedAsPublic(lookups, p) ? words.privateOnly : undefined
                }
                onClear={() => onChange(null)}
            />
        </Slot>
    );
};

export const MilestoneSlot = ({
    value,
    onChange,
    field,
}: {
    /** The milestone's id, as the draft holds it. */
    value: string;
    onChange: (milestoneId: string) => void;
    field: PickerField;
}) => {
    const words = useAutomationWords();
    const { projectId, milestones, sprints } = useLookups();
    const known = milestones.some((m) => String(m.milestoneId) === value);
    // Stable while the lists are: the picker rebuilds its options, and drops what is being
    // typed, when this changes.
    const useSM = useMemo(
        () => ({
            projectMilestones: { [projectId]: milestones },
            projectSprints: { [projectId]: sprints },
            isMilestoneFavorited: noFavorites,
        }),
        [projectId, milestones, sprints]
    );
    return (
        <Slot>
            <SprintMilestonePicker
                field={field}
                milestoneId={value ? Number(value) : null}
                milestonePlaceholder={value && !known ? words.unknown : words.choose}
                projectId={projectId}
                showSprint={false}
                sprintId={null}
                useSM={useSM}
                onChangeMilestone={(id) => onChange(id == null ? "" : String(id))}
                onChangeSprint={noop}
            />
        </Slot>
    );
};

/** A custom field of the project's that is picked from a list: a tag option or a member. */
export const CustomFieldSlot = ({
    def,
    value,
    onChange,
    field,
}: {
    def: ProjectCustomFieldDef;
    value: string;
    onChange: (value: string) => void;
    field: PickerField;
}) => {
    const words = useAutomationWords();
    const { mode } = useColorScheme();
    const { members } = useLookups();
    // A deleted option, or a member who left, reads "Unknown" rather than like an empty field.
    const goneOption = Boolean(value) && !def.options.some((o) => o.id === value);
    const goneMember = Boolean(value) && !members.some((m) => String(m.userId) === value);
    return (
        <Slot>
            {def.fieldType === "member" ? (
                <MemberFieldEditor
                    def={def}
                    field={field}
                    placeholder={words.choose}
                    stored={value}
                    writeValue={(_id, next) => onChange(typeof next === "string" ? next : "")}
                    teamMembers={
                        goneMember
                            ? [
                                  ...members,
                                  {
                                      userId: value,
                                      userName: words.unknown,
                                  } as (typeof members)[number],
                              ]
                            : members
                    }
                />
            ) : (
                <TagFieldEditor
                    field={field}
                    isDark={mode === "dark"}
                    placeholder={words.choose}
                    values={value ? { [String(def.fieldId)]: [value] } : undefined}
                    def={
                        goneOption
                            ? {
                                  ...def,
                                  options: [
                                      ...def.options,
                                      { id: value, label: words.unknown, color: "" },
                                  ],
                              }
                            : def
                    }
                    writeValue={(_id, next) =>
                        onChange(Array.isArray(next) ? (next.slice(-1)[0] ?? "") : "")
                    }
                />
            )}
        </Slot>
    );
};
