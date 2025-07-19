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
    return key in priorityLine ? priorityLine[key as PriorityKey] : statusLine["default"];
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
        content: [{ text: `🧾 Task: ${task.title}`, type: "text", styles: {} }],
        children: [],
    },
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [{ text: `ID: ${task.id}`, type: "text", styles: {} }],
        children: [],
    },
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [
            { text: "Status: ", type: "text", styles: {} },
            getStatusConfig(task.status.status || "default"),
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [
            { text: "Priority: ", type: "text", styles: {} },
            getPriorityConfig(task.status.status || "default"),
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
                href: task.assignee.userEmail,
                type: "link",
                content: [{ text: task.assignee.userEmail, type: "text", styles: {} }],
            },
            { text: " ", type: "text", styles: {} },
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
                href: task.reporter.userEmail,
                type: "link",
                content: [{ text: task.reporter.userEmail, type: "text", styles: {} }],
            },
            { text: " ", type: "text", styles: {} },
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
