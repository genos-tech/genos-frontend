import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";

const statusLine = {
    Open: { text: "OPEN", type: "text", styles: { bold: true, textColor: "blue" } },
    WIP: { text: "WIP", type: "text", styles: { bold: true, textColor: "yellow" } },
    Pending: { text: "PENDING", type: "text", styles: { bold: true, textColor: "pink" } },
    Closed: { text: "CLOSED", type: "text", styles: { bold: true, textColor: "green" } },
    Deleted: { text: "DELETED", type: "text", styles: { bold: true, textColor: "red" } },
    default: { text: "UNKNOWN", type: "text", styles: { bold: true, textColor: "gray" } },
};
type StatusKey = keyof typeof statusLine;
function getStatusConfig(key: string): (typeof statusLine)[StatusKey] {
    return key in statusLine ? statusLine[key as StatusKey] : statusLine["default"];
}

const priorityLine = {
    Low: { text: "LOW", type: "text", styles: { bold: true, textColor: "blue" } },
    Medium: { text: "MEDIUM", type: "text", styles: { bold: true, textColor: "green" } },
    High: { text: "HIGH", type: "text", styles: { bold: true, textColor: "red" } },
    default: { text: "N/A", type: "text", styles: { bold: true, textColor: "gray" } },
};
type PriorityKey = keyof typeof priorityLine;
function getPriorityConfig(key: string): (typeof priorityLine)[PriorityKey] {
    return key in priorityLine ? priorityLine[key as PriorityKey] : priorityLine["default"];
}

const effortLevelLine = {
    Low: { text: "LOW", type: "text", styles: { bold: true, textColor: "blue" } },
    Medium: { text: "MEDIUM", type: "text", styles: { bold: true, textColor: "green" } },
    High: { text: "HIGH", type: "text", styles: { bold: true, textColor: "red" } },
    default: { text: "N/A", type: "text", styles: { bold: true, textColor: "gray" } },
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
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [
            { text: "Priority: ", type: "text", styles: {} },
            getPriorityConfig(task.priority.priority || "default"),
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [
            { text: "Effort Level: ", type: "text", styles: {} },
            getEffortLevelConfig(task.effortLevel.level || "default"),
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [
            {
                text: "Assignee: ",
                type: "text",
                styles: {},
            },
            {
                type: "mention",
                props: {
                    online: false,
                    teamId: myself.teamId,
                    userId: task.assignee.userId,
                    teamName: "Unknown",
                    userName: task.assignee.userName,
                    userEmail: task.assignee.userEmail,
                    customStatus: "Unknown",
                    avatarImgPath: [""],
                },
            },
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [
            {
                text: "Reporter: ",
                type: "text",
                styles: {},
            },
            {
                type: "mention",
                props: {
                    online: false,
                    teamId: myself.teamId,
                    userId: task.reporter.userId,
                    teamName: "Unknown",
                    userName: task.reporter.userName,
                    userEmail: task.reporter.userEmail,
                    customStatus: "Unknown",
                    avatarImgPath: [""],
                },
            },
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [{ text: `Due: ${task.dueDate}`, type: "text", styles: {} }],
        children: [],
    },
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [],
        children: [],
    },
];

export const taskCreatedThreadMessageTemplate = (myself: UserProps) => [
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [
            { text: "A new task has been created by ", type: "text", styles: {} },
            {
                type: "mention",
                props: {
                    online: false,
                    teamId: myself.teamId,
                    userId: myself.userId,
                    teamName: "Unknown",
                    userName: myself.userName,
                    userEmail: myself.userEmail,
                    customStatus: "Unknown",
                    avatarImgPath: [""],
                },
            },
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [],
        children: [],
    },
];

export const taskThreadMessageTemplate = (myself: UserProps, task: TaskProps) => [
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [
            { text: "The task marked as ", type: "text", styles: {} },
            getStatusConfig(task.status.status || "default"),
            { text: " by ", type: "text", styles: {} },
            {
                type: "mention",
                props: {
                    online: false,
                    teamId: myself.teamId,
                    userId: myself.userId,
                    teamName: "Unknown",
                    userName: myself.userName,
                    userEmail: myself.userEmail,
                    customStatus: "Unknown",
                    avatarImgPath: [""],
                },
            },
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [],
        children: [],
    },
];

export const taskThreadMessageForCommentAddedTemplate = (myself: UserProps) => [
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [
            { text: "A new comment from ", type: "text", styles: {} },
            {
                type: "mention",
                props: {
                    online: false,
                    teamId: myself.teamId,
                    userId: myself.userId,
                    teamName: "Unknown",
                    userName: myself.userName,
                    userEmail: myself.userEmail,
                    customStatus: "Unknown",
                    avatarImgPath: [""],
                },
            },
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [],
        children: [],
    },
];
