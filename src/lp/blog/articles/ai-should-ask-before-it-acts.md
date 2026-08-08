<!-- Generated from genos-docs/marketing/MEDIUM_AI_SHOULD_ASK_BEFORE_IT_ACTS.md. Run npm run blog:sync; do not edit this copy directly. -->

Most AI demos are designed around the same moment.

You type one sentence. The cursor moves by itself. Tasks appear, calendars change,
documents rewrite themselves. Nobody clicks a button. The absence of friction is
the point.

It is impressive for thirty seconds.

Then I imagine using it on a real project.

Did the agent choose the right project? Did it understand that “next Friday” meant
the launch date, not the internal review? Did it preserve the caveat in the old
document? Is it about to assign ten tasks to the same person? If I notice a mistake
after the animation finishes, how much work will it take to undo?

The problem is not that AI agents can act. Acting is exactly what makes them useful.
The problem is that most interfaces treat **autonomy as an all-or-nothing setting**:
either the AI is a chatbot that can do nothing, or it has permission to do
everything before you can inspect its interpretation.

That is the wrong boundary.

### Reading and writing are different kinds of risk

If I ask an AI, “What is blocking the launch?”, it should search immediately. It
should read the relevant tasks, discussions, and notes, then show me what it found.
Adding a confirmation dialog before every read would be security theater and a
terrible experience.

But “Move every blocked task to next sprint” is different. So is:

- create a milestone from this discussion;
- reprioritize these tasks based on their dependencies;
- add this conclusion to the project note;
- schedule a meeting with these people.

Those requests mutate a shared system. A plausible but wrong answer becomes a
plausible but wrong project plan.

The distinction sounds obvious, yet it has a major product consequence: an agent
needs a **pause point between interpretation and execution**.

It should be allowed to think, search, and prepare. Then it should stop and show the
proposed change in the shape a human can judge.

### “Are you sure?” is not enough

A generic confirmation dialog does not solve this.

> The AI wants to update 14 tasks. Allow?

That is consent without comprehension. The user knows that something will happen,
but not whether it is the right thing.

The preview has to match the work:

- A proposed project plan should look like a milestone and an indented task tree.
- A bulk reprioritization should show old values beside new ones, with a reason for
  each change.
- A document update should render the proposed document, not expose a JSON payload.
- A calendar action should show the actual time, attendees, and meeting details.

The difficult design work is not adding an Approve button. It is making the pending
action legible enough that approval means something.

### The agent should do the tedious part before asking

There is an opposite failure mode: requiring one confirmation for every tiny step.

Suppose a discussion needs to become one milestone, six tasks, four subtasks, and
three dependency links. Eleven separate approval dialogs technically keep the human
in control. They also make it increasingly likely that the human will stop reading
after the first few clicks.

A better pattern is:

1. Read the discussion.
2. Build the complete proposal without changing anything.
3. Present the proposal as one coherent plan.
4. Let the user approve or reject the whole transaction.

The agent does the synthesis. The human makes the decision. One approval can still
be safe when the preview exposes the entire change.

This is not a compromise between autonomy and control. It is a division of labor.

### Trust also requires evidence

Approval handles the future: *what is about to change?*

Citations handle the past: *why is the agent proposing this?*

If an agent recommends moving a deadline because another task blocks it, I should
be able to open that dependency. If it creates a plan from a chat thread, I should
be able to return to the original discussion. If it rewrites a note, I should see
the current note it read.

Without sources, the user reviews polished output. With sources, the user can
review the agent's reasoning against the actual work.

That makes citations more than an answer-quality feature. They are part of the
control surface for action.

### This became a core rule in the product I built

Full disclosure: I am building **Genos**, a workspace that combines chat, tasks,
and collaborative notes with an AI agent.

While building its action layer, I settled on a simple rule:

> Reads can run. Writes must pause.

The agent can search the workspace, inspect a task, summarize a thread, or calculate
project status without interruption. When it wants to create or update something,
the stream pauses. Genos displays the proposed action, and nothing is written until
the user approves it.

For larger jobs, the agent prepares a structured batch. It can turn a discussion
into a milestone, tasks, subtasks, and dependencies, then present the whole tree for
one approval. It can suggest a bulk reprioritization as an old-versus-new diff. It
can draft or refine a collaborative note and show the full proposed body first.

The implementation is not perfectly autonomous. That is deliberate.

Genos is still an MVP, and the AI still gets things wrong. A system that admits
those facts in its interaction model is more useful to me than one that performs
certainty.

### Good agents will not feel frictionless

There will always be pressure to remove one more click. Sometimes that is right.
Confirmation fatigue is real, and poor previews deserve to be redesigned.

But a click is not automatically friction. At the moment a machine is about to
change shared work, a well-designed pause is information.

The goal should not be an AI that never asks permission. It should be an AI that
knows exactly when permission matters—and gives you enough context to make the
decision quickly.

If you want to see the propose–preview–approve pattern in a working MVP, the Genos
demo is available without signup at **https://genosai.dev**. There is a free plan
and no credit card is required.

I would also love to hear how other teams draw this boundary. Which actions would
you let an agent take silently, and which ones should always stop at your desk?
