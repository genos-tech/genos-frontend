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
    newTeamNote: "New note in Team Notes",
    newChatNote: "New chat note",
    chat: "Chat",
    thread: "Thread",
    updateNote: "Update note: {note}",
    newTask: "New task",
    updateTask: "Update task: {task}",
    commentOn: "Comment on {task}",
    updateComment: "Replace your comment #{comment} on {task}",
    deleteComment: "Delete your comment #{comment} on {task}",
    restoreTaskBody: "Restore the previous description of {task}",
    historyEntry: "History entry #{entry}",
    cannotUndo: "This action cannot be undone",
    restoreKeepsCurrent:
        "This replaces the description as it is now with the one it had before this edit. You can undo it: the description you replace is kept in this history too.",
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
        milestone_id: "Milestone",
        parent_task_id: "Parent",
        project_id: "Project",
        start_date: "Start",
        collaborators: "Collaborators",
        tags: "Tags",
        assignee_ids: "Assignees",
        milestone_folder_id: "Folder",
        sprint_id: "Sprint",
        target_date: "Day",
        reminder_at: "Reminder",
    },
    category: "Category",
    updateTodo: "Update to-do: {item}",
    newTodo: "New to-do",
    deleteTodo: "Delete to-do: {item}",
    todoDone: "Mark done",
    todoReopen: "Reopen",
    reminderIn: "in {minutes} min",
    reminderZone: "{time} ({zone})",
    alsoDeletesSubItems: "also deletes {count} sub-item(s)",
    alsoDropsReminder: "its reminder is dropped",
    milestoneAction: {
        create: "New milestone",
        update: "Update milestone: {milestone}",
        create_folder: "New milestone folder",
        rename_folder: "Rename milestone folder",
        delete_folder: "Delete milestone folder",
    },
    deleteMilestone: "Delete milestone: {milestone}",
    milestoneTasksKept: "{count} task(s) stay in the project, outside any milestone",
    folderUnfiles: "{count} milestone(s) leave the folder",
    newSprint: "New sprint",
    updateSprint: "Update sprint: {sprint}",
    deleteSprint: "Delete sprint: {sprint}",
    sprintFieldLabels: {
        name: "Name",
        start_date: "Start",
        end_date: "End",
    },
    sprintMilestonesKept:
        "Its milestones and their tasks are kept. They just no longer belong to a sprint.",
    newProject: "New project",
    updateProject: "Update project: {project}",
    projectFieldLabels: {
        name: "Name",
        code: "Code",
    },
    projectPrivate: "Private",
    projectPublic: "Public",
    projectPeopleAdded: "Adding {count, plural, one {# person} other {# people}}: {people}",
    projectCodeHint: "The code is the prefix of the project's task ids.",
    addProjectMember: "Add {person} to {project}",
    projectMemberGetsChat: "They also get the project's chat.",
    makeProjectEditor: "Make {person} an editor of {project}",
    makeProjectViewer: "Make {person} a viewer of {project}",
    changeProjectRole: "Change {person}'s role in {project}",
    addProjectTag: "Add tag",
    projectTagOn: "on {project}",
    newProjectLabel: "New project label",
    projectLabelTeamWide: "Visible to the whole team.",
    putLabelsOnProject: "Put labels on {project}",
    takeLabelsOffProject: "Take labels off {project}",
    changeProjectLabels: "Change labels on {project}",
    projectColorInvalid: "“{color}” is not a hex color like #3b82f6, so it will be refused.",
    approveJoinRequest: "Approve {request}",
    declineJoinRequest: "Decline {request}",
    joinRequest: "join request",
    joinRequestNamed: "join request: {request}",
    joinRequestWithId: "join request #{id}",
    approveJoinRequestEffect:
        "They are added to the project and told. They can then see and edit it.",
    declineJoinRequestEffect: "The request is closed and they are told it was declined.",
    deleteProject: "Delete project {project}",
    deleteProjectUnnamed: "Delete {project}",
    thisProject: "this project",
    thisProjectWithId: "this project (#{id})",
    projectNameGiven: "Name given: {name}",
    projectNameDiffers:
        "That is not the project's name. The project is only deleted if the name matches exactly.",
    newNoteFolder: "Create folder {name}",
    renameNoteFolder: "Rename folder {folder} to {name}",
    insideNoteFolder: "Inside {folder}",
    noteSpaceMine: "My Notes",
    noteSpaceTeam: "Team Notes",
    noteFolderTeamPrivate: "Private to you until you share it from the app.",
    addFavorite: "Add {item} to favorites",
    removeFavorite: "Remove {item} from favorites",
    thisNote: "this note",
    thisNoteWithId: "this note (#{id})",
    thisFolder: "this folder",
    thisPerson: "this person",
    deleteNote: "Delete note {note}",
    deleteNoteUnnamed: "Delete {note}",
    deleteNoteWarning: "Deletes the note and its version history for good.",
    deleteNoteFolder: "Delete folder {folder}",
    deleteThisNoteFolder: "Delete this folder",
    deleteNoteFolderContents: "Also deletes every note and folder inside it, for good.",
    deleteNoteFolderOnlyEmpty: "Only goes ahead if the folder is empty.",
    shareNote: "Share {note} with {person}",
    shareNoteAsEditor: "Share {note} with {person} as an editor",
    shareNoteAsViewer: "Share {note} with {person} as a viewer",
    unshareNote: "Stop sharing {note} with {person}",
    noteShareNotNotified: "They are not notified.",
    restoreNote: "Restore note {note} to {version}",
    restoreNoteUnnamed: "Restore {note} to {version}",
    versionNumber: "version {n}",
    anEarlierVersion: "an earlier version",
    restoreNoteKeepsCurrent:
        "What the note says now is kept as a version first, so this can be undone.",
    cleared: "none",
    unset: "—",
    edit: {
        // Edit before approve: the editors a pending write card offers for the
        // fields the server lists as editable (genos-api #570), and the mark a
        // finished write carries when the person changed it first.
        edit: "Edit",
        cancelEdit: "Cancel edit",
        reset: "Reset",
        resetField: "Reset {field}",
        approveWithChanges: "Approve with your changes",
        changesCount: "{count, plural, one {# change} other {# changes}}",
        hint: "Change what you want, then approve. Genos runs what you see here.",
        groupLabel: "Edit before approving",
        proposed: "Genos proposed: {value}",
        now: "Now: {value}",
        asProposed: "{value} (as proposed)",
        rejected:
            "Some of your changes can't be applied. Nothing was approved or run: fix them and approve again.",
        tagPlaceholder: "Add a tag",
        addTag: "Add",
        removeTag: "Remove tag {tag}",
        noTags: "No tags (this clears them)",
        tagsNote:
            "Each tag must already exist in the project. If one doesn't, the change is refused when it runs.",
        edited: "Edited",
        row: "Row {n}",
        fields: {
            title: "Title",
            description: "Description",
            addToEnd: "Text to add at the end",
            addToStart: "Text to add at the start",
            comment: "Comment",
            content: "Content",
            notes: "Notes",
            priority: "Priority",
            effort: "Effort",
            status: "Status",
            due: "Due date",
            start: "Start date",
            day: "Day",
            reminder: "Reminder",
            tags: "Tags",
        },
        errors: {
            required: "{field} can't be empty.",
            tooLong: "{field} is too long (at most {max} characters).",
            bodyTooLong: "{field} is too long (the limit is 256 KB).",
            badDate: "{field}: enter a real date.",
            dateRequired: "{field}: choose a date.",
            badReminder: "{field}: enter a date and a time.",
            reminderRequired: "{field}: choose a date and a time.",
        },
    },
    // Undo of an approved write (genos-api `agent/undo.py`, `undo_apply.py`). The
    // server's own English `error` / `summary` is only a fallback: these are what
    // people read. One namespace for every host of an answer turn
    // (`agentQA/undoCopy.ts` builds the turn's labels from it).
    undo: {
        // The chip on an approval card whose write can't be undone.
        chip: "Can't be undone",
        // Why, per the server's `undo_reason`. A code not listed reads as `not_yet`.
        reasons: {
            irreversible_delete: "This deletes it for good.",
            notified_people:
                "This involves other people, such as giving access or sending a message, and undo can't take that back.",
            no_snapshot: "The old values aren't kept, so there is nothing to put back.",
            unsupported_fields: "This change touches something undo can't put back.",
            not_yet: "Undo isn't available for this kind of change yet.",
        },
        // The control on a finished write.
        button: "Undo",
        // The button's accessible name when a turn has several (the tool names the write).
        buttonFor: "Undo: {tool}",
        undoing: "Undoing…",
        retry: "Try again",
        // Said once before (tooltip) and once after (status line): undo puts data
        // back, it does not recall what already left.
        notRecalled: "Anything already sent, such as notifications, isn't recalled.",
        // What the click does, per tool (the tooltip's first sentence).
        hints: {
            create_task: "Deletes the task Genos created.",
            update_task: "Puts back the earlier values.",
            restore_task_body: "Puts back the description as it was before.",
            add_comment: "Deletes the comment Genos added.",
            create_note: "Deletes the note Genos created.",
            update_note: "Puts back the earlier text of the note.",
            restore_note_version: "Puts back the version of the note this replaced.",
            fallback: "Reverses this change.",
        },
        // The two fields an undo can report that `fieldLabels` has no word for
        // (everything else it reports is in `fieldLabels`).
        fields: {
            title: "Title",
            body: "Content",
        },
        // Joins a list of field names ("Status, Priority").
        listSeparator: ", ",
        // The status line after an undo that worked.
        done: {
            // A restored turn whose write was already undone.
            alreadyUndone: "Undone",
            generic: "Undone.",
            restored: "Undone. Put back: {fields}.",
            restoredSkipped:
                "Undone. Put back: {fields}. Left as they are, because they changed since: {skipped}.",
            deletedTask: "Undone. Task {task} was deleted.",
            deletedTaskUnnamed: "Undone. The task was deleted.",
            deletedNote: "Undone. The note “{title}” was deleted.",
            deletedNoteUnnamed: "Undone. The note was deleted.",
            deletedComment: "Undone. The comment was deleted.",
        },
        // The status line when it did not, one sentence per code. Nothing was changed.
        refused: {
            not_found: "Genos can't find this change any more, so nothing was undone.",
            not_undoable: "This change can't be undone. Nothing was changed.",
            already_undone: "This change was already undone.",
            changed_since:
                "This was changed after Genos made its change, so it was left as it is. Nothing was undone.",
            changedSinceFields:
                "Nothing was undone: {fields} changed after Genos made its change, so they were left as they are.",
            expired:
                "It's too late to undo this change: Undo is only available for a limited time.",
            permission_lost:
                "You can no longer change this, so it can't be undone. Nothing was changed.",
            throttled: "That was too many undo attempts. Wait a moment and try again.",
            unauthorized:
                "You were signed out, so nothing was undone. Sign in again, then try again.",
            network:
                "Couldn't reach Genos, so nothing was undone. Check your connection and try again.",
            server: "Something went wrong on our side, so nothing was undone. Try again.",
            unknown: "Couldn't undo this change.",
        },
    },
    // Friendly, non-technical labels for every agent tool, keyed by the
    // backend `tool_name`. Used for the in-flight tool-progress strip
    // ("Searching your workspace") and the approval-card title
    // ("Approval required: Creating a task") so users never see engineering
    // identifiers like `search_knowledge_base` or `update_tasks_bulk`.
    // Present-continuous phrasing reads as "happening now" on the strip and
    // still fits the approval-title template. Keys mirror the authoritative
    // registry in genos-api `search_engine/agent/tools/categories.py`
    // (all 60 tools); an unmapped name falls back to the raw tool_name.
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
        get_task_history: "Reading a task's history",
        find_task_by_delivery: "Finding the task for a branch",
        get_stale_tasks: "Finding stalled tasks",
        get_task_throughput_stats: "Reviewing task throughput",
        // tasks (write)
        create_task: "Creating a task",
        create_task_plan: "Drafting a task plan",
        update_task: "Updating a task",
        update_tasks_bulk: "Updating several tasks",
        assign_task: "Assigning a task",
        add_comment: "Adding a comment",
        update_comment: "Replacing one of your comments",
        delete_comment: "Deleting one of your comments",
        restore_task_body: "Restoring a task's description",
        add_task_delivery: "Linking a pull request to a task",
        update_task_dependencies: "Linking task dependencies",
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
        // milestones
        manage_milestone: "Managing a milestone",
        delete_milestone: "Deleting a milestone",
        // sprints
        manage_sprint: "Managing a sprint",
        delete_sprint: "Deleting a sprint",
        // projects
        manage_project: "Managing a project",
        manage_project_members: "Managing project members",
        add_project_tag: "Adding a project tag",
        manage_project_labels: "Managing project labels",
        approve_join_request: "Approving a request to join a project",
        decline_join_request: "Declining a request to join a project",
        delete_project: "Deleting a project",
        // to-dos
        list_today_todos: "Checking today's to-dos",
        list_uncompleted_todos: "Checking open to-dos",
        create_todo_item: "Adding a to-do",
        update_todo_item: "Updating a to-do",
        delete_todo_item: "Deleting a to-do",
        // chats
        list_my_chats: "Finding your chats",
        list_my_unread: "Checking what you haven't read",
        // notes
        list_note_folders: "Looking through note folders",
        create_note: "Creating a note",
        update_note: "Updating a note",
        manage_note_folder: "Managing a note folder",
        favorite_note: "Updating your favorites",
        delete_note: "Deleting a note",
        delete_note_folder: "Deleting a note folder",
        manage_note_sharing: "Managing note sharing",
        list_note_access: "Checking who can open a note",
        fetch_note_history: "Reading a note's history",
        restore_note_version: "Restoring an earlier version of a note",
    },
} as const;
