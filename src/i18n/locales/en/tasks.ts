export const tasks = {
    list: {
        empty: "No tasks yet",
        searchPlaceholder: "Search tasks…",
    },
    create: {
        title: "Create a new task",
        titlePlaceholder: "Enter task title…",
        descriptionPlaceholder: "Add a description…",
    },
    modal: {
        deleteTitle: "Delete Task?",
        deleteBody: "This action cannot be undone",
        deleteConfirm: "Delete",
    },
    status: {
        todo: "To do",
        inProgress: "In progress",
        done: "Done",
    },
    members: {
        searchPlaceholder: "Search members…",
        assign: "Assign",
        unassign: "Unassign",
    },

    // Initial empty-project create card (utils/taskInit.tsx)
    init: {
        heading: "Create your first project",
        projectNamePlaceholder: "Project Name",
        createButton: "Create",
        emptyProjectName: "Project name is empty !!!",
        creationFailed: "Project Creation Failed",
    },

    // Attachment upload overlay (TaskCreateAttachmentBlock).
    attachmentUpload: {
        uploading: "Uploading attachments…",
        fileCount: "{count, plural, one {# file} other {# files}}",
    },

    // Error strings thrown from service / hook modules.
    errors: {
        createTaskFailed: "Failed to create a task",
        threadAlreadyHasTask:
            "This thread already has a task — a thread can only be linked to one task.",
        taskLimitReached:
            "You've used {used} of your plan's {limit} monthly task creations. Upgrade your plan to create more tasks.",
        deleteEmptyTaskFailed: "Failed to delete the empty task",
        attachmentUploadFailed: "Attachment Upload Failed",
        sendInboxMessageFailed: "Failed to send a inbox message",
        updateTagFailed: "Failed to update tag",
        deleteTagFailed: "Failed to delete tag",
        tagCreationFailed: "Tag Creation Failed",
        projectCreationFailed: "Project Creation Failed",
        taskTitleRequired: "Task title is required !!!",
        targetProjectRequired: "Target project is required !!!",
        targetTaskIdRequired: "Target task id is required !!!",
        projectIdNotSpecified: "Project ID is not specified.",
        unauthorizedNoToken: "Unauthorized. Auth toke is not found.",
        messageIdExists: "Message Id already exists.",
        unauthorizedPleaseLogin: "Unauthorized. Please log in again.",
    },

    // Common autocomplete placeholders.
    autocomplete: {
        statusPlaceholder: "Status",
        priorityPlaceholder: "Priority",
        effortLevelPlaceholder: "Effort Level",
        tagsPlaceholder: "Tags",
        youSuffix: "(You)",
    },

    // Sidebar / search box on the tasks sidebar.
    sidebar: {
        searchPlaceholder: "Search tasks (closed & deleted excluded)...",
        searchAriaLabel: "Search Tasks",
        recents: "Recents",
        projects: "Projects",
        milestones: "Milestones",
        newProject: "New Project",
        joinProject: "Join Project",
        sprintBoard: "Sprint Board",
        taskTable: "Task Table",
        home: "Home",
        viewsHeader: "Views",
        tasksHeader: "Tasks",
        projectsHeader: "Projects",
        board: "Board",
        table: "Table",
        footerTagline: "Stay productive",
        noProjectsAvailable: "No projects available",
        addMilestone: "Add milestone",
        moveToNoSprint: "Move to: No sprint",
        moveToSprintPrefix: "Move to: ",
        sprintFallback: "Sprint",
        noSprint: "No sprint",
    },

    // Task header (top bar of tasks home).
    header: {
        privateProject: "Private Project",
        refreshTasks: "Refresh Tasks",
        closePanel: "Close Panel",
        taskButton: "Task",
        newTagMenuItem: "New Tag",
        newProjectMenuItem: "New Project",
        newMilestoneMenuItem: "New Milestone",
        customizeFieldsMenuItem: "Customize Task Fields",
        deleteProjectMenuItem: "Delete Project",
    },

    // Tooltips and small bits in the contents/base modules.
    tooltips: {
        edit: "Edit",
        delete: "Delete",
        save: "Save",
        cancel: "Cancel",
        download: "Download",
        close: "Close",
        checkThread: "Check source thread",
        dragToReorder: "Drag to reorder",
        dragToResizeColumn: "Drag to resize column",
        resetFilters: "Reset all filters to default",
        createNewTag: "Create a New Tag",
        manageTags: "Manage Tags",
        sprintSettings: "Sprint settings",
        manageSprints: "Manage sprints",
        sprintBurndown: "Closed in sprint / Created in sprint",
        milestone: "Milestone",
        tasksInThisMilestone: "Tasks in this milestone",
        refreshBranches: "Refresh branches",
        refreshPullRequests: "Refresh linked PRs",
        addStartDate: "Add start date",
        // Shared diagram-trigger tooltip used by the milestone-pane
        // button and the TaskTitleBlock graph button. The "WithShortcut"
        // variant suffixes the keyboard combo for the TaskPreview button,
        // which is the only entry point reachable via Ctrl+Cmd+G /
        // Ctrl+Alt+G.
        openTaskGraph: "Open task graph",
        openTaskGraphWithShortcut: "Open task graph ({shortcut})",
    },

    // Generic action button labels reused across screens.
    buttons: {
        create: "Create",
        save: "Save",
        cancel: "Cancel",
        delete: "Delete",
        confirm: "Confirm",
        ok: "OK",
        close: "Close",
    },

    // Modal dialogs.
    modals: {
        deleteTask: {
            title: "Delete Task?",
            body: "This action cannot be undone",
            confirmButton: "Delete Task",
            cancelButton: "Cancel",
        },
        deleteComment: {
            title: "Delete Comment?",
            body: "This action cannot be undone",
            confirmButton: "Delete Comment",
            cancelButton: "Cancel",
            error: "Failed to delete the comment.",
        },
        createProject: {
            heading: "Create New Project",
            namePlaceholder: "Enter project name...",
            privateProject: "Private Project",
            publicProject: "Public Project",
            cancelButton: "Cancel",
            createButton: "Create Project",
            creationFailed: "Project Creation Failed",
            joinFailed: "Failed to join the created project",
        },
        deleteProject: {
            heading: "Delete Project?",
            body: "This action cannot be undone",
            // Every line below is verified against what the API actually does
            // (see the delete-scope tests in genos-api `test_project_views`).
            // A warning users rely on before an irreversible action has to be
            // exactly true — not reassuring, and not vague.
            destroyedTitle: "Permanently deleted:",
            destroyedMilestones: "All milestones",
            destroyedTasks: "All tasks, with their comments, attachments and notes",
            destroyedSprints: "All sprints and the sprint schedule",
            destroyedMembersTags: "Project members and tags",
            // The PM channel is soft-deleted, so the messages are not erased —
            // but nobody can reach them again. Saying "kept" would imply the
            // history is still readable; saying "deleted" would be untrue.
            chatNote:
                "The project chat disappears for everyone. Its messages aren't erased, but nobody can open them again.",
            cancelButton: "Cancel",
            confirmButton: "Delete Project",
            unexpectedError: "Unexpected error",
        },
        joinProject: {
            requestHeading: "Request to Join",
            joinHeading: "Join Project",
            privateBadge: "Private Project",
            publicBadge: "Public Project",
            cancelButton: "Cancel",
            sendButton: "Send",
            joinButton: "Join",
            socketNotFound: "Socket not found.",
            requestMessagePrefix: "Has sent a request to join the project: ",
            requestMessageSuffix: ".",
            sendMessageFailed: "Failed to send a inbox message",
            joinFailed: "Failed to join the created project",
        },
        createTag: {
            heading: "Create New Tag",
            namePlaceholder: "Enter tag name...",
            cancelButton: "Cancel",
            createButton: "Create Tag",
            creationFailed: "Tag Creation Failed",
            nameEmpty: "Tag name cannot be empty.",
            nameNoSpaces: "Tag name must not contain spaces.",
            previewLabel: "Preview:",
        },
        manageTags: {
            heading: "Manage Tags",
            saveTooltip: "Save",
            cancelTooltip: "Cancel",
            editTooltip: "Edit",
            deleteTooltip: "Delete",
            updateFailed: "Failed to update tag",
            deleteFailed: "Failed to delete tag",
            noTagsCreated: "No tags created yet.",
            previewName: "preview",
            deletePrompt: "Delete?",
            yes: "Yes",
            no: "No",
            closeButton: "Close",
        },
        manageTemplates: {
            heading: "Project templates",
            newTemplate: "New template",
            empty: "No project templates yet.",
            nameLabel: "Template name",
            namePlaceholder: "e.g. Design doc",
            nameEmpty: "Please enter a template name.",
            bodyLabel: "Template body",
            create: "Create",
            save: "Save",
            cancel: "Cancel",
            close: "Close",
            saveFailed: "Failed to save template",
            deleteFailed: "Failed to delete template",
            deletePrompt: "Delete?",
            yes: "Yes",
            no: "No",
            editTooltip: "Edit",
            deleteTooltip: "Delete",
        },
        customizeFields: {
            heading: "Customize Task Fields",
            description:
                "Make fields required and set default values for new tasks and milestones in this project. Only the project owner can change these.",
            requiredLabel: "Required",
            defaultLabel: "Default value",
            alwaysRequired: "Always required",
            statusAuto: "Set automatically at creation",
            noTagsHint: "Add project tags to make this field required",
            creatorOption: "Creator",
            noneOption: "None",
            dueOffsetPrefix: "Today +",
            dueOffsetSuffix: "days",
            dueOffsetLabel: "Days after creation",
            save: "Save",
            cancel: "Cancel",
            saveFailed: "Couldn't save — only the project owner can change these settings.",
        },
    },

    // Picker components.
    picker: {
        noSprintLabel: "No sprint",
        noMilestoneLabel: "No milestone",
        sprintFallback: "Sprint",
        addAssignees: "Add assignees",
        tasksSuffix: " tasks",
    },

    // Milestones section in board / dashboard.
    milestones: {
        sectionInSprint: "Milestones in {name}",
        sectionNoSprint: "Milestones (no sprint)",
        noMilestones: "No milestones in this sprint yet.",
        untitled: "Untitled milestone",
    },

    // Delete sprint confirmation.
    deleteSprint: {
        title: "Delete sprint?",
        bodyPrefix: " will be permanently removed.",
        milestoneMove:
            "{count, plural, one {# milestone will be moved to Backlog (No sprint).} other {# milestones will be moved to Backlog (No sprint).}}",
        cancelButton: "Cancel",
        deleteButton: "Delete",
    },

    // Sprint manager dialog.
    sprintManager: {
        autoChip: "Auto",
        editTooltip: "Edit",
        deleteTooltip: "Delete",
        saveButton: "Save",
        cancelButton: "Cancel",
        endBeforeStart: "End date must be on or after start date.",
        updateFailed: "Failed to update sprint (overlap?).",
        milestonesHeader: "Milestones",
        moveToPlaceholder: "Move to...",
        noSprintOption: "No sprint",
        planIntro: "Plan upcoming sprints, rename, shift dates, or insert ad-hoc ones.",
        addCustomSprint: "Add custom sprint",
        sprintNamePlaceholder: "Sprint name",
        createButton: "Create",
        adhocRequired: "Name, start, and end (>= start) are all required.",
        adhocOverlap: "Could not create sprint (overlaps an existing sprint?).",
        sectionCurrent: "Current",
        sectionUpcoming: "Upcoming",
        sectionPast: "Past",
        none: "None.",
    },

    // Sprint / milestone screens.
    sprint: {
        configDialogTitle: "Sprint settings",
        managerDialogTitle: "Manage sprints",
        deleteTitle: "Delete sprint?",
        sprintLength: "Sprint length",
        sprintStartsOn: "Sprint starts on",
        autoRollSprints: "Auto-roll sprints",
        upcomingSprintsToKeep: "Upcoming sprints to keep",
        customOption: "Custom…",
        days: "days",
        noSprint: "No sprint",
        sprintNamePlaceholder: "Sprint name",
        moveToPlaceholder: "Move to...",
        editTooltip: "Edit",
        deleteTooltip: "Delete",
        configIntro:
            "Configure the sprint cadence for this project. Auto-rolled sprints are generated forward from the start date.",
        startsOnLabel: "Starts on ",
        pickSpecificDate: "Pick a specific date →",
        futureGeneratedHelper: "Future sprints are generated forward from this date.",
        weekdayWarning:
            " Sprint length isn't a multiple of 7, so later sprints won't keep this weekday.",
        autoRollEnabled: "Generate upcoming sprints automatically",
        autoRollDisabled: "Disabled — sprints must be created manually",
        upcomingHelper: "How many future sprints to pre-generate at any time.",
        durationRequired: "Duration and start date are required.",
        saveConfigFailed: "Failed to save sprint config.",
        realignPartialFailure:
            "Saved, but {count} sprint(s) could not be realigned (likely overlap with the current sprint): {names}",
        realignWarningTitle: "These {count} sprint{plural} will be updated on save",
        willRealign: "Will re-date {count} future sprint{plural}.",
        cancelButton: "Cancel",
        saveButton: "Save",
        weekdays: {
            sunday: "Sunday",
            monday: "Monday",
            tuesday: "Tuesday",
            wednesday: "Wednesday",
            thursday: "Thursday",
            friday: "Friday",
            saturday: "Saturday",
        },
        durations: {
            oneWeek: "1 week",
            twoWeeks: "2 weeks",
            threeWeeks: "3 weeks",
            fourWeeks: "4 weeks",
        },
    },

    // Task preview screen.
    preview: {
        taskDetails: "Task Details",
        description: "Description",
        milestoneDetails: "Milestone Details",
        loadingMilestone: "Loading milestone…",
        loadingTask: "Loading task…",
        closeTooltip: "Close",
        tasksInThisMilestone: "Tasks in this milestone",
        taskButton: "Task",
        emptyMilestoneTasks: "No tasks yet. Create a task and assign it to this milestone.",
        menu: {
            copyMilestoneLink: "Copy milestone link",
            newTask: "New Task",
            openNote: "Open Note",
            newTag: "New Tag",
            newProject: "New Project",
            deleteMilestone: "Delete Milestone",
        },
        confirmDeleteMilestone: "Delete this milestone?",
    },

    // Create task form.
    createForm: {
        taskDetails: "Task Details",
        preparing: "Preparing task…",
        bootstrapFailed: "Couldn't prepare a new task. Check your connection and try again.",
        bootstrapRetry: "Try again",
        bootstrapCancel: "Cancel",
        description: "Description",
        attachments: "Attachments",
        templates: {
            defaultLabel: "Standard task",
            defaultDescription: "Goal, context, and acceptance criteria.",
            bugLabel: "Bug report",
            bugDescription: "Repro steps, expected vs. actual behavior.",
            spikeLabel: "Research / spike",
            spikeDescription: "Question-led investigation with a timebox.",
            milestoneLabel: "Milestone",
            milestoneDescription: "Goal, scope, success criteria, risks.",
            projectGroup: "Project templates",
            manageAction: "Manage templates…",
            setDefaultTask: "Set as default for tasks",
            setDefaultMilestone: "Set as default for milestones",
            isDefault: "Project default",
        },
        templatePrefix: "Template: ",
        sprintFallback: "No sprint",
        missingRequired: "Required: {fields}",
    },

    // Sprint board.
    board: {
        columnOpen: "Open",
        columnWip: "Work In Progress",
        columnBlocked: "Blocked",
        columnClosed: "Closed",
        columnPending: "Pending",
        dropToColumn: "↳ Drop to {title}",
        dropTasksHere: "Drop tasks here",
        expired: "Expired",
        dueToday: "Due today",
        noDueDate: "No due date",
        daysLeft: "{count}d left",
        unassigned: "Unassigned",
        showChildTasks: "Show child tasks",
        sortByLabel: "Sort by",
        sortDefault: "Default",
        sortDueDate: "Due date",
        sortPriority: "Priority",
    },

    // Sub-tasks block.
    subTasks: {
        title: "Sub Tasks",
        buttonLabel: "Sub Task",
        emptyText: "No sub tasks yet",
        quickAddLabel: "Quick Task",
        quickAddPlaceholder: "Type a title and press Enter…",
        quickAddError: "Couldn't create — try again",
    },

    // Field labels used in TaskMainBlock.
    fields: {
        assignee: "Assignee",
        reporter: "Reporter",
        project: "Project",
        priority: "Priority",
        status: "Status",
        dueDate: "Due Date",
        startDate: "Start Date",
        links: "Links",
        parentTask: "Parent Task",
        branches: "Branches",
        tags: "Tags",
        effortLevel: "Effort Level",
        sprint: "Sprint",
        milestone: "Milestone",
        dependencies: "Dependencies",
    },

    // Filter labels (TaskFilterMenu).
    filters: {
        all: "All",
        open: "Open",
        wip: "WIP",
        blocked: "Blocked",
        pending: "Pending",
        closed: "Closed",
        expired: "Expired",
        deleted: "Deleted",
        ongoing: "Ongoing",
        minimal: "Minimal",
        low: "Low",
        normal: "Normal",
        moderate: "Moderate",
        high: "High",
        critical: "Critical",
        extensive: "Extensive",
    },

    // Comments / DynamicURLManager / sub-components.
    dynamicUrl: {
        urlPlaceholder: "Paste URL",
        titlePlaceholder: "Title (optional)",
        titlePlaceholderShort: "Title",
        editTooltip: "Edit",
        deleteTooltip: "Delete",
        addButton: "Add",
        cancelButton: "Cancel",
        saveButton: "Save",
        addLinkButton: "Add Link",
        addLinkTooltip: "Attach a related URL, doc, or pull request.",
        invalidUrl: "Please enter a valid URL.",
    },

    // Dependency feature — blocking / blocked-by relations between
    // tasks (or milestones via their backing task).
    dependencies: {
        sectionLabel: "Dependencies",
        addCta: "Add dependencies",
        addCtaTooltip: "Link tasks that block this one, or that this one blocks.",
        blockingLabel: "Blocking",
        blockedByLabel: "Blocked by",
        // Used by the "+" tooltips on each row — interpolated with the
        // section label so plurals stay consistent.
        addRowTooltip: "Add to {label}",
        noneLabel: "None",
        blockedBadge: "Blocked",
        blockedTooltip: "One or more open blockers — see Dependencies below.",
        // Inline unlink on the preview's dependency chips.
        removeChipTooltip: "Remove dependency",
        modal: {
            title: "Manage dependencies",
            subtitle: "Cross-project links allowed within the same team.",
            intro: "Link this task to others that must finish first (Blocked by) or that depend on it finishing (Blocking). Cross-project links are allowed within the same team.",
            blockingDescription: "These tasks can't move forward until this one is done.",
            blockedByDescription: "These tasks must finish before this one can move.",
            emptySection: "Nothing here yet.",
            doneButton: "Done",
            removeTooltip: "Remove dependency",
            closeTooltip: "Close",
            removeFailed: "Failed to remove dependency.",
        },
        picker: {
            projectLabel: "Project",
            taskLabel: "Task",
            projectPlaceholder: "Choose project…",
            taskPlaceholder: "Search by ID or title…",
            taskPlaceholderDisabled: "Pick a project first…",
            noTasks: "No matching tasks.",
            noProject: "Select a project to see tasks.",
        },
    },

    // Comment bubble.
    comment: {
        editTooltip: "Edit",
        deleteTooltip: "Delete",
        copyLink: "Copy comment link",
        unwrapAll: "Unwrap content",
        wrapAll: "Wrap content",
        unwrapCode: "Unwrap code blocks",
        wrapCode: "Wrap code blocks",
    },

    // Title block.
    titleBlock: {
        titlePlaceholder: "Enter task title...",
        milestoneBadge: "Milestone",
        subTaskBadge: "Sub Task",
        newTaskBadge: "New Task",
        checkThread: "Check source thread",
        closeTooltip: "Close",
        menu: {
            copyTaskLink: "Copy task link",
            openThread: "Open Thread",
            newTask: "New Task",
            newSubTask: "New Sub Task",
            openNote: "Open Note",
            newTag: "New Tag",
            newProject: "New Project",
            deleteTask: "Delete Task",
        },
    },

    // Linked GitHub PR — surfaced on TaskPreview when set.
    linkedPr: {
        header: "Linked PR",
        fieldLabel: "Linked PR (GitHub)",
        paste: "https://github.com/owner/repo/pull/123",
        invalid: "Must be https://github.com/<owner>/<repo>/pull/<number>",
        connectPrompt: "Connect GitHub to see PR status",
        connectButton: "Connect GitHub",
        stateOpen: "Open",
        stateDraft: "Draft",
        stateMerged: "Merged",
        stateClosed: "Closed",
        ciPassing: "All checks passing",
        ciFailing: "Some checks failing",
        ciPending: "Checks in progress",
        ciNone: "No CI checks",
        openOnGithub: "Open on GitHub",
        lastUpdated: "Last updated {when}",
        loadError: "Couldn't load PR — open on GitHub",
        privateOrDeleted:
            "This PR is private to a repo you don't have access to, or it was deleted.",
    },

    // Tabs.
    tabs: {
        ariaLabel: "Task Tabs",
        comments: "Comments",
        notes: "Notes",
        attachments: "Attachments",
        activity: "Activity",
        downloadTooltip: "Download",
        downloadFileTooltip: 'Download "{name}"',
    },

    // Milestone filter (in TaskFilterMenu).
    milestoneFilter: {
        all: "All",
        allMilestones: "All milestones",
        noMilestone: "No milestone",
        noSprint: "No sprint",
        sprintFallback: "Sprint",
    },

    // Table-row interactions.
    table: {
        searchMembersPlaceholder: "Search members...",
        dragToReorder: "Drag to reorder",
        dragToResizeColumn: "Drag to resize column",
        dropToNest: "↳ Drop to nest",
        quickAddTooltip: "Add sub-task",
        quickAddTitlePlaceholder: "Type a title, Enter to create…",
        quickAddConfirm: "Create",
        quickAddError: "Couldn't create — try again",
        quickAddMissingRequired: "Required: {fields}",
        columnSettings: {
            heading: "Customize columns",
            description:
                "Toggle visibility and drag rows to reorder. Per-device — the ID and expand columns are always shown.",
            openTooltip: "Customize columns",
            resetTooltip: "Reset to defaults",
            dragHandle: "Drag to reorder",
        },
        columns: {
            id: "ID",
            status: "Status",
            pr: "PR",
            tags: "Tags",
            title: "Title",
            assignee: "Assignee",
            priority: "Priority",
            effortLevel: "Effort Level",
            daysLeft: "Days Left",
            dueDate: "Due Date",
            sprint: "Sprint",
            updatedAt: "Last Updated",
            createdDate: "Created Date",
        },
    },

    // Due-date short labels (used by the dashboard's "Up Next" list).
    dueLabel: {
        noDueDate: "No due date",
        overdue: "Overdue {days}d",
        dueToday: "Due today",
        dueTomorrow: "Due tomorrow",
        dueOn: "Due {when}",
    },

    // Dashboard table headers / labels.
    dashboard: {
        velocity: {
            title: "Velocity",
            subtitle: "Tasks created, started, closed & updated over time",
            day: "Day",
            week: "Week",
            created: "Created",
            started: "Started",
            closed: "Closed",
            updated: "Updated",
            weekPrefix: "W of",
            memberLabel: "Member",
            allMembers: "All members",
            empty: "No task activity in this window yet.",
            barTooltip: "{count} {series} · {date}",
            totals: "In view — {created} created, {started} started, {closed} closed, {updated} updated",
        },
        member: "Member",
        open: "Open",
        wip: "WIP",
        blocked: "Blocked",
        pending: "Pending",
        closed: "Closed",
        total: "Total",
        closedSprint: "Closed (Sprint)",
        closePanel: "Close Panel",
        noSprintsConfigure: "No sprints — configure",
        pickASprint: "Pick a sprint",
        sprintSettingsTooltip: "Sprint settings",
        manageSprintsTooltip: "Manage sprints",
        burndownTooltip: "Closed in sprint / Created in sprint",
        milestoneTooltip: "Milestone",
        projectsCount: "{count} projects",
        statusLabels: {
            open: "Open",
            wip: "In Progress",
            blocked: "Blocked",
            pending: "Pending",
            closed: "Completed",
        },
        untitledTask: "Untitled Task",
        nothingAssignedTitle: "Nothing assigned to you yet",
        nothingAssignedBody: "Tasks assigned to you in this project will show up here.",
        kpiActive: "Active",
        kpiClosed: "Closed",
        kpiOverdue: "Overdue",
        kpiDueThisWeek: "Due This Week",
        kpiCompletion: "Completion",
        priorityDistribution: "Priority Distribution",
        effortDistribution: "Effort Distribution",
        tasksSuffix: " tasks",
        taskStats: "Task Stats",
        noProjectSelected: "No Project Selected",
    },

    // Strings injected into BlockNote-format chat messages by
    // utils/TaskMessageTemplate.ts (non-React, uses getMessages()).
    messageTemplate: {
        statusLabel: "Status: ",
        priorityLabel: "Priority: ",
        effortLabel: "Effort: ",
        assigneeLabel: "Assignee: ",
        reporterLabel: "Reporter: ",
        dueLabel: "Due: ",
        sprintLabel: "Sprint: ",
        assigneesLabel: "Assignees: ",
        unassigned: "Unassigned",
    },

    // Task graph (React Flow diagram) — tooltips on nodes and modal chrome.
    diagram: {
        tooltips: {
            // BurndownSparkline header chip.
            tasksRemaining: "{remaining} of {total} tasks remaining",
            // Health chip — used both on milestone nodes and the modal header.
            healthSummary: "Closed {actualPct}% · Expected {expectedPct}%",
            // ModalTaskDiagram progress-bar "expected by now" marker.
            expectedByToday: "Expected by today: {expectedPct}%",
            // TaskNodeCard blocker badge. Single vs plural — call site
            // picks one based on the count rather than the template
            // carrying a JS ternary.
            openBlockerOne: "{count} open blocker",
            openBlockerOther: "{count} open blockers",
            // TaskNodeCard hover affordances.
            openTaskInPreview: "Open this task in preview",
            openTask: "Open task",
            doubleClickToRename: "Double-click to rename",
            clickToEditDates: "Click to edit dates",
            addSubTask: "Add sub-task",
            // MilestoneNodeCard "open" button.
            openMilestone: "Open milestone",
            // MilestoneNodeCard "add task" button — wording differs
            // from `addSubTask` because the milestone owns tasks (not
            // sub-tasks) in the user's mental model, even though the
            // backend hierarchy still parents them under the milestone.
            addTaskToMilestone: "Add task under this milestone",
            // ModalTaskDiagram chrome.
            hideClosed: "Hide closed tasks",
            showClosed: "Show closed tasks",
            close: "Close",
            // DiagramLegend collapse / expand chevron.
            collapse: "Collapse",
            expand: "Expand",
        },
    },
} as const;
