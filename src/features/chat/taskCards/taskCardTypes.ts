/** `GET /api/v3/tasks/cards/` (MIP-2484). Statuses and priorities are the stored enum strings. */

export type CardPerson = { userId: string; userName: string };

export type CardTaskRef = { taskId: number; displayId: string; title: string };

type CardCommon = {
    taskId: number;
    displayId: string;
    title: string;
    excerpt: string;
    status: string;
    /** The project's own status the task points at; the API does not send it yet. */
    customStatusId?: number | null;
    priority: string | null;
    reporter: CardPerson | null;
    dueDate: string | null;
    startDate: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    project: { projectId: number; projectName: string } | null;
};

export type LiveTaskCard = CardCommon & {
    kind: "task";
    effortLevel: string | null;
    assignee: CardPerson | null;
    tags: { tagName: string; tagColor: string; tagTextColor: string }[];
    tagCount: number;
    milestone: (CardTaskRef & { milestoneId: number }) | null;
    parent: CardTaskRef | null;
    blockedBy: CardTaskRef[];
    blockedByCount: number;
};

export type LiveMilestoneCard = CardCommon & {
    kind: "milestone";
    milestoneId: number;
    sprint: { sprintId: number; name: string } | null;
    assignees: CardPerson[];
    assigneeCount: number;
    progress: { total: number; closed: number; byStatus: Record<string, number> };
};

export type LiveCard = LiveTaskCard | LiveMilestoneCard;
