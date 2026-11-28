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
- **Statuses and automation** (the project's "…" menu, owner and editors) lets a project name and colour its own statuses. **Set up statuses** adds the built-ins, including **In Review**; then add, rename, recolour, order, set a default, turn off (In Review, WIP, Pending and Rejected) or delete. Every status belongs to Open, WIP, Blocked, Pending, Closed or Rejected, which board columns, filters and automations keep using. Its **Automation** tab holds the project's automation rules, described below.
- **Templates:** any project member can add task and milestone templates for the project.
- **Labels:** project labels group projects in the Tasks sidebar, and you can filter the sidebar by label.
- **Import tasks from CSV…** brings in tasks from a CSV file. A Jira or Notion export is recognized, and a Jira JSON export also brings comments. Only the owner or an editor of the project can import.
- **Archiving:** the owner can archive a project. It keeps everything but is read-only until it is unarchived.

## Tasks

- A task has a status (Open, WIP, Pending, Blocked, Closed or Rejected, shown under the project's own names where it set statuses up), a priority, an effort level, an assignee, optional collaborators, start and due dates, tags and a description. Collaborators must be members of the project.
- **Rejected** means a task will not be done. It is finished but not completed: it leaves the progress bar, its sub-tasks read as rejected unless they are already closed, and it no longer blocks other tasks.
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

## Automation rules and guards

A project can have **automation rules**: when something happens to one of its tasks, Genos can move the task to another project, set its status, assign it or add a tag. Rules need the Core plan or higher. The project's owner and editors write them: open the project's "…" menu → **Statuses and automation** → **Automation** → **New rule**.

- **Writing a rule:** name it, then fill the sentence. **When** (the status becomes, a task is created, a tag is added, the assignee changes), **If** (conditions that must all hold; with none, every task) and **Then** (move to another project, set a status, assign someone, add a tag).
- **Preview before it is on:** **Preview matches** lists the tasks that match right now and what the rule would do to each, with the reason where it would not. Nothing changes until the next change that fits. Then **Save and turn on** or **Save, keep off**.
- **Order and on/off:** rules are listed in the order they are tried. Move one from its "…" menu or with Alt+↑ / Alt+↓. The switch turns a rule off at once; turning it on shows the preview first. **Recent runs** says what a rule did lately.

- **What sets a rule off:** a task is created, its status or assignee changes, or a tag is added. A rule can also ask for conditions, such as a tag, the assignee, the priority or the milestone.
- **One rule per change:** rules are tried in order, and only the first one that matches acts. What a rule does never sets off another rule.
- **Who it acts as:** a rule runs as the person who last saved it, who must be the project's owner or an editor and a member of the destination project.
- **What moves:** the task takes its sub-tasks, comments, notes and chat card with it. It gets a new ID, and the old ID still works. Tags carry over when the destination has a tag of the same name.
- **What you see:** the task's Activity tab says it was moved by the rule, or why the rule was not applied. The old project's chat gets one line saying a rule moved a task; it names the task and the new project only to people who can open them. The assignee is told.
- **Milestones:** a rule can also be set to act on milestones. It reads the milestone's own status, tags and assignees, and cannot use a “milestone” condition. Moving a milestone moves every task under it and clears the sprint and folder. A rule that assigns someone makes that person the milestone's only assignee.

**Guards.** A rule never moves a task to another team, or to a project that somebody could read who cannot read this one, so a private project's tasks never move to a public one. A sub-task does not move without its parent. A task that rules have acted on several times within an hour is left alone for a while. A rule whose owner can no longer run it is turned off. A milestone with more than 200 tasks under it is not moved by a rule, and its Activity says so. Rules apply to one milestone at most twice within an hour.

## GitHub and Google Calendar

- Connect GitHub in Settings → Integrations. When your Genos has the GitHub App turned on:
    - A team owner or editor installs the Genos GitHub App for the team.
    - Each person then authorizes it.
    - The app is read-only and has no code access. It sees only the repositories chosen in the team's installation.
    - An older GitHub connection shows as a legacy connection, with **Reconnect**.
- Paste a pull request link into a task's Links field to see its state and checks on the task.
- Settings → Tasks → **Close my tasks when their PR merges** closes a task you are assigned to when a pull request whose branch name contains the task ID merges. It is on by default for new accounts (accounts made earlier keep their choice).
- Settings → Tasks → **Auto-sync task due dates** adds tasks with due dates to your Google Calendar as all-day events. It only works one way: deleting an event in Google doesn't change your tasks.
