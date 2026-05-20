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
    name?: string;
    type?: string;
};

export type TagListProps = {
    tagName: string;
    tagColor: string;
    tagTextColor: string;
};

export type ProjectProps = {
    projectId: number;
    projectName: string;
    // Short uppercase code used as the prefix in task display IDs
    // (the "GEN" in "GEN-42"). Auto-derived on project create,
    // editable from project settings.
    projectCode?: string | null;
    projectTags: TagListProps[];
    isPrivate?: boolean;
    isJoined?: boolean;
    systemUserId?: string;
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
    assignee: UserProps;
    reporter: UserProps;
    chatType: number | null;
    chatId: number | null;
    threadId: number | null;
    dueDate: string;
    daysLeft?: number;
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
