<!-- Generated from genos-docs/marketing/blog/rules-that-route-your-tasks.md. Run npm run blog:sync; do not edit this copy directly. -->

![The preview of an automation rule, listing the tasks that match and what would happen to each](/lp/guide/en/blog-rules.webp)

Requests arrive in your project all day, and some belong to another team. A design fix, a legal question, a bug for the app. Someone has to notice each one, open it, move it, set its status and tell the right person. Usually that someone is you.

## Why it is hard

The work is small, so nobody plans time for it. It still has to be done on time. A request that sits in the wrong project is a request nobody is working on, and the person who asked thinks it is in hand.

And when you are away, the sorting stops.

## How Genos helps

A project can have **automation rules**, written as one sentence: **When** something happens, **If** it fits your conditions, **Then** do this.

```flow
A task gets the tag Design
Your rule matches
It moves to the design project
Its history says why
```

A rule can start when a task is created, its status becomes something, a tag is added or the assignee changes. It can move the task to another project, set a status, assign someone or add a tag. Rules work on milestones too.

Before you turn one on, **Preview matches** lists what matches right now and what the rule would do to each, with the reason when it would not. Previewing changes nothing, and turning a rule on does not touch existing work: it acts on the next change that fits.

When a rule moves a task, its sub-tasks, comments, notes and chat card go with it. It gets a new ID, and the old one still works. Tags carry over where the other project has a tag of the same name; the milestone and sprint stay behind. A sub-task moves only with its parent, which is why a preview can show some as skipped.

The task's Activity says which rule moved it, the old project's chat gets one line about it, and an assignee other than the rule's owner is told.

## What you get

- **Sorting that does not wait for you.** The request is where the right team looks.
- **The same decision every time**, instead of whatever someone remembered that day.
- **No surprise exposure.** A rule never moves a task to another team, or into a project that somebody could read who cannot read this one.
- **A way to check.** **Recent runs** says what a rule did lately.

Rules are tried in order and only the first that matches acts, so put the most specific one first. A rule runs as the person who last saved it; if they lose the access it needs, the rule turns itself off. What a rule does never sets off another rule.

The project's owner or an editor writes rules. They need Core or above for the person a rule runs as.

## How to start

1. In the project, open the "…" menu and choose **Statuses and automation**.
2. Open the **Automation** tab and choose **New rule**.
3. Fill in the sentence, look at the preview, then **Save and turn on**, or keep it off until you are sure.

Start with the one task you move by hand every week.
