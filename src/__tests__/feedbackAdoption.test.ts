/**
 * MIP-1132 guard: no surface renders its own Joy Snackbar any more; every
 * toast goes through the shared host. The list of files still allowed to
 * import Snackbar may only shrink.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return name === "__tests__" ? [] : walk(full);
        return /\.tsx?$/.test(name) ? [full] : [];
    });

const files = walk(SRC).map((f) => ({ f: relative(SRC, f), text: readFileSync(f, "utf8") }));

describe("feedback adoption", () => {
    it("no file imports Snackbar from @mui/joy", () => {
        const offenders = files
            .filter(({ text }) =>
                [...text.matchAll(/import\s+([^;]*?)\s+from\s+"@mui\/joy(\/Snackbar)?";/gs)].some(
                    ([, names, sub]) => sub === "/Snackbar" || /\bSnackbar\b/.test(names)
                )
            )
            .map(({ f }) => f);
        expect(offenders).toEqual([]);
    });

    it("the hand-built tab strips are gone: the thread and inbox tabs use TabStrip", () => {
        const uses = (path: string) =>
            files.find(({ f }) => f === path)?.text.includes("ui/feedback/TabStrip") ?? false;
        expect(uses("features/chat/components/shared/ThreadTabStrip.tsx")).toBe(true);
        expect(uses("features/inbox/components/InboxTabHeader.tsx")).toBe(true);
    });

    it("the three note tab lists are one NoteTabStrip", () => {
        for (const gone of [
            "features/notes/common/components/NoteTabList.tsx",
            "features/notes/chat-notes/components/ChatNoteTabList.tsx",
            "features/notes/task-notes/components/TaskNoteTabs.tsx",
        ]) {
            expect(files.some(({ f }) => f === gone)).toBe(false);
        }
        for (const main of [
            "features/notes/my-notes/components/MyNoteMain.tsx",
            "features/notes/task-notes/components/TaskNoteMain.tsx",
            "features/notes/chat-notes/components/ChatNoteMain.tsx",
        ]) {
            expect(files.find(({ f }) => f === main)?.text).toContain("NoteTabStrip");
        }
    });

    it("the four old EmptyStates are gone: each renders the shared one", () => {
        const shared = (path: string) =>
            files.find(({ f }) => f === path)?.text.includes("ui/feedback/EmptyState") ?? false;
        expect(shared("features/chat/ToDoPane.tsx")).toBe(true);
        expect(shared("features/chat/components/sidebar/ChatList.tsx")).toBe(true);
        expect(shared("features/notes/my-notes/components/MyNoteMain.tsx")).toBe(true);
        // The ones people actually meet: no note open, no chat open, empty inbox.
        expect(shared("features/notes/common/components/NoteContentRenderer.tsx")).toBe(true);
        expect(shared("features/chat/components/panels/SelectChatPanel.tsx")).toBe(true);
        expect(shared("features/inbox/components/InboxSection.tsx")).toBe(true);
        expect(
            files.some(({ f }) => f === "features/notes/common/components/EmptyState.tsx")
        ).toBe(false);
    });

    it("MIP-1276: a failed load is the shared ErrorState, not a hand-built red line + Retry", () => {
        // The eight surfaces that each drew their own now render ErrorState. A file may
        // render the localized Retry itself only for a reason listed here; the list may
        // only shrink.
        const ALLOWED: Record<string, string> = {
            "components/ui/feedback/ErrorState.tsx": "the ErrorState itself",
            "features/agentQA/AgentTurn.tsx": "re-asks a finished turn: not a failed load",
        };
        const offenders = files
            .filter(({ f, text }) => f.endsWith(".tsx") && /actions\.retry\b/.test(text))
            .map(({ f }) => f)
            .filter((f) => !(f in ALLOWED));
        expect(offenders).toEqual([]);
        const uses = (path: string) =>
            files.find(({ f }) => f === path)?.text.includes("ui/feedback/ErrorState") ?? false;
        for (const f of [
            "features/spotlight/SpotlightContent.tsx",
            "features/genos/GenosSessionSidebar.tsx",
            "features/genos/memory/ConversationsSection.tsx",
            "features/genos/memory/MemoryNoticedSection.tsx",
            "features/genos/memory/SharedAnswersSection.tsx",
            "features/genos/memory/MemoryControlSections.tsx",
        ]) {
            expect(uses(f), f).toBe(true);
        }
    });

    it("MIP-1276: the surfaces that used to go blank or read 'empty' on failure use DataState", () => {
        const uses = (path: string, what: string) =>
            files.find(({ f }) => f === path)?.text.includes(what) ?? false;
        for (const f of [
            "features/tasks/components/contents/base/sub/TaskActivityFeed.tsx",
            "features/tasks/components/dashboard/TaskVelocitySection.tsx",
            "features/integrations/components/ConnectionsSection.tsx",
            "features/integrations/components/GithubRepoAccessSection.tsx",
            "features/notes/common/components/NoteLoadState.tsx",
        ]) {
            expect(uses(f, "ui/feedback/DataState"), f).toBe(true);
        }
        // A note panel that has not resolved must hand off to NoteLoadState, never
        // `return null` (which is what left a failed open blank for good).
        for (const f of [
            "features/notes/my-notes/components/MyNoteEditorPanel.tsx",
            "features/notes/task-notes/components/TaskNoteEditorPanel.tsx",
            "features/notes/chat-notes/components/ChatNoteEditorPanel.tsx",
        ]) {
            expect(uses(f, "<NoteLoadState"), f).toBe(true);
        }
    });

    it("MIP-1173: no raw CircularProgress outside the Spinner and the determinate upload rings", () => {
        // Rule: in a button -> the Button's `loading`; a list -> SkeletonRows; a block of
        // text -> SkeletonLines; anything else -> Spinner (with a `caption` for a page).
        const ALLOWED: Record<string, string> = {
            "components/ui/feedback/Skeleton.tsx": "the Spinner itself",
            "components/ui/feedback/FileUploadProgress.tsx":
                "determinate progress rings (a percentage), not a wait of unknown length",
        };
        const offenders = files
            .filter(({ text }) => /\bCircularProgress\b/.test(text))
            .map(({ f }) => f)
            .filter((f) => !(f in ALLOWED));
        expect(offenders).toEqual([]);
        // An exception that no longer needs to exist must be deleted.
        for (const f of Object.keys(ALLOWED)) {
            expect(files.find((x) => x.f === f)?.text).toMatch(/\bCircularProgress\b/);
        }
    });

    it("MIP-1173: a panel that is empty renders EmptyState, not a bare 'No X' Typography", () => {
        // Anything the scan finds must be a tiny inline hint (a), or not an empty state at all
        // (b), and must be listed here with the reason. The list may only shrink.
        const ALLOWED: Record<string, string> = {
            "components/editors/sub/CommentsSidebar.tsx": "text of a comment that has no body",
            "components/layout/DeveloperSettingsSection.tsx":
                "a warning inside the webhook form: no group channel to pick",
            "components/layout/MentionGroupEditor.tsx": "no match inside the member picker list",
            "components/layout/SettingsModal.tsx": "status line: the account has no model to pick",
            "components/ui/misc/ModalTransferOwner.tsx": "no match inside a searchable picker",
            "features/agentQA/AgentTurn.tsx": "a turn's own status line",
            "features/agentQA/approval/ApprovalEditFields.tsx": "value text of a preview row",
            "features/agentQA/approval/BulkUpdatePreview.tsx": "line of an approval preview",
            "features/chat/components/modals/ModalAddMembers.tsx": "no match in a member picker",
            "features/chat/components/modals/ModalCreateGM.tsx": "no match in a member picker",
            "features/chat/components/modals/ModalCreateMDM.tsx": "no match in a member picker",
            "features/inbox/components/GenosReportCard.tsx":
                "the all-clear banner (a success, not an empty list)",
            "features/integrations/IntegrationsHome.tsx":
                "success banner: the webhook needs no setup",
            "features/integrations/components/ConnectionsSection.tsx": "fallback of a value",
            "features/notes/common/components/AttachmentDestinationPicker.tsx":
                "helper under a select that has no option",
            "features/notes/common/components/ModalNoteSharing.tsx":
                "no match inside the teammate picker",
            "features/notes/my-notes/components/MyNoteFolderTree.tsx":
                "one row inside an empty tree folder",
            "features/notes/team-notes/components/TeamNoteFolderTree.tsx":
                "one row inside an empty tree folder",
            "features/tasks/components/autocompletes/ACTaskSelector.tsx":
                "no options in a listbox",
            "features/tasks/components/contents/base/CustomFieldsBlock.tsx":
                "one hint row inside the properties list",
            "features/tasks/components/contents/base/TaskDeliveriesBlock.tsx":
                "fallback of a value",
            "features/tasks/components/dashboard/TaskHomeContent.tsx":
                "value labels and the tiny 'no overdue / none due this week / no members' lines inside dashboard cards",
            "features/tasks/components/layout/TaskHomeLayout.tsx":
                "the first-run hero (brand gradient, large create-project button): kept until the look is decided (MIP-1329)",
            "features/tasks/components/modals/ModalCreateProject.tsx":
                "no match in a member picker",
            "features/tasks/components/sidebar/ProjectsListItem.tsx": "one dense sidebar row",
            "features/tasks/components/sidebar/projects_subs/JoinProjectListItem.tsx":
                "one dense sidebar row",
            "features/tasks/sprint-milestone/components/SprintManagerDialog.tsx":
                "a value ('none') in a row",
        };
        // `<Typography ...>{expr}</Typography>` where expr names an empty/no*/nothing*/none* key.
        const KEY = /\b(?:empty[A-Za-z]*|no[A-Z][A-Za-z]*|nothing[A-Za-z]*|none[A-Z]?[A-Za-z]*)\b/;
        const scan = (text: string): string[] => {
            const hits: string[] = [];
            let i = 0;
            while ((i = text.indexOf("<Typography", i)) !== -1) {
                let j = i + "<Typography".length;
                let depth = 0;
                let quote = "";
                for (; j < text.length; j++) {
                    const c = text[j];
                    if (quote) {
                        if (c === quote && text[j - 1] !== "\\") quote = "";
                    } else if (c === '"' || c === "'" || c === "`") quote = c;
                    else if (c === "{") depth++;
                    else if (c === "}") depth--;
                    else if (c === ">" && depth === 0 && text[j - 1] !== "=") break;
                }
                const end = text.indexOf("</Typography>", j);
                if (end === -1) break;
                const child = /^\s*\{([^{}]*)\}\s*$/.exec(text.slice(j + 1, end));
                // Looks like a locale lookup (a.b), and the key part names an empty state.
                if (child && /[A-Za-z]\.\s*[A-Za-z]/.test(child[1])) {
                    const keys = child[1].replace(/\b[a-z]\w*(?:\.\s*[a-z]\w*)*\.\s*/g, "");
                    if (KEY.test(keys)) hits.push(child[1].trim());
                }
                i = end;
            }
            return hits;
        };
        const flagged = files.filter(({ text }) => scan(text).length > 0).map(({ f }) => f);
        expect(flagged.filter((f) => !(f in ALLOWED))).toEqual([]);
        expect(Object.keys(ALLOWED).filter((f) => !flagged.includes(f))).toEqual([]);
    });

    it("MIP-1173: HistoryModal uses the shared EmptyState, not a local copy", () => {
        const text = files.find(({ f }) => f === "components/layout/HistoryModal.tsx")?.text ?? "";
        expect(text).toContain("ui/feedback/EmptyState");
        expect(text).not.toMatch(/const EmptyState\b/);
    });
});
