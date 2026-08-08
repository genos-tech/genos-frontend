<!-- Generated from genos-docs/marketing/REDDIT_PRODUCTIVITY_MESSAGES_COME_BACK.md. Run npm run blog:sync; do not edit this copy directly. -->

Disclosure: I am building a workspace called Genos, and I recently shipped this
workflow in it. I am asking because I am not convinced I chose the right
abstraction.

The case is simple: a message needs action later. Saving or flagging it preserves
the message, but the list is passive. Turning it into a task gives it a due date,
but now there are two objects and the task may lose the surrounding conversation.

I treated the reminder as part of the message flag:

1. Add a time to the original message.
2. Keep it visible as a flagged item before the time arrives.
3. At that time, send Web Push and create an Inbox activity that links back to the
   message.
4. If the flag is completed or removed first, cancel the pending reminder.

That behavior is shipped. The broader product is still a web-only MVP.

The trade-off I want criticism on: should "remind me about this message" stay a
message-level action, or should every reminder create a real task with ownership,
status, and a due date?

For people who have a system that survives a busy week: what do you use, and where
does it fail? Also, should a reminder fire while you already have that conversation
open, or should presence suppress it?

---

## Optional reply if someone asks for the product

Use only if links are allowed:

> I built the workflow in Genos. There is a no-login demo at
> <https://genosai.dev>. It is a web-only MVP. The relevant behavior is the
> message flag/reminder flow; no signup is needed to inspect the product.
