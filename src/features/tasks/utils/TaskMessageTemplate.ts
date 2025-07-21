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

export const taskMessageTemplate = (task: TaskProps) => [
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
                text: task.assignee.userName,
                type: "text",
                styles: { code: true },
            },
            { text: " (", type: "text", styles: {} },
            {
                href: task.assignee.userEmail,
                type: "link",
                content: [{ text: task.assignee.userEmail, type: "text", styles: {} }],
            },
            { text: ") ", type: "text", styles: {} },
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
                text: task.reporter.userName,
                type: "text",
                styles: { code: true },
            },
            { text: " (", type: "text", styles: {} },
            {
                href: task.reporter.userEmail,
                type: "link",
                content: [{ text: task.reporter.userEmail, type: "text", styles: {} }],
            },
            { text: ") ", type: "text", styles: {} },
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

export const taskThreadMessageTemplate = (myself: UserProps, task: TaskProps) => [
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [
            { text: "Task marked as ", type: "text", styles: {} },
            getStatusConfig(task.status.status || "default"),
            { text: " by ", type: "text", styles: {} },
            {
                text: myself.userName,
                type: "text",
                styles: { code: true },
            },
            { text: " (", type: "text", styles: {} },
            {
                href: myself.userEmail,
                type: "link",
                content: [{ text: myself.userEmail, type: "text", styles: {} }],
            },
            { text: ") ", type: "text", styles: {} },
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
