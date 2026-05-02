import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import { Milestone } from "../sprint-milestone/types";

const statusLine = {
    Open: {
        text: "OPEN",
        type: "text",
        styles: { bold: true, textColor: "blue" },
    },
    WIP: {
        text: "WIP",
        type: "text",
        styles: { bold: true, textColor: "yellow" },
    },
    Pending: {
        text: "PENDING",
        type: "text",
        styles: { bold: true, textColor: "pink" },
    },
    Closed: {
        text: "CLOSED",
        type: "text",
        styles: { bold: true, textColor: "green" },
    },
    Deleted: {
        text: "DELETED",
        type: "text",
        styles: { bold: true, textColor: "red" },
    },
    default: {
        text: "UNKNOWN",
        type: "text",
        styles: { bold: true, textColor: "gray" },
    },
};
type StatusKey = keyof typeof statusLine;
function getStatusConfig(key: string): (typeof statusLine)[StatusKey] {
    return key in statusLine ? statusLine[key as StatusKey] : statusLine["default"];
}

const priorityLine = {
    Low: { text: "LOW", type: "text", styles: { bold: true, textColor: "blue" } },
    Medium: {
        text: "MEDIUM",
        type: "text",
        styles: { bold: true, textColor: "green" },
    },
    High: {
        text: "HIGH",
        type: "text",
        styles: { bold: true, textColor: "red" },
    },
    default: {
        text: "N/A",
        type: "text",
        styles: { bold: true, textColor: "gray" },
    },
};
type PriorityKey = keyof typeof priorityLine;
function getPriorityConfig(key: string): (typeof priorityLine)[PriorityKey] {
    return key in priorityLine ? priorityLine[key as PriorityKey] : priorityLine["default"];
}

const effortLevelLine = {
    Low: { text: "LOW", type: "text", styles: { bold: true, textColor: "blue" } },
    Medium: {
        text: "MEDIUM",
        type: "text",
        styles: { bold: true, textColor: "green" },
    },
    High: {
        text: "HIGH",
        type: "text",
        styles: { bold: true, textColor: "red" },
    },
    default: {
        text: "N/A",
        type: "text",
        styles: { bold: true, textColor: "gray" },
    },
};
type EffortLevelKey = keyof typeof effortLevelLine;
function getEffortLevelConfig(key: string): (typeof effortLevelLine)[EffortLevelKey] {
    return key in effortLevelLine
        ? effortLevelLine[key as EffortLevelKey]
        : effortLevelLine["default"];
}

