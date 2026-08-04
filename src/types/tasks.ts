import { PartialBlock } from "@blocknote/core";

import { UserProps } from "./admin";
import { ReactionProps } from "./common";

export type TagColorOption = {
    name: string;
    value: string;
    textColor: string;
};

export type AttachmentFileProps = {
    attachment_id: number;
    file: File;
    file_base64?: string;
    // MEDIA_URL-prefixed path from `getTask?attachments=meta` — the
    // no-base64 response shape. `file` carries the bare storage path
    // (a string, not a File) in that mode; previews compose the
    // absolute media URL from it.
    file_url?: string;
    name?: string;
    type?: string;
};

export type TagListProps = {
    tagName: string;
    tagColor: string;
    tagTextColor: string;
};

// ── Per-project custom task fields ─────────────────────────────────
// Definitions live on the project (ProjectCustomField server-side);
// values ride on every task/milestone row as `customFieldValues`,
// keyed by `String(fieldId)`.
export type CustomFieldType = "tag" | "text" | "date" | "member";

// One selectable option of a tag-type field. `id` is an opaque
// client-minted string — VALUES store option ids, never labels, so
// renaming/recoloring an option never rewrites task rows.
export type CustomFieldOption = {
    id: string;
    label: string;
    color: string;
    textColor?: string;
};

export type ProjectCustomFieldDef = {
    fieldId: number;
    fieldName: string;
    fieldType: CustomFieldType;
    /** Only tag-type fields carry options; empty for the rest. */
    options: CustomFieldOption[];
    sortOrder: number;
};

// Value shapes by field type:
//   tag    -> string[] of option ids
//   text   -> string
//   date   -> "YYYY-MM-DD"
//   member -> user-id string
export type CustomFieldValue = string | string[];
export type CustomFieldValues = Record<string, CustomFieldValue>;

// A TEAM-scoped label applied to whole PROJECTS, used to organize a
// long project list ("Client Work", "Q3", "Internal").
//
// Read the name carefully against `TagListProps` above — the two are
// opposite relations and sit side by side on `ProjectProps`:
//   • `projectTags`   — tags belonging to ONE project, applied to the
//                       TASKS inside it. Identified by `tagName`.
//   • `projectLabels` — labels from a team-wide catalog, applied to the
//                       PROJECT itself. Identified by `labelId`.
// Labels are addressed by id everywhere (assign, rename, delete) so a
// rename is one server-side UPDATE instead of a rewrite of every
// referencing row — the trap `projectTags` still lives with.
export type ProjectLabelProps = {
    labelId: number;
    name: string;
    color: string;
    textColor: string;
    // Only present on the catalog listing (`GET /project/label/`), where
    // it powers the "used by N projects" blast-radius hint before a
    // delete. Absent on the per-project payloads.
    projectCount?: number;
};

export type ProjectProps = {
    projectId: number;
    projectName: string;
    // Short uppercase code used as the prefix in task display IDs
    // (the "GEN" in "GEN-42"). Auto-derived on project create,
    // editable from project settings.
    projectCode?: string | null;
    projectTags: TagListProps[];
    // See ProjectLabelProps — NOT the same thing as projectTags.
    projectLabels?: ProjectLabelProps[];
    isPrivate?: boolean;
    isJoined?: boolean;
    systemUserId?: string;
    /**
     * Another team owns this project and shared it with yours.
     *
     * Absent on an ordinary project rather than false — see
     * `_external_fields` in `prj_views.py` for why the API omits it. Read
     * it as a truthy check, never as `=== false`.
     *
     * `hostTeamId` matters beyond the label: task, milestone and member
     * endpoints are scoped to the team that OWNS the project, so anything
     * loading its contents has to address the host rather than the team
     * the user is currently viewing.
     */
    isExternal?: boolean;
    hostTeamId?: string;
    hostTeamName?: string;
};

