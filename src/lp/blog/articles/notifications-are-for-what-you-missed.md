<!-- Generated from genos-docs/marketing/MEDIUM_NOTIFICATIONS_ARE_FOR_WHAT_YOU_MISSED.md. Run npm run blog:sync; do not edit this copy directly. -->

Two people are talking in a direct message.

One sends a question. The other answers. A mention clarifies who owns the next
step. A reaction acknowledges it. Every event appears immediately in the open
conversation.

Then one of them opens the activity feed.

It reports the message, the mention, and the reaction they just watched happen.

Nothing was missed. Everything was filed.

This is how a notification system can be technically correct and experientially
wrong.

### An activity feed is not an event log

Software naturally thinks in events. A message was created. A user was
mentioned. A reaction was added. Each event satisfies a rule, so each produces
an activity.

But people do not open an inbox to audit every event the database accepted.
They open it to recover awareness:

- What happened while I was elsewhere?
- Did someone address me?
- Is there a conversation I need to return to?
- What changed outside my current view?

That gives an activity feed a different job from an event log. The event log
answers, “What happened?” The activity feed should answer, **“What happened
that you may not have seen?”**

When those concepts are treated as identical, active conversations generate
their own administrative exhaust. A lively exchange can bury the quieter item
that actually needs attention.

### Delivery is not the same as awareness

Most notification rules evaluate the event and the recipient:

> A message was sent to a conversation containing this person.

That is necessary, but incomplete. The missing variable is the recipient's
viewing context:

> Was this person already looking at the place where the event appeared?

If the answer is yes, creating a durable activity row does not add awareness.
It creates a second representation of awareness the product already has.

This does not mean that every open application should suppress every
notification. A visible dashboard does not prove that a thread reply was seen.
A channel open behind a thread pane is not the surface being read. A task list
is not the task-comment stream inside a task.

Presence must be specific enough to support the claim being made. “Online” is
not enough. “In the app” is not enough. The useful signal is:

**This exact conversation is on screen in a visible tab.**

### Report the surface, not an interpretation of attention

No interface can know whether a person truly read a message. Eye contact,
comprehension, and attention are not available to an ordinary web application.
Trying to infer them would produce a false precision.

The product can know something narrower and defensible: which surface it
rendered on screen.

That surface can be represented as an opaque identity:

- the channel timeline currently open;
- the specific thread pane currently open;
- the task whose comment stream is currently open.

When the user moves, the client reports the new surface immediately and
retracts the old one. When the tab is hidden or no conversation is open, it
reports no viewing surface.

This is intentionally not a “read receipt.” It is a suppression hint. The
system is saying, “The event appeared in the exact place this person is
currently viewing, so another durable row is probably redundant.”

### The match must follow where the event is actually read

Nested interfaces make this rule more subtle than comparing a conversation ID.

A reply may be stored under a channel but displayed only inside a thread pane.
Someone looking at the channel timeline has not necessarily seen it. Suppress
the activity only when that thread is the reported surface.

A task comment may be mirrored through a project conversation but read inside
the task preview. In that case, the task—not the storage channel—is the surface
that matters.

Mentions and reactions should follow the same principle. If a conversational
mention appears in the thread already on screen, filing a mention row simply
relabels the duplicate. If a reaction appears beneath the message being
watched, an activity saying “someone reacted” repeats the visible event.

The transferable rule is:

> Match suppression to the place where the person experiences the event, not
> merely the place where the backend stores it.

That requires the frontend and backend to share an exact vocabulary for
surfaces. If one says “thread 42” while the other tests “channel 7,” they can
both be internally consistent and still make the wrong decision.

### Suppression should be per person, not per event

The same message can be witnessed by one recipient and missed by another.

If three people belong to a conversation and one has it open, the system should
omit the activity only for that person. The other two still need their rows.
“Someone is viewing this conversation” is not enough to suppress the fan-out.

This sounds obvious, but it changes the data model of the decision. Suppression
is not a property of the message. It is a property of the message-recipient
pair at the moment the activity would be created.

That distinction also prevents one active device from changing what everyone
else receives.

### When uncertain, notify

Presence is ephemeral infrastructure. Heartbeats can be late. Tabs can close
without a clean goodbye. Clients and servers can run different versions. A
cache can be unavailable.

The dangerous failure is not an extra row. It is silently deleting the only
durable trace of something the person did not see.

So the safe direction is clear:

**Uncertain presence must fail open. Create the activity.**

An invalid surface token should match nothing. A missing heartbeat should mean
“not known to be viewing.” A cache read failure should preserve the original
notification behavior. A client that does not yet report surfaces should keep
receiving activities exactly as before.

The signal should also expire quickly and be refreshed while the surface
remains visible. Moving to another conversation should retract the previous
claim immediately rather than waiting for expiration. Otherwise the system may
keep suppressing events in a conversation the person has already left.

This asymmetry is worth accepting. A false positive creates some noise. A false
negative in the suppression decision can make information disappear.

### “I saw it” should win across activity types

Notification pipelines often compose. A message can be both a thread reply and
a mention. If the mention is suppressed because the thread is open, a later
stage must not recreate the same event as a generic thread-reply activity.

The system needs to remember that the recipient was targeted, even when no row
was ultimately written. Otherwise suppression changes the label instead of
removing the duplicate.

There can still be deliberate exceptions. A system-generated assignment
mention, for example, may be the only durable record that work was handed to
someone. That is not ordinary conversational chatter, even if it uses the same
mention mechanism.

The principle is not “suppress every event that shares a type.” It is “do not
file conversational activity that the recipient demonstrably witnessed, while
preserving events whose durable record carries separate meaning.”

### How this works in the product I built

Full disclosure: I built **Genos**, a browser-based MVP that includes chat,
tasks, collaborative notes, and an activity inbox.

The frontend already tracked the active surface to avoid showing an in-app
toast for the conversation on screen. The implementation now derives a channel,
thread, or task token from that same value and sends it with the presence
heartbeat. A surface change sends an immediate heartbeat instead of waiting
for the next periodic one.

On the API side, the viewing claim has a short 90-second lifetime and is
refreshed by the client's 45-second heartbeat. The server compares each
recipient with the exact surface where a message is read. It does not create an
Inbox activity row for conversational messages, thread replies, task comments,
mentions, or reactions that appeared on the recipient's current surface.
Other recipients still get their rows.

The implementation is conservative by design. Unknown or malformed surfaces,
older clients, missing heartbeats, hidden tabs, and cache uncertainty all leave
the activity in place. The frontend and API also pin the shared token formats
in tests so an accidental mismatch fails toward notification rather than
silence.

Genos is solo-built, web-only, and still an MVP. The demo works without an
account at **[genosai.dev](https://genosai.dev)**; there is a free plan and no
credit card.

A good notification system does not prove its thoroughness by repeating
everything. It earns trust by remembering the difference between what happened
and what the person still needs to know.
