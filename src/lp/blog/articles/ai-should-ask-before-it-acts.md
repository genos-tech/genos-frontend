<!-- Generated from genos-docs/marketing/MEDIUM_AI_SHOULD_ASK_BEFORE_IT_ACTS.md. Run npm run blog:sync; do not edit this copy directly. -->

The instruction looks harmless:

> Move the blocked work into next sprint.

An agent finds the matching tasks and acts. A moment later, fourteen cards have
moved. One belonged to a different project. Two were blocked by a launch that
cannot slip. Several inherited a due date the agent interpreted from “next
Friday.”

The interface may call this autonomy. The team experiences it as cleanup.

AI agents are often demonstrated by removing every visible pause. The cursor
moves, the plan reorganizes itself, and the user watches work happen. That
fluidity is impressive. It also hides the most important question in the
interaction:

**When did the user's request become the system's decision?**

### Interpretation and execution need a boundary

Every useful agent interprets. “The blocked work” requires a scope. “Next
sprint” requires dates. “Move” may imply changing status, milestone, assignee,
or all three.

Interpretation is unavoidable. Silent execution is not.

There is a meaningful risk difference between asking, “What is blocking the
launch?” and saying, “Move every blocker into next sprint.” The first request
can search and synthesize without changing shared state. The second turns the
agent's interpretation into the team's plan.

That suggests a practical default:

> Let reads run. Put a pause between interpretation and writes.

This is not a claim that reads have no security or privacy risk. Access control
still matters. It is a product rule about user intent: inspecting authorized
information should not require a parade of confirmation boxes, while mutating
the workspace should create an opportunity to catch a mistaken interpretation.

### A confirmation dialog is not the same as informed approval

Consider this prompt:

> The AI wants to update 14 tasks. Allow?

It reports quantity, not meaning. The user knows that something will happen but
cannot tell whether the agent selected the right tasks, chose the right fields,
or preserved important exceptions.

A useful preview must resemble the decision being made:

- A project plan should appear as a milestone, tasks, subtasks, and
  dependencies.
- A bulk update should show old values beside proposed values.
- A note edit should render the proposed body, not a serialized tool payload.
- A meeting should show its actual time, timezone, attendees, and title.

The rule is broader than AI: **review should happen at the level of the user's
intent, not the level of the API call.**

An “Approve” button attached to an opaque operation merely transfers
responsibility to the person clicking it. It does not give them control.

### Ask once, at the right level

Approval can fail in the opposite direction too.

Suppose a conversation needs to become one milestone, six tasks, four subtasks,
and three dependency links. Asking for permission after every object is safer
only on paper. By the seventh dialog, the interface has trained the user to
click without reading.

The agent should do the tedious work before it asks:

1. Inspect the relevant material.
2. Assemble a complete proposal without writing it.
3. Present the result as one coherent change.
4. Let the user approve or reject that change.

This preserves the useful part of automation—the synthesis—while keeping the
commit point visible. One approval can govern many writes when the preview
makes the full transaction legible.

The transaction should also be stable. If the proposed plan changes after the
preview, approval no longer refers to what the user saw. If only half the batch
succeeds, the product should not imply that the approved outcome was applied
cleanly. Approval design eventually becomes execution design.

### Reversibility is not permission

A common response is that the agent can act first because the user can undo the
result.

Undo is valuable, but it solves a different problem. It helps after a wrong
change has entered the system. By then it may have triggered notifications,
changed another person's queue, or influenced a second automation. Some writes
are not fully reversible at all.

The right question is not “Can we repair this?” It is “Was this interpretation
safe enough to make real without review?”

The threshold can vary. Renaming a private draft is not the same as deleting a
shared project. A mature product may allow policies, trusted scopes, or
pre-approved low-risk actions. But those are refinements of the boundary, not
reasons to pretend there is no boundary.

### Evidence belongs inside the preview

A proposal should show not only _what_ will change, but enough of _why_ to
inspect the decision.

If a deadline moves because another task blocks it, the dependency should be
openable. If a plan came from a discussion, the preview should identify that
discussion. Evidence does not guarantee correct reasoning, but it shortens the
path to finding a bad assumption before it becomes shared state.

This need not turn the approval screen into a research report. The most
important evidence can remain close to the proposed change, with deeper detail
available on demand.

### How I applied the rule

Full disclosure: I built **Genos**, a browser-based MVP for chat, tasks,
collaborative notes, and AI-assisted work.

Its action layer follows the rule above. Read tools can run immediately. Write
tools pause the response and wait for explicit approval. The pending action is
rendered for review, and the write does not run until the user accepts it.

For compound work, Genos can preview a task plan, a bulk task diff, or a full
note body as one proposal. The user approves the coherent result rather than
clicking through every underlying operation.

That does not make the agent infallible. It makes the product acknowledge where
fallibility becomes consequential.

Genos is solo-built and still an MVP. The demo is available without an account
at **[genosai.dev](https://genosai.dev)**, with a free plan and no credit card.

The best agent is not the one that asks permission least often. It is the one
that asks at the exact moment a human judgment is more valuable than another
second of automation—and shows enough for that judgment to be real.