export type TaskPriorityProps = {
    code: number | null;
    priority: string | null;
    color: string | null;
    textColor: string | null;
};

export type TaskEffortLevelProps = {
    code: number | null;
    level: string | null;
    color: string | null;
    textColor: string | null;
};

export type TaskCommentProps = {
    projectId: number | null;
    taskId: number;
    senderId: string;
    senderName: string;
    commentId: number;
    commentBody: PartialBlock[] | any[];
    reactions?: ReactionProps[];
    tsSent: string;
    tsUpdated: string;
    isEdited: boolean;
};

// Audit-log row backing the new "Activity" tab. Mirrors `TaskActivity`
// in `backend_django/origin/models/task/task_activity_models.py`. The
// frontend treats `actionType` as an opaque string to keep the diff
// loose (new types can be added on the backend without a frontend
// schema bump); `formatActivity` switches on it.
export type TaskActivityProps = {
    activityId: number;
    actionType: string;
    fieldName: string | null;
    oldValue: unknown;
    newValue: unknown;
    metadata: Record<string, unknown>;
    actor: {
        userId: string | number | null;
        userName: string | null;
        avatarImgPath: string | null;
    } | null;
    tsCreatedAt: string;
};

export type TaskStatusProps = {
    code: number | null;
    status: string | null;
    color: string | null;
    textColor: string | null;
};

// One row out of TaskDependency, hydrated against the "other" endpoint.
// When this ref appears in `blocking`, `otherTaskId` is the blocked
// task; when it appears in `blockedBy`, it's the blocker.
export type TaskDependencyRef = {
    dependencyId: number;
    otherTaskId: number;
    displayId: string | null;
    projectId: number | null;
    projectName: string | null;
    title: string;
    status: TaskStatusProps;
    assigneeUserId: string | number | null;
    isMilestone: boolean;
};

export type TaskDependencies = {
    blocking: TaskDependencyRef[];
    blockedBy: TaskDependencyRef[];
};

export type TaskListByTagProps = {
    projectId: number;
    projectName: string;
    tags: {
        tagName: string;
        tagColor: string;
        tasks: {
            taskId: number;
            title: string;
            status: string;
        }[];
    }[];
};

export type TaskProps = {
    id?: number;
    // Human-readable task ID shown to users ("GEN-42"). Falls back to
    // "#<id>" for orphan tasks without a project / pre-migration rows.
    // Backend computes this from `project.code` + `project_task_number`
    // and emits it on every task response.
    displayId?: string | null;
    project: ProjectProps | null;
    title: string;
    body: PartialBlock[];
    // `null` means "Unassigned" — backend `TaskMaster.assignee` is a
    // SET_NULL FK so a task can legitimately have no assignee, and
    // creating one defaults to null. Reporter is always set (the
    // creator) and stays non-nullable.
    assignee: UserProps | null;
    reporter: UserProps;
    // Additional members working on the task beside the single
    // `assignee`. Backend `TaskMaster.collaborators` is a M2M; the read
    // endpoints always emit an array (empty when none). Optional here so
    // partial TaskProps built by non-read callers can omit it — the save
    // paths then OMIT the key rather than sending `[]` (which would clear
    // the server-side set). Deliberately NOT on `TaskTableProps`: the
    // table doesn't surface collaborators.
    collaborators?: UserProps[];
    chatType: number | null;
    chatId: number | null;
    threadId: number | null;
    dueDate: string;
    daysLeft?: number;
    // Optional planning start date. Backend serializes it as an
    // ISO yyyy-mm-dd string (matching the dueDate shape) or null.
    startDate?: string | null;
    createdDate?: string;
    updatedAt?: string;
    status: TaskStatusProps;
    priority: TaskPriorityProps;
    effortLevel: TaskEffortLevelProps;
    tags: TagListProps[];
    concatTags?: string;
    links: {
        id: string;
        url: string;
        title: string;
        isGitHub: boolean;
        // True when this link was auto-appended by the PR auto-link
        // mechanism (branch head ref contained the task's display ID).
        // Manually pasted links from DynamicURLManager omit this flag.
        // Used by the PR column so it can keep surfacing the PR badge
        // even after the source branch has been deleted (typical
        // post-merge cleanup).
        isAutoLinked?: boolean;
    }[];
    attachments: AttachmentFileProps[];
    parentTaskId: number | null;
    rootTaskId: number | null;
    // True if this task row is the backing task of a milestone (i.e.
    // `MilestoneMaster` points to it via its `task` FK). When true the
    // preview pane routes to MilestonePreview instead of TaskPreview.
    isMilestone?: boolean | null;
    // FK back to MilestoneMaster.milestone_id when this task either is
    // the milestone (alongside `isMilestone=true`) or is a child task
    // inside the milestone.
    milestoneId?: number | null;
    sprintId?: number | null;
    // Values for the project's custom fields, keyed by String(fieldId).
    // `undefined` means "not loaded" (e.g. a pre-deploy cache entry) —
    // save paths must OMIT the key in that case rather than sending {}
    // (which would clear the server-side map).
    customFieldValues?: CustomFieldValues;
};

