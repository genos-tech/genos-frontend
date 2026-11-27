---
id: tasks
title: Tasks and projects
settings:
    [
        tasks,
        tasks.quickAddRequiredFields,
        tasks.autoCloseOnPrMerge,
        tasks.autoSyncCalendar,
        integrations,
    ]
---

## Projects

A project holds tasks, milestones and sprints, and it has its own chat. Create one with **New Project** in the Tasks sidebar. Choose Public Project (the team can see it) or Private Project (members only). A private project can also be hidden, so only its members can see that it exists. Each project has a short code, so its tasks get readable IDs like WRD-12.

- **Customize Task Fields** sets which fields are required and their default values for new tasks and milestones. Only the project owner and editors can change these.
- **Custom fields** (Tag, Text, Date or Member) apply to every task, sub-task and milestone in the project. They show in the task panel and as table columns. Owners and editors manage them.
- **Templates:** any project member can add task and milestone templates for the project.
- **Labels:** project labels group projects in the Tasks sidebar, and you can filter the sidebar by label.
- **Import tasks from CSV…** brings in tasks from a CSV file. A Jira or Notion export is recognized, and a Jira JSON export also brings comments. Only the owner or an editor of the project can import.
- **Archiving:** the owner can archive a project. It keeps everything but is read-only until it is unarchived.

## Tasks

- A task has a status (Open, WIP, Pending, Blocked or Closed), a priority, an effort level, an assignee, optional collaborators, start and due dates, tags and a description. Collaborators must be members of the project.
- A task has four tabs: Comments, Notes, Attachments and Activity. Activity records every change to the task, and you can restore an earlier description from it.
- **Sub-tasks:** break work down with sub-tasks. A task's page shows the sub-tasks under it.
- **Dependencies:** under Dependencies, mark which tasks a task is **Blocked by** and which it is **Blocking**. Tasks in other projects of the same team can be linked too. While a task has an open blocker, Genos sets it to Blocked. When the last blocker closes, it returns to Open. This only happens if its status is still Blocked; if you set another status yourself, Genos leaves it alone.
- **Task graph:** shows the task tree and its dependencies. Open it with **Open task graph**, or with Ctrl+Cmd+G on a Mac (Ctrl+Alt+G elsewhere) while a task is open in the preview.
- **Task Weight (1–25):** combines priority with time pressure, and a bigger effort level starts the pressure earlier. It drives the **By weight** order in Up Next and **Top by Weight**. Team Capacity and Pace show the load on the project and how fast its work moves.
- **Comments:** comments support @-mentions and reactions.

## Milestones, sprints and views

- **Milestones:** a milestone groups tasks toward one goal and shows their progress. Assign tasks to it, then use **Start Milestone** and **Complete Milestone**. Milestones can sit in folders, and you can star them into Favorites.
- **Sprints:** **Sprint settings** sets a project's sprint length and start day, and can generate upcoming sprints automatically.
- **Views:** the **Sprint Board** shows tasks in columns by status. The **Task Table** is a sortable, filterable grid. Both work from the keyboard (see Settings → Shortcuts).
- **Saved filters:** **Saved Filters** saves the current filters under a name. Everyone in the project can use it.
- **Quick add:** in the task table, a quick task needs only a title. To apply the project's required fields there too, turn on Settings → Tasks → Quick task creation.

## GitHub and Google Calendar

- Connect GitHub in Settings → Integrations. When your Genos has the GitHub App turned on:
    - A team owner or editor installs the Genos GitHub App for the team.
    - Each person then authorizes it.
    - The app is read-only and has no code access. It sees only the repositories chosen in the team's installation.
    - An older GitHub connection shows as a legacy connection, with **Reconnect**.
- Paste a pull request link into a task's Links field to see its state and checks on the task.
- Settings → Tasks → **Close my tasks when their PR merges** closes a task you are assigned to when a pull request whose branch name contains the task ID merges. It is on by default for new accounts (accounts made earlier keep their choice).
- Settings → Tasks → **Auto-sync task due dates** adds tasks with due dates to your Google Calendar as all-day events. It only works one way: deleting an event in Google doesn't change your tasks.
