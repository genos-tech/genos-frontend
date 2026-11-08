/**
 * The published MCP catalog and prompts (genos-api `origin/views/public/mcp/`),
 * in their order. Moved out of DevelopersPage so /home can state the real tool
 * count instead of a typed-in number (MIP-1232).
 */

import type React from "react";

import { Code } from "./Code";

export type McpRow = { name: string; type?: string; meaning: React.ReactNode };

// The published MCP catalog, in its order. Every count and list in the
// MCP section is derived from this, so the prose cannot drift from the
// table again — it did on every catalog change from 14 tools to 39.
// `taskRef` marks the arguments resolved from a display id / url / raw id.
export type McpTool = McpRow & { type: "read" | "write"; taskRef?: true };

export const MCP_TOOLS: McpTool[] = [
    {
        name: "get_task",
        type: "read",
        taskRef: true,
        meaning: (
            <>
                One task in full. Read <Code>content_markdown</Code> for the description — it keeps
                headings, checklists and code fences. Also its start date, sprint, collaborators,
                links and custom fields (by name).
            </>
        ),
    },
    {
        name: "list_my_tasks",
        type: "read",
        meaning: (
            <>
                What is on your plate. Where an agent starts when no task is named.{" "}
                <Code>delivery: open_pr</Code> narrows it to what is in flight.
            </>
        ),
    },
    {
        name: "list_tasks",
        type: "read",
        meaning:
            "Tasks you can see — your projects, plus anything you are assignee or reporter on — by project, milestone, sprint, parent task, status, priority, tag, assignee (or unassigned), a due-date range or overdue.",
    },
    {
        name: "list_projects",
        type: "read",
        meaning: "The projects you belong to, with the ids and short codes other tools take.",
    },
    {
        name: "list_milestones",
        type: "read",
        meaning: (
            <>
                Milestones in a project, with progress. For the milestones you are on, pass your
                own id from <Code>get_current_user</Code> as <Code>assignee_id</Code>.
            </>
        ),
    },
    {
        name: "get_milestone_summary",
        type: "read",
        meaning: "A milestone and the tasks under it.",
    },
    {
        name: "list_sprints",
        type: "read",
        meaning: "A project's sprints, with the ids that list_tasks filters by.",
    },
    { name: "get_sprint_summary", type: "read", meaning: "A sprint and the work in it." },
    {
        name: "get_task_blockers",
        type: "read",
        taskRef: true,
        meaning: "What a task is waiting on.",
    },
    {
        name: "get_task_history",
        type: "read",
        taskRef: true,
        meaning: "Who changed a task, what, when — and whether through the app, the agent or MCP.",
    },
    {
        name: "find_task_by_delivery",
        type: "read",
        meaning:
            "Which task a GitHub branch or PR is for. No match rather than a guess when the branch names no task.",
    },
    {
        name: "search_workspace",
        type: "read",
        meaning: "Search across tasks, notes, chat and todos.",
    },
    {
        name: "get_note",
        type: "read",
        meaning: (
            <>
                A note&apos;s body, and its comment threads: the open ones, each with the text it
                sits on and every reply. Resolved threads come with <Code>include_resolved</Code>.
            </>
        ),
    },
    {
        name: "list_my_chats",
        type: "read",
        meaning:
            "Your own direct, group and project chats, newest activity first. Find one by name.",
    },
    {
        name: "get_chat_thread",
        type: "read",
        meaning: "Read a chat, or one thread of it, paging back through older messages.",
    },
    { name: "list_my_mentions", type: "read", meaning: "Chat messages that @mention you." },
    { name: "list_channel_members", type: "read", meaning: "Who is in one chat." },
    { name: "get_current_user", type: "read", meaning: "Who the key acts as." },
    { name: "get_team_members", type: "read", meaning: "Who is in the team, for assigning." },
    { name: "list_project_members", type: "read", meaning: "Who is in one project." },
    {
        name: "list_project_tags",
        type: "read",
        meaning:
            "A project's tags, custom fields and saved filters, and the team's project labels with their ids.",
    },
    {
        name: "list_task_dependencies",
        type: "read",
        meaning: "Every blocker → blocked edge in a project or milestone, in one call.",
    },
    {
        name: "list_note_folders",
        type: "read",
        meaning: "The note folders in your My Notes and in Team Notes.",
    },
    {
        name: "list_note_access",
        type: "read",
        meaning:
            "Who can open a note and with what role (owner, editor or viewer), and whether you may change it. A note is named by its url, or by its id with its note_type.",
    },
    {
        name: "get_note_history",
        type: "read",
        meaning:
            "A note's saved versions, newest first, with who saved each, when, and a short preview, or one version in full when you pass version_no. A note is named by its url, or by its id with its note_type.",
    },
    {
        name: "list_uncompleted_todos",
        type: "read",
        meaning: "Your open to-dos, with any pending reminder.",
    },
    {
        name: "list_today_todos",
        type: "read",
        meaning: "Your to-dos for today, with any pending reminder.",
    },
    {
        name: "list_calendar_events",
        type: "read",
        meaning: "Your Google Calendar events in a date range.",
    },
    { name: "list_calendars", type: "read", meaning: "Your Google Calendars." },
    {
        name: "get_my_blockers",
        type: "read",
        meaning: "What blocks you, and who you are holding up.",
    },
    {
        name: "list_my_inbox",
        type: "read",
        meaning: "Your inbox: notifications, and the requests waiting on you.",
    },
    {
        name: "get_my_throughput",
        type: "read",
        meaning: "How many tasks you created and closed lately.",
    },
    {
        name: "get_workload_distribution",
        type: "read",
        meaning: "Open work per assignee, with what is overdue.",
    },
    {
        name: "get_top_task_closers",
        type: "read",
        meaning: "Who closed the most tasks in a period.",
    },
    {
        name: "get_task_throughput_stats",
        type: "read",
        meaning: "Tasks created and closed over a period, optionally by day or week.",
    },
    {
        name: "get_stale_tasks",
        type: "read",
        meaning: "Open tasks nobody has touched for a while.",
    },
    {
        name: "get_team_task_summary",
        type: "read",
        meaning: "A task rollup across every project you are in.",
    },
    {
        name: "get_project_activity_ranking",
        type: "read",
        meaning: "Your projects ranked by tasks, open tasks or task notes.",
    },
    {
        name: "get_milestone_assignee_counts",
        type: "read",
        meaning: "How many milestones each person is assigned to.",
    },
    { name: "get_project_summary", type: "read", meaning: "Task counts for one project." },
    {
        name: "get_my_task_summary",
        type: "read",
        meaning: "Your own task numbers: status, priority, overdue, due soon.",
    },
    {
        name: "get_pr",
        type: "read",
        meaning: "A GitHub pull request by url: state, branches, diff size.",
    },
    { name: "list_pr_reviews", type: "read", meaning: "A pull request's reviews and verdicts." },
    {
        name: "list_pr_comments",
        type: "read",
        meaning: "A pull request's conversation and inline comments.",
    },
    { name: "list_pr_files", type: "read", meaning: "The files a pull request changes." },
    { name: "list_pr_commits", type: "read", meaning: "A pull request's commits." },
    {
        name: "get_my_briefing",
        type: "read",
        meaning: (
            <>
                Catch up in one call: what other people changed on your tasks, threads and notes
                since you last asked (each item as a story, the busiest first), what waits on you,
                what you wait on, today&apos;s agenda and the top three things to look at, with the
                reasons. <Code>window</Code> is <Code>since_last</Code>, <Code>today</Code> or{" "}
                <Code>week</Code>. Your own view only, and today&apos;s calendar is read from
                Google each time and never stored.
            </>
        ),
    },
    {
        name: "update_task",
        type: "write",
        taskRef: true,
        meaning:
            "Status, title, description, priority, effort, due date, start date, milestone, parent task, project, collaborators or custom fields. A new description replaces the whole body.",
    },
    { name: "add_comment", type: "write", taskRef: true, meaning: "A comment on a task." },
    {
        name: "update_comment",
        type: "write",
        taskRef: true,
        meaning:
            "Replace the text of one of your own comments on a task. The new text is the whole comment.",
    },
    {
        name: "delete_comment",
        type: "write",
        taskRef: true,
        meaning:
            "Delete one of your own comments on a task. Nothing on this side can bring it back. Needs a key that also has the destructive opt-in.",
    },
    {
        name: "restore_task_body",
        type: "write",
        taskRef: true,
        meaning:
            "Put a task's description back to what it was before an earlier edit. The text it replaces is kept, so a restore can itself be undone.",
    },
    {
        name: "add_task_delivery",
        type: "write",
        taskRef: true,
        meaning:
            "Record the branch and PR delivering a task. Writing the same link twice updates it.",
    },
    {
        name: "remove_task_delivery",
        type: "write",
        taskRef: true,
        meaning: "Take back a branch or PR link that was recorded by hand.",
    },
    {
        name: "update_task_dependencies",
        type: "write",
        taskRef: true,
        meaning: "Add or remove “X blocks Y” between existing tasks, in one call. Refuses a loop.",
    },
    {
        name: "create_task",
        type: "write",
        meaning: (
            <>
                Needs a project id from <Code>list_projects</Code>. Can be filed under a parent
                task, and can set a start date, collaborators and custom fields.
            </>
        ),
    },
    {
        name: "assign_task",
        type: "write",
        taskRef: true,
        meaning: "Assign a task, or unassign it.",
    },
    {
        name: "update_tasks_bulk",
        type: "write",
        meaning:
            "Priority, due date, start date, status, effort, tags or milestone on many tasks in one call.",
    },
    {
        name: "create_task_plan",
        type: "write",
        taskRef: true,
        meaning: "A milestone with its tasks and dependencies, in one call.",
    },
    {
        name: "create_note",
        type: "write",
        taskRef: true,
        meaning: "A new note, optionally attached to a task.",
    },
    { name: "update_note", type: "write", meaning: "A note's title or body, or its folder." },
    {
        name: "create_todo_item",
        type: "write",
        meaning: "A personal to-do, optionally with a reminder.",
    },
    {
        name: "update_todo_item",
        type: "write",
        meaning:
            "Tick off or edit a to-do, move it to another day, or set or cancel its reminder.",
    },
    {
        name: "delete_todo_item",
        type: "write",
        meaning:
            "Permanently delete a to-do with its sub-items and reminders. Needs a key that also has the destructive opt-in.",
    },
    { name: "create_calendar_event", type: "write", meaning: "An event on your Google Calendar." },
    { name: "update_calendar_event", type: "write", meaning: "Change a calendar event." },
    {
        name: "delete_calendar_event",
        type: "write",
        meaning:
            "Delete a calendar event. Nothing on this side can bring it back. Needs a key that also has the destructive opt-in.",
    },
    {
        name: "manage_milestone",
        type: "write",
        meaning:
            "Create or change a milestone (dates, status, assignees, folder, sprint), or manage a project's milestone folders. The action argument picks which.",
    },
    {
        name: "delete_milestone",
        type: "write",
        meaning:
            "Delete a milestone. Its tasks are kept, outside any milestone. Needs a key that also has the destructive opt-in.",
    },
    {
        name: "manage_sprint",
        type: "write",
        meaning:
            "Create a sprint, or change a sprint's name or dates. The action argument picks which. Ending a sprint early is setting its end date.",
    },
    {
        name: "delete_sprint",
        type: "write",
        meaning:
            "Delete a sprint. Its milestones and their tasks are kept, outside any sprint. Needs a key that also has the destructive opt-in.",
    },
    {
        name: "manage_project",
        type: "write",
        meaning:
            "Create a project, or rename one or change its code, the prefix of its task ids. The action argument picks which.",
    },
    {
        name: "manage_project_members",
        type: "write",
        meaning:
            "Add a teammate to a project, who also gets the project's chat, or change a member's role. Needs a key that also has the destructive opt-in, because it changes who has access.",
    },
    {
        name: "add_project_tag",
        type: "write",
        meaning:
            "Add a tag to a project's tag list, so its tasks can carry it. Any member of the project may. The name is up to 20 characters, and a name that differs from an existing tag only in case is refused. A color is an optional hex like #3b82f6; the tag is grey without one. It cannot rename or delete a tag.",
    },
    {
        name: "manage_project_labels",
        type: "write",
        meaning:
            "Create a project label, or put labels on a project or take them off. The action argument picks which. Labels group projects and belong to the whole team, so a new one is visible to everyone in it. Only the project's owner or an editor may. It cannot rename or delete a label.",
    },
    {
        name: "approve_join_request",
        type: "write",
        meaning:
            "Approve someone's request to join a project: they are added to it and told, and can then see and edit it. Take the request's item_id from list_my_inbox. Project requests only. Needs a key that also has the destructive opt-in, because it changes who has access.",
    },
    {
        name: "decline_join_request",
        type: "write",
        meaning:
            "Decline someone's request to join a project: the request closes and they are told. A request that was already answered cannot be changed. Take the request's item_id from list_my_inbox. Project requests only.",
    },
    {
        name: "manage_note_folder",
        type: "write",
        meaning:
            "Create a folder for notes, in My Notes or Team Notes, or rename one. The action argument picks which. A new top-level Team Notes folder is private to you. It cannot move or delete a folder.",
    },
    {
        name: "favorite_note",
        type: "write",
        meaning:
            "Star or unstar a note, or a note folder, in your own sidebar. A note is named by its url, or by its id with its note_type. Nothing else changes.",
    },
    {
        name: "delete_note",
        type: "write",
        meaning:
            "Delete a note for good, with its version history. Only its author or owner may, and a note with sub-notes is refused. A note is named by its url, or by its id with its note_type. Needs a key that also has the destructive opt-in.",
    },
    {
        name: "delete_note_folder",
        type: "write",
        meaning:
            "Delete a note folder. A folder that holds notes or folders is refused unless include_contents is true, which deletes everything inside it for good. Needs a key that also has the destructive opt-in.",
    },
    {
        name: "manage_note_sharing",
        type: "write",
        meaning:
            "Share a note with a teammate as an editor or a viewer, or stop sharing it. Only its owner may, and the person is not notified. A note is named by its url, or by its id with its note_type. Needs a key that also has the destructive opt-in, because it changes who has access.",
    },
    {
        name: "restore_note_version",
        type: "write",
        meaning:
            "Put an earlier version of a note back, title and body. What the note says now is kept as a version first, so a restore can itself be undone. If the live editor could not be updated, the result says so. A note is named by its url, or by its id with its note_type.",
    },
];

// The two MCP prompts (genos-api `origin/views/public/mcp/prompts.py`), in its order.
export const MCP_PROMPTS: McpRow[] = [
    {
        name: "catch_me_up",
        type: "prompt",
        meaning:
            "What changed on your things since you last looked, what needs you and what you are waiting on, in a few lines. Takes an optional window: since_last, today or week.",
    },
    {
        name: "plan_my_day",
        type: "prompt",
        meaning:
            "Up to five things to focus on today, with the reasons, then your choice of what to do about them. Takes an optional focus, in your own words.",
    },
];

export const MCP_READS = MCP_TOOLS.filter((t) => t.type === "read");
export const MCP_WRITES = MCP_TOOLS.filter((t) => t.type === "write");
export const MCP_TASK_REF_TOOLS = MCP_TOOLS.filter((t) => t.taskRef);