export type TaskTableProps = {
    id: string | null;
    // Human-readable task ID — see TaskProps.displayId.
    displayId?: string | null;
    title: string | null;
    priority: string | null;
    effortLevel: string | null;
    createdDate: string | null;
    updatedAt: string | null;
    dueDate: string | null;
    daysLeft: number | null;
    // Optional planning start date — paired with dueDate.
    startDate?: string | null;
    status: string | null;
    assigneeId: string | null;
    assigneeEmail: string | null;
    assigneeName: string | null;
    assigneeImgPath: string | null;
    parentTaskId: string | null;
    rootTaskId?: number | null;
    threadId: number | null;
    tags: TagListProps[];
    concatTags: string | null;
    teamId: string | null;
    projectId: number | null;
    // External links attached to this task. Carried on the table row
    // for future column renderers; the PR column itself sources its
    // PRs from the auto-link endpoint (`/github/pulls/for-task/`), not
    // from this field — that's intentional, see PrStatusCell.
    links?: TaskProps["links"];
    // True for the backing task of a milestone. Renders with a flag
    // icon in the table and double-click routes to MilestonePreview.
    isMilestone?: boolean | null;
    // FK back to MilestoneMaster.milestone_id when this task belongs to
    // a milestone (either is the milestone itself, or is a child task
    // inside the milestone).
    milestoneId?: number | null;
    sprintId?: number | null;
    // Values for the project's custom fields — see TaskProps.
    customFieldValues?: CustomFieldValues;
};

export type TaskType = {
    id: number;
    statuses: string[];
    name: string;
};

export type TaskTypesProps = {
    all: TaskType;
    ongoing: TaskType;
    closed: TaskType;
    deleted: TaskType;
};

export type SearchTeamTasksResponse = {
    projectId: number;
    projectName: string;
    projectCode?: string | null;
    projectTags: TagListProps[];
    systemUserId: string;
    taskId: number;
    displayId?: string | null;
    title: string;
    // True for milestone backing rows — the search results and the
    // sidebar Recents list render a flag icon for these.
    isMilestone?: boolean;
    status: TaskStatusProps;
    tsUpdated: string;
};

export type FileProps = {
    attachmentId: number;
    url: string;
    name: string;
    width: number;
    height: number;
};

export type ImageSizeProps = {
    width: number;
    height: number;
};

export type TaskMetaProps = {
    taskId: number;
    parentTaskId: number | null;
    project: ProjectProps;
    title: string;
    status: TaskStatusProps;
    tsUpdated: string;
    error?: string;
};

export type TaskMetaTreeNode = TaskMetaProps & { children: TaskMetaTreeNode[] };
