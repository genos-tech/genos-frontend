---
id: fixes
title: Fixes for specific problems
settings:
    [
        notifications,
        notifications.master,
        notifications.quietHours,
        notifications.email,
        notifications.mutedChat,
        notifications.mutedItem,
        planUsage,
        aiCreditUsage,
        security,
        account,
    ]
---

## Notifications

- **Nothing arrives at all**: open Settings > **Notifications**. Check that Web notifications is on and that notifications are not paused (a moon on your avatar means they are paused). Then check **Browser permission**. If the browser blocks Genos, no setting in the app can override that.
- **Nothing on an iPhone**: iOS delivers notifications only to the installed app. In Safari, tap Share and choose "Add to Home Screen", open Genos from the home screen, sign in, and allow notifications.
- **Quiet for one conversation only**: it is probably muted. Settings > **Notifications** lists your muted chats and muted items (threads, tasks, notes). Unmute them from there.
- **Too much email**: email has its own switch and categories, apart from in-app and desktop notifications. Every notification email also has an unsubscribe link.
- **A toast instead of a desktop notification**: that is how it works. When the Genos tab is in front, you get an in-app toast. Desktop notifications are for when the tab is in the background.

## Access

- **A project or note won't open**: you are probably not a member. Where it is offered, use request access. The owner approves or declines it from their Inbox.
- **You can't invite anyone**: inviting needs the team owner or an editor. Ask the owner to make you an Editor.
- **The owner has gone quiet**: an editor can choose **Request ownership** in the Team Profile. If the owner does not answer within 30 days, the editor can choose **Take ownership**.
- **An invite link doesn't work**: invites work only for the email address they were sent to and expire after 7 days. If you are signed in as someone else, choose **Sign out and continue**. If it expired, ask for a new invite.
- **Account deletion is refused**: you still own a team that has other members. Transfer ownership of that team from its Team Profile, then delete.

## "Your plan doesn't include…"

- **Connecting an AI app shows "Not on your plan"**: connecting AI apps starts at Core. See Settings > **Plan & Usage**.
- **A connected app shows "Paused"**: your plan does not include connected apps right now. It stays in the list and works again on Core or above.
- **A schedule says it is paused because of your plan**: scheduled reports start at Core. Your schedules are kept and resume when you upgrade.
- **"Webhooks aren't included in your team's plan"**: webhooks start at Core. The team's plan or the team owner's plan counts.
- **An HTML page won't import**: HTML pages start at Core. A page over your plan's size limit is refused too, and so is a page that would take you past your HTML storage.
- **"Your plan keeps up to … skills"**: delete a skill or upgrade.
- **An effort level says "Upgrade to unlock"**: Free goes up to Low, Core up to Medium, Pro and up to High.
- **"You've created all … for this month"**: you reached the monthly task or note limit. It resets on the 1st (UTC).

## Genos and AI credits

- **Out of credits**: Genos says "You've used all your AI credits, so Genos can't answer right now." Choose **Buy credits** for a pack that never expires, or **Upgrade plan**. Monthly credits reset on the 1st (UTC). Settings > **AI credit usage** shows what used them.
- **A long answer stopped partway**: your balance ran low during the request. Buy credits or wait for the monthly reset.
- **Out of asks for today** (when Genos does not use credits): the count resets at midnight UTC. Settings > **Plan & Usage** shows where you stand.
- **It can't find something you just made**: indexing takes a moment. Try again shortly.
- **It says it can't see something you can see**: check that you are in the right team. Each team's content is separate. Only one team can be active in a browser at a time. If a tab says you signed in to another team in another tab, reload it.
- **It answered from something out of date**: fix the note it used. Answers follow the notes.
- **A provider shows "Available soon"**: that provider is not offered yet.

## Signing in

- **Forgot your password**: on the sign-in page choose **Forgot password?** and use the link in the email. This works only for accounts that sign in with email and password. A Google or GitHub account has no Genos password: sign in with that provider.
- **"Too many wrong codes"**: after 5 wrong two-step codes in a row the account is locked for 15 minutes. Each further wrong code makes the wait longer, up to 24 hours. Wait, then try again.
- **"That sign-in expired"**: the code step must be done within a few minutes of entering your password. Enter your password again.
- **Lost your phone**: on the code step choose **Use a recovery code** and enter one of your recovery codes. Each code works once. Then open Settings > **Security**, choose **Turn off** and **Turn on** to set up your new phone, and save the new recovery codes.
- **Lost your phone and your recovery codes**: email support. Support checks that the account is yours before turning two-step verification off.

## Everything else

- **An upload was refused**: the file is over your plan's per-file size limit.
- **The page looks stale or a button does nothing**: reload the tab. A tab left open for days keeps running the code it started with.
- **You deleted a note's content by accident**: open the note's history and restore an earlier version.
- **You deleted the in-app guide and want it back**: it is not re-created by itself. Ask support to restore it.
- Still stuck: genos.support@genosai.dev
