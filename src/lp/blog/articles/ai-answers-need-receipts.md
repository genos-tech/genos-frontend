<!-- Generated from genos-docs/marketing/MEDIUM_AI_ANSWERS_NEED_RECEIPTS.md. Run npm run blog:sync; do not edit this copy directly. -->

The answer arrives in seconds:

> The launch moved because the authentication work is blocked by the mobile
> redesign.

It is concise. It is plausible. It may even be correct.

But the next decision depends on it. Do you move the launch again? Reassign the
authentication work? Tell someone outside the team?

At that moment, polished prose is not enough. You need a receipt.

### AI can move the search burden to the wrong side of the answer

A workplace assistant can save time by reading material that would take a person
much longer to collect. Yet an unsupported answer creates a second task: verify
what the assistant just said.

That task is often harder than the original search. Now the reader must locate
the underlying material _and_ work out which pieces the model used, which ones it
ignored, and whether its summary blended an old plan with a current one.

The search did not disappear. It moved to the end, where the answer's fluency can
make checking feel optional.

The useful unit is therefore not merely an answer. It is an **answer with a short,
inspectable path back to the evidence**.

### Confidence is not provenance

Language models produce coherent language. Coherence is useful, but it does not
establish where a claim came from.

Compare two questions:

- What might be blocking the release?
- Is the release still blocked today?

The first invites synthesis. The second asks for a current fact. A response can
sound equally assured in both cases while requiring very different evidence.

This is where generic confidence scores are of limited help. “High confidence”
does not tell the reader whether the assistant found yesterday's resolution or
stopped at last week's blocker. Provenance does.

### A bibliography is not an audit trail

Adding a “Sources” heading at the bottom is a start, but it can still leave most
of the work to the reader.

If three paragraphs cite six documents and two chat channels, which source
supports the sentence about the deadline? Which one supports the dependency?
Opening everything recreates the search session the assistant was meant to
shorten.

Useful citations have three properties:

1. **They are close to the claim.** The reader can see which evidence belongs
   to which statement.
2. **They identify a real object.** “Project results” is vague; a named task,
   thread, note, or project is inspectable.
3. **They take the reader to the object.** A citation should not end at another
   search page.

This changes verification from a scavenger hunt into a small set of concrete
checks.

### Sources replace one impossible trust decision with several easy ones

An uncited answer asks:

> Do I trust this AI?

That question is too broad to be useful. Reliability varies by topic, date,
available context, and the exact claim being made.

A cited answer permits narrower questions:

- Is this the task the sentence refers to?
- Does the linked thread contain the decision?
- Is this note current?
- Did the cited blocker close yesterday?

The reader does not need a universal judgment about the model. They can inspect
the evidence that matters for the decision in front of them.

This also gives disagreement somewhere productive to go. If two people read a
summary differently, they can open the cited source and discuss the underlying
work. The conversation is no longer trapped at “I trust the AI” versus “I
don't.”

### Citations are an application feature, not a formatting trick

Reliable source links require more than prompting a model to emit footnotes.

The application needs stable identities for the objects it cites. It must
distinguish a task from a note that happens to share its title. The user must be
authorized to retrieve the source and still authorized when opening it. The
interface must keep evidence visible without making the answer unreadable.

A practical design uses two layers:

- clickable references beside the claims that need support;
- a compact set of source objects for scanning the evidence as a whole.

The prose remains readable. The path to verification remains short.

There is an important negative requirement too: the citation must not imply more
than it proves. A link beside a paragraph can create a false sense that every
sentence in the paragraph came from that source. Citation placement is part of
the claim the product makes about its own answer.

### Reusing an answer raises the permission bar

Evidence-backed answers can become useful objects themselves. When the same
question returns, search can surface an earlier answer rather than paying the
cost—in time and computation—of deriving it again.

But a saved answer may contain material from several restricted sources. Being
allowed to see one source is not enough. A safe reuse rule is that the viewer
must be able to read **all** of the answer's sources. If that cannot be
established, the answer should not be surfaced.

The answer should also remain separate from primary evidence. Feeding old AI
answers back into the assistant's own grounding can create a loop in which a
summary is treated as a source, then cited by another summary, gradually
detaching the result from the underlying work.

The durable hierarchy is simple: source material first, derived answer second.

### What I built

Full disclosure: I built **Genos**, a browser-based MVP for chat, tasks,
collaborative notes, and AI-assisted work.

Genos AI streams answers with clickable inline citations and source chips. The
references point back to workspace objects so the reader can move from a claim
to the material behind it.

Eligible past AI answers can also appear in typeahead, but only for a person who
can read all of their sources. Those past answers are excluded from the agent's
own grounding, so the system does not treat its previous prose as new primary
evidence.

None of this guarantees that an answer is correct. It makes a specific answer
cheaper to challenge, confirm, and reuse. That is a smaller promise than
infallibility and a more useful one.

Genos is solo-built, web-only, and still an MVP. The demo works without an
account at **[genosai.dev](https://genosai.dev)**; there is a free plan and no
credit card.

Workplace AI will keep getting better at answering. The standard should also be
that no important answer becomes harder to verify merely because it was written
beautifully.
