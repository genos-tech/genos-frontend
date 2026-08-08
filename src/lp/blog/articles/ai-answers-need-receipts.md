<!-- Generated from genos-docs/marketing/MEDIUM_AI_ANSWERS_NEED_RECEIPTS.md. Run npm run blog:sync; do not edit this copy directly. -->

AI was supposed to save us from searching.

Instead, it often gives us a new job: verifying the answer.

Ask a workplace assistant why a deadline moved and it may produce a beautifully
written paragraph. It mentions a dependency, a customer request, and a decision
from last month. It sounds right.

Now what?

If the answer matters, I still need to open chat, search for the discussion, find
the current project document, and confirm that the assistant did not combine an old
plan with a new decision. The search work did not disappear. It moved to the end,
where it is harder because I am now checking the AI's interpretation too.

This is why “chat with all your company knowledge” is not enough. The useful unit
is not an answer. It is an **answer with a short, inspectable path back to reality**.

### Confidence is not provenance

Language models are optimized to produce coherent language. Coherence is valuable,
but it is not evidence.

In ordinary knowledge work, many questions are cheap to get approximately right:

- What are the main themes in this project?
- What did we discuss about onboarding?
- What might be blocking the release?

The dangerous questions differ by only a few words:

- Which onboarding decision is current?
- Did we actually approve this scope?
- Is the release blocked, or was that issue resolved yesterday?

For these, a fluent answer can be worse than no answer because it removes the
healthy discomfort that normally makes us check.

A list of “sources” at the bottom helps, but only partially. If an answer cites six
long documents and three chat channels, the user has received a bibliography, not
an audit trail.

The citation should sit next to the claim. It should name the real task, thread, or
note. And clicking it should open the exact object, not a generic search page.

### Sources change the way people read

An uncited AI answer asks the reader to decide one thing:

> Do I trust this system?

That is an impossibly broad question. No system is equally reliable for every
workspace, date range, and type of request.

A cited answer lets the reader ask smaller questions:

> Is this the discussion I remember?

> Is this task still open?

> Does this note actually support the sentence beside it?

Those questions are quick and concrete. The user does not need blind trust in the
model. They only need to inspect the evidence that matters for the current
decision.

This also improves disagreement. If a teammate thinks an AI summary is wrong, the
conversation can start from the cited thread or task instead of becoming a debate
about whether “the AI is good.”

### A source link is a product feature, not decoration

Getting this right requires more than asking the model to add footnotes.

The system needs stable identities for the things being cited. It needs permission
checks at retrieval time and again when the source opens. It needs to distinguish a
task from a note with the same title. It needs to preserve citations in answer
history. It needs to handle the case where access to a source changes later.

There is also a user-interface question: how much evidence should be visible before
the answer becomes unreadable?

My preference is two layers:

1. Inline links on the claims that matter.
2. A compact row of source objects for scanning and navigation.

The prose stays readable, but verification is always one click away.

### Search should sometimes return an old answer

There is another useful consequence of treating answers as evidence-backed
objects.

Teams ask the same questions repeatedly. A second person asks why a framework was
rejected, and the AI performs the same searches and spends the same tokens to
derive the same result.

If a previous answer has clear provenance, it can be reused. A search can surface
“Someone already asked this” along with the original cited answer.

That reuse needs a strict privacy rule. An answer may quote private material in its
body, so it should only be visible to people who can access **all** of its sources.
If the system cannot determine that safely, it should not share the answer.

This is the less glamorous side of workplace AI: the quality of the permission
model matters as much as the quality of the prose.

### What I built around this idea

Full disclosure: I am the creator of **Genos**, an MVP workspace for chat, tasks,
and collaborative notes.

Its AI answers questions across those surfaces and renders workspace references as
clickable citations. A citation opens the actual chat, task, note, or project, and
the source list remains available in saved answer history.

Genos also indexes eligible past answers so a teammate can find an existing answer
through normal search. Those answers are excluded from the AI's own grounding to
avoid an answer-citing-an-answer feedback loop, and sharing is restricted to the
intersection of the original sources' audiences.

That does not make every answer correct. It makes errors easier to detect and good
answers easier to reuse.

For an AI product used in real work, I think that is a more honest promise.

### The standard should be inspectability

We will keep improving retrieval, models, and reasoning. Answers will get better.
But “better on average” does not remove the need to inspect a specific answer
before acting on it.

The workplace AI I want is not one that sounds certain enough to stop me checking.
It is one that makes checking so cheap that certainty is unnecessary.

You can try the Genos demo without creating an account at
**https://genosai.dev**. It is web-only and still an MVP; a free plan is available
without a credit card.

When your AI answers a question about work, what would you need to see before you
acted on it?
