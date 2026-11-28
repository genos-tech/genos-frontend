<!-- Generated from genos-docs/marketing/blog/see-what-a-task-is-waiting-on.md. Run npm run blog:sync; do not edit this copy directly. -->

![The task graph: tasks joined by lines that show sub-tasks and what blocks what](/lp/guide/en/graph.webp)

You pick up a task and start working. An hour in, you find it cannot be finished: it needs a decision, a design or an API that someone else has not delivered yet.

## Why it is hard

Dependencies usually live in people's heads, or in a comment halfway down a thread. The board shows two tasks side by side and nothing says that one must come first.

So work starts in the wrong order, people ask "why is this not moving?", and finding the real cause means asking around until you reach the person at the start of the chain.

## How Genos helps

Open a task and say what it is **Blocked by**, or what it is **Blocking**. Tasks in other projects of the same team can be linked too.

```flow
Mark what blocks it
It shows as Blocked
The last blocker closes
It returns to Open
```

When you give a task an open blocker, Genos sets it to **Blocked**. When the last blocker closes, a task that is still Blocked goes back to **Open**. Genos only reopens from Blocked: if you have moved it to another status yourself by then, that stays.

When the chain is longer than one step, open the **task graph**. It draws the sub-tasks and the blocking links together, so you can follow the lines from the stuck task back to the thing that has to happen first.

## What you get

- **Fewer false starts.** A Blocked status says "not yet" before anyone spends time on it.
- **Faster answers.** "What is this waiting for?" is on the task, with the owner of the blocker one click away.
- **Status that keeps up.** Nobody has to remember to unblock the next task by hand.
- **Better planning.** In the graph you can spot the one task that several others are waiting on and move it first.

## How to start

1. Open a task and find **Dependencies**. Add what it is blocked by.
2. Open the task graph from the task, or press Ctrl+Cmd+G on a Mac (Ctrl+Alt+G elsewhere) while a task is open in the preview.
3. In your next planning session, do this for the tasks of one milestone.

If you also schedule **What to do today** (Core and above), your blocked tasks appear in it with what each one is waiting for.
