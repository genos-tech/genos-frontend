---
id: security
title: Security and sign-in
settings: [security, account, developer]
---

## Two-step verification

Two-step verification makes Genos ask for a 6-digit code from an authenticator app after your password. A stolen or guessed password alone can no longer open your account.

- It applies when you sign in with your email and password. If you sign in with Google or GitHub, turn on two-step verification in that account instead. There is nothing to set up in Genos.
- It is off until you turn it on.

To turn it on:

1. Open Settings > **Security** and choose **Turn on**.
2. Enter your password.
3. Scan the QR code with an authenticator app (Google Authenticator, 1Password, Authy or any app that makes 6-digit codes). If you can't scan it, type the setup key into the app.
4. Enter the 6-digit code the app shows. The code changes every 30 seconds.
5. Save your 10 recovery codes (**Copy all** or **Download**), confirm with "I have saved these codes", and choose **Done**. They are shown only this once. Keep them apart from your password.

When you sign in, enter the code from the app. If you don't have your phone, choose **Use a recovery code**. Each recovery code works once. Settings > **Security** shows how many are left. **Get new recovery codes** replaces the whole set, and the old codes stop working.

**Turn off**, **Turn on** and **Get new recovery codes** all ask for your password.

After 5 wrong codes in a row, the account is locked for 15 minutes. Each further wrong code makes the wait longer, up to 24 hours.

## If you lose your phone

1. Sign in with your password, then choose **Use a recovery code** and enter one of your codes.
2. Open Settings > **Security**, choose **Turn off**, then **Turn on** again with your new phone.
3. Save the new recovery codes.

If you have lost your recovery codes too, email genos.support@genosai.dev. Support checks that the account is yours before turning two-step verification off. Then you sign in with your password and can set it up again.

## Your password is asked again

Before you add an API key or a webhook, connect an AI app, or give a connected app more access, Genos asks for your password ("Confirm it's you"). After that it does not ask again for 10 minutes. Accounts that sign in with Google or GitHub have no password to enter, so they are not asked.

Genos also emails the address you signed up with whenever an API key, a webhook or an AI-app connection is created on your account.

## Password and email

- There is no way to change your password while signed in. Sign out, choose **Forgot password?** on the sign-in page, and use the link in the email. This works only for accounts that sign in with email and password.
- Resetting your password signs you out everywhere. It also ends your connected AI apps and your API keys. Reconnect your apps and create new keys when you need them.
- Your email address cannot be changed in the app.

## See what happened

- **Your security activity** (Settings > **Account**): your recent sign-ins, sign-outs, data exports, connected accounts and API keys, plus failed attempts to sign in to your account. If something there wasn't you, reset your password.
- **Security log** (Settings > **Developer**, team owner only): sensitive changes to the team, newest first: members joining and leaving, role and ownership changes, invites, API keys, webhooks and alerts. Entries are kept for 365 days.

## Export or delete your account

- **Export your data** (Settings > **Account** > **Download my data**): a JSON file of everything you created: your profile, notes, to-dos, tasks, messages and comments. Team content written by other people is not included.
- **Delete your account** (Settings > **Account** > **Delete account**): type DELETE, and your password if your account has one. Your name, email and profile are erased and you are signed out everywhere. Your private notes, to-dos and AI history are deleted. Teams where you were the last member are closed. Work you did with teammates stays in their workspace, shown as "Deleted user". This cannot be undone.
- You cannot delete your account while you own a team that has other members. Transfer ownership from each team's profile first. To leave one team and keep the rest, use **Your teams** in Settings > **Account**.
