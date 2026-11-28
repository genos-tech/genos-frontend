---
id: company-setup
title: Setting up Genos for your company: an owner's checklist
settings: [mentionGroups, security, planUsage, developer]
---

## Before you start

This is a short list and some clicking, not a project. Read "Organising a large workspace: one team, many departments" first; this note is the checklist for building it. Inviting people (step 6) needs the team owner or editor role. Steps 8 to 10 are for the team owner.

## 1. Write down the departments

Make a short list, spelled the same way everywhere (payments, billing, growth). Each name becomes the tag, the @group, the folder and the chat, so keep names short and lowercase. You can rename any of them later. If you are creating the team now, type the list into the "Departments (optional)" box on the create-team page. Genos then makes the project tag, the mention group, the team folder and the public chat for each one, and you can skip steps 2 to 4 for them.

## 2. Make the mention groups

Settings → Mention groups → New group, one per department (and per sub-team). Add the people. This is also how you will reach a whole department in one message.

## 3. Make the team folders

Notes → Team Notes: one folder per department, with subfolders for sub-teams. Choose who can open each one. Use a private folder for HR, finance or security. Add the mention group instead of adding people one by one.

## 4. Make the group chats

Every team starts with a public chat for the whole company called "general". Add one public chat per department ("payments · general"), unless the "Departments" box already made it. Add private chats only where a small group needs them. Nobody is added to a chat for you: people find public ones with "Browse group chats" in the chat sidebar menu, or by name in the chat search.

## 5. Make the projects and tag them

Create the projects (Tasks sidebar → New Project) and put the department's tag on each (open the project, then Edit tags). Make a project private only when its contents must stay inside. Its name is still visible to the team unless you also make it hidden.

## 6. Invite people

Open the Team menu (top left), choose Show Team Profile, then click Invite members. Then add each person to their department's mention group, folder, chat and projects. Guests are invited project by project, from each project ("Invite guests"); they see only the projects they were invited to, not the rest of the workspace.

## 7. Teach three habits

- Where does it go? (the list in "Organising a large workspace")
- Join little, find everything: Cmd-K, then # and @.
- Name things "department · topic" so a search finds them together.

## 8. Set up billing

Each person has their own plan in Settings → Plan & Usage. To pay for everyone at once, the team owner uses the "Team plan" section there (Team Core, Team Pro or Team Max). It is billed per seat, and only the team owner sees it. "Manage team billing" changes or cancels it.

## 9. Secure sign-in

Ask everyone, starting with yourself and your editors, to turn on two-step verification in Settings → Security. After the password, Genos then asks for a 6-digit code from an authenticator app. Keep the recovery codes somewhere safe. It applies to signing in with email and password. People who sign in with Google or GitHub turn it on in that account instead. Genos cannot require it for the whole team, so check with people directly.

## 10. Decide about AI apps, and keep watch

Members can connect AI apps such as Claude or ChatGPT to Genos (Core plan and above). An app only sees what its member can see. To connect one, see "Connecting Genos to other tools: API, MCP, and realtime".

As the owner, you can check what is connected in Settings → Developer:

- **Connected AI apps**: every AI app that can work in this team, and who connected it. You can end any of them for this team ("End access to this team"). An editor can end a viewer's.
- **AI app use**: how much each member's AI apps did in this team, by week. It shows counts only, never what was read or searched.
- **Team API keys**: every key that can act on this team. You can revoke any of them.
- **Security log**: members joining and leaving, role and ownership changes, invites, API keys, webhooks and alerts. Kept for 365 days.
- **Webhooks**: addresses that receive this team's events. Only owners and editors can add one.

Owner, editor and viewer roles are explained in "Teams, members, and roles".
