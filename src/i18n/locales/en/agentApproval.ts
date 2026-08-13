// Strings for the structured write-tool approval previews
// (features/agentQA/approval/*). The ApprovalCard shell itself stays
// props-only/string-free; only the per-tool preview renderers consume
// this namespace directly via useTranslation() — threading ~15 labels
// through every surface's label props would be churn with no benefit.
export const agentApproval = {
    newMilestone: "New milestone",
    existingMilestone: "Existing milestone",
    project: "Project",
    tasks: "Tasks",
    due: "Due",
    start: "Start",
    assignee: "Assignee",
    assignees: "Assignees",
    subtask: "Sub-task",
    subtasksOf: "Sub-tasks of {task}",
    blockedBy: "Blocked by {tasks}",
    newPersonalNote: "New note in My Notes",
    newTaskNote: "New task note",
    updateNote: "Update note: {note}",
    newTask: "New task",
    updateTask: "Update task: {task}",
    commentOn: "Comment on {task}",
    task: "Task",
    folder: "Folder",
    changesTitle: "Title",
    changesBody: "Body",
    changesFolder: "Folder move",
    showDetails: "Show details",
    hideDetails: "Hide details",
    planFooter: "{tasks} task(s) · {deps} dependency(ies)",
    updatesHeader: "{count} task change(s)",
    noChanges: "(no field changes)",
    fieldLabels: {
        priority: "Priority",
        effort_level: "Effort",
        status: "Status",
        due_date: "Due",
    },
    cleared: "none",
    unset: "—",
    // Friendly, non-technical labels for every agent tool, keyed by the
    // backend `tool_name`. Used for the in-flight tool-progress strip
    // ("Searching your workspace") and the approval-card title
    // ("Approval required: Creating a task") so users never see engineering
    // identifiers like `search_knowledge_base` or `update_tasks_bulk`.
    // Present-continuous phrasing reads as "happening now" on the strip and
    // still fits the approval-title template. Keys mirror the authoritative
    // registry in genos-api `search_engine/agent/tools/categories.py`
    // (all 57 tools); an unmapped name falls back to the raw tool_name.
    toolNames: {
        // search
        search_knowledge_base: "Searching your workspace",
        search_past_conversations: "Searching past conversations",
        // web
        search_web: "Searching the web",
        // fetch (single entity)
        fetch_task: "Opening a task",
        fetch_note: "Opening a note",
        fetch_chat_thread: "Reading a conversation",
        // tasks (read)
        list_tasks: "Looking through tasks",
        list_task_dependencies: "Checking task dependencies",
        get_task_blockers: "Checking what's blocking a task",
        get_stale_tasks: "Finding stalled tasks",
        get_task_throughput_stats: "Reviewing task throughput",
        // tasks (write)
        create_task: "Creating a task",
        create_task_plan: "Drafting a task plan",
        update_task: "Updating a task",
        update_tasks_bulk: "Updating several tasks",
        assign_task: "Assigning a task",
        add_comment: "Adding a comment",
        // projects
        list_projects: "Looking through projects",
        get_project_summary: "Summarizing a project",
        get_project_activity_ranking: "Ranking project activity",
        // milestones + sprints
        list_milestones: "Looking through milestones",
        get_milestone_summary: "Summarizing a milestone",
        get_milestone_assignee_counts: "Counting milestone assignments",
        list_sprints: "Looking through sprints",
        get_sprint_summary: "Summarizing a sprint",
        // team
        get_team_members: "Looking up team members",
        list_project_members: "Looking up project members",
        list_channel_members: "Looking up channel members",
        get_workload_distribution: "Checking workload distribution",
        get_top_task_closers: "Finding top task closers",
        get_team_task_summary: "Summarizing the team's tasks",
        // identity
        get_current_user: "Checking who you are",
        // me (the asking user's own work)
        get_my_task_summary: "Summarizing your tasks",
        get_my_focus_tasks: "Finding your focus tasks",
        get_my_schedule: "Checking your schedule",
        get_my_throughput: "Reviewing your throughput",
        get_my_blockers: "Checking what's blocking you",
        list_my_milestones: "Looking up your milestones",
        list_my_inbox: "Checking your inbox",
        list_my_mentions: "Finding where you're mentioned",
        // pull requests
        fetch_pr: "Opening a pull request",
        list_pr_comments: "Reading pull-request comments",
        list_pr_files: "Reviewing changed files",
        list_pr_reviews: "Reading pull-request reviews",
        list_pr_commits: "Reviewing commits",
        // calendar
        list_calendars: "Looking up your calendars",
        list_calendar_events: "Checking calendar events",
        create_calendar_event: "Creating a calendar event",
        update_calendar_event: "Updating a calendar event",
        delete_calendar_event: "Deleting a calendar event",
        // to-dos
        list_today_todos: "Checking today's to-dos",
        list_uncompleted_todos: "Checking open to-dos",
        create_todo_item: "Adding a to-do",
        update_todo_item: "Updating a to-do",
        // notes
        list_note_folders: "Looking through note folders",
        create_note: "Creating a note",
        update_note: "Updating a note",
    },
} as const;