export const taskMessageTemplate = (myself: UserProps, task: TaskProps) => [
    {
        type: "heading",
        props: {
            level: 3,
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [{ text: `🧾 Title: ${task.title}`, type: "text", styles: {} }],
        children: [],
    },
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [
            { text: "Priority: ", type: "text", styles: {} },
            getPriorityConfig(task.priority.priority || "default"),
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [
            { text: "Effort Level: ", type: "text", styles: {} },
            getEffortLevelConfig(task.effortLevel.level || "default"),
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [
            {
                text: "Assignee: ",
                type: "text",
                styles: {},
            },
            {
                type: "mention",
                props: {
                    teamId: myself.teamId,
                    userId: task.assignee.userId,
                    teamName: "N/A",
                    userName: task.assignee.userName,
                    userEmail: task.assignee.userEmail,
                    customStatus: "N/A",
                    avatarImgPath: [""],
                },
            },
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [
            {
                text: "Reporter: ",
                type: "text",
                styles: {},
            },
            {
                type: "mention",
                props: {
                    teamId: myself.teamId,
                    userId: task.reporter.userId,
                    teamName: "N/A",
                    userName: task.reporter.userName,
                    userEmail: task.reporter.userEmail,
                    customStatus: "N/A",
                    avatarImgPath: [""],
                },
            },
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [{ text: `Due: ${task.dueDate}`, type: "text", styles: {} }],
        children: [],
    },
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [],
        children: [],
    },
];

export const taskCreatedThreadMessageTemplate = (myself: UserProps) => [
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [
            { text: "A new task has been created by ", type: "text", styles: {} },
            {
                type: "mention",
                props: {
                    teamId: myself.teamId,
                    userId: myself.userId,
                    teamName: "N/A",
                    userName: myself.userName,
                    userEmail: myself.userEmail,
                    customStatus: "N/A",
                    avatarImgPath: [""],
                },
            },
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [],
        children: [],
    },
];

export const taskThreadMessageTemplate = (myself: UserProps, task: TaskProps) => [
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [
            { text: "The task marked as ", type: "text", styles: {} },
            getStatusConfig(task.status.status || "default"),
            { text: " by ", type: "text", styles: {} },
            {
                type: "mention",
                props: {
                    teamId: myself.teamId,
                    userId: myself.userId,
                    teamName: "N/A",
                    userName: myself.userName,
                    userEmail: myself.userEmail,
                    customStatus: "N/A",
                    avatarImgPath: [""],
                },
            },
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [],
        children: [],
    },
];

export const taskThreadMessageForCommentAddedTemplate = (myself: UserProps) => [
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [
            { text: "A new comment from ", type: "text", styles: {} },
            {
                type: "mention",
                props: {
                    teamId: myself.teamId,
                    userId: myself.userId,
                    teamName: "N/A",
                    userName: myself.userName,
                    userEmail: myself.userEmail,
                    customStatus: "N/A",
                    avatarImgPath: [""],
                },
            },
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [],
        children: [],
    },
];

// Milestone-flavoured equivalents of the task templates above. The
// PM chat needs a similar "something was created" message bubble for
// new milestones (see CreateTaskForm.handleCreateMilestone), but with
// milestone-specific lines: a flag-prefixed title, a sprint linkage
// row, and a multi-mention assignee row (milestones can have N
// assignees while tasks have exactly one). Effort level is omitted
// on purpose because the milestone form doesn't expose it.
export const milestoneMessageTemplate = (
    myself: UserProps,
    milestone: Milestone,
    sprintName: string,
    reporter: UserProps,
    assignees: UserProps[]
) => {
    const blocks: Array<Record<string, unknown>> = [
        {
            type: "heading",
            props: {
                level: 3,
                textColor: "default",
                textAlignment: "left",
                backgroundColor: "default",
            },
            content: [{ text: `🚩 Milestone: ${milestone.title}`, type: "text", styles: {} }],
            children: [],
        },
        {
            type: "paragraph",
            props: {
                textColor: "default",
                textAlignment: "left",
                backgroundColor: "default",
            },
            content: [
                { text: "Sprint: ", type: "text", styles: {} },
                {
                    text: sprintName,
                    type: "text",
                    styles: { bold: true, textColor: "blue" },
                },
            ],
            children: [],
        },
        {
            type: "paragraph",
            props: {
                textColor: "default",
                textAlignment: "left",
                backgroundColor: "default",
            },
            content: [
                { text: "Status: ", type: "text", styles: {} },
                getStatusConfig(milestone.status || "Open"),
            ],
            children: [],
        },
        {
            type: "paragraph",
            props: {
                textColor: "default",
                textAlignment: "left",
                backgroundColor: "default",
            },
            content: [
                { text: "Priority: ", type: "text", styles: {} },
                getPriorityConfig(milestone.priority || "default"),
            ],
            children: [],
        },
        {
            type: "paragraph",
            props: {
                textColor: "default",
                textAlignment: "left",
                backgroundColor: "default",
            },
            content: [
                { text: "Reporter: ", type: "text", styles: {} },
                {
                    type: "mention",
                    props: {
                        teamId: myself.teamId,
                        userId: reporter.userId,
                        teamName: "N/A",
                        userName: reporter.userName,
                        userEmail: reporter.userEmail,
                        customStatus: "N/A",
                        avatarImgPath: [""],
                    },
                },
            ],
            children: [],
        },
    ];

    // Multi-assignee mention row. Each assignee gets its own mention
    // node interleaved with a comma + space text node so the chat
    // renderer keeps mention click-through (you can't put commas
    // inside a mention node itself).
    const assigneeContent: Array<Record<string, unknown>> = [
        { text: "Assignees: ", type: "text", styles: {} },
    ];
    if (assignees.length === 0) {
        assigneeContent.push({
            text: "Unassigned",
            type: "text",
            styles: { italic: true, textColor: "gray" },
        });
    } else {
        assignees.forEach((a, idx) => {
            if (idx > 0) {
                assigneeContent.push({ text: ", ", type: "text", styles: {} });
            }
            assigneeContent.push({
                type: "mention",
                props: {
                    teamId: myself.teamId,
                    userId: a.userId,
                    teamName: "N/A",
                    userName: a.userName,
                    userEmail: a.userEmail,
                    customStatus: "N/A",
                    avatarImgPath: [""],
                },
            });
        });
    }
    blocks.push({
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: assigneeContent,
        children: [],
    });

    blocks.push({
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [
            {
                text: `Due: ${milestone.dueDate ?? "N/A"}`,
                type: "text",
                styles: {},
            },
        ],
        children: [],
    });

    blocks.push({
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [],
        children: [],
    });

    return blocks;
};

export const milestoneCreatedThreadMessageTemplate = (myself: UserProps) => [
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [
            { text: "A new milestone has been created by ", type: "text", styles: {} },
            {
                type: "mention",
                props: {
                    teamId: myself.teamId,
                    userId: myself.userId,
                    teamName: "N/A",
                    userName: myself.userName,
                    userEmail: myself.userEmail,
                    customStatus: "N/A",
                    avatarImgPath: [""],
                },
            },
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [],
        children: [],
    },
];
