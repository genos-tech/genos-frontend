/**
 * MIP-1126 batch 3: the remaining dialogs render through `ModalFrame`.
 *
 * Same contract as batch 2: a migrated file builds no dialog of its own (no
 * `Modal` / `ModalDialog` / `ModalClose`), has no gradient, blur or dialog-wide
 * scrollbar class, and reads its colors from the tokens. The layers are pinned
 * too: every one of these dialogs kept the layer it had (Joy's modal layer, the
 * 10010 page layer, or a host-derived one), and a dialog reachable from a
 * modal-hosted surface keeps deriving its layer from that host (genos-ui rule 1).
 * A source scan, because most of them need a deep prop tree to render; the ones
 * with logic are rendered in `ModalFrameBatch3Frames.test.tsx`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");

const FRAMES = {
    createTeam: "features/admin/components/modals/ModalCreateTeam.tsx",
    requestOwnership: "features/admin/components/team/ModalRequestOwnership.tsx",
    sprintConfig: "features/tasks/sprint-milestone/components/SprintConfigDialog.tsx",
    remindMe: "features/chat/components/modals/ModalRemindMe.tsx",
    taskFromTodo: "features/chat/components/todo/ModalCreateTaskFromTodo.tsx",
    scheduledTodos: "features/chat/components/todo/ModalScheduledTodos.tsx",
    calendarEvent: "features/integrations/components/CalendarEventModal.tsx",
    noteHistory: "features/notes/common/components/ModalNoteHistory.tsx",
    noteSharing: "features/notes/common/components/ModalNoteSharing.tsx",
    folderName: "features/notes/my-notes/modals/ModalFolderName.tsx",
    moveToFolder: "features/notes/my-notes/modals/ModalMoveToFolder.tsx",
    teamFolderName: "features/notes/team-notes/modals/ModalTeamFolderName.tsx",
    exportFolder: "features/notes/common/components/ModalExportFolder.tsx",
    teamFolderTags: "features/notes/team-notes/modals/ModalTeamFolderTags.tsx",
    teamFolderMembers: "features/notes/team-notes/modals/ModalTeamFolderMembers.tsx",
    milestoneFolder: "features/tasks/components/sidebar/projects_subs/ModalMilestoneFolder.tsx",
    mentionGroup: "components/layout/MentionGroupModal.tsx",
    shareMeetLink: "features/chat/components/modals/ModalShareMeetLink.tsx",
    noteAsk: "features/noteAsk/NoteAskModal.tsx",
    threadAsk: "features/threadAsk/ThreadAskModal.tsx",
    spotlightSettings: "features/spotlight/SpotlightSettingsModal.tsx",
    userProfile: "features/admin/components/modals/ModalUserProfile.tsx",
    userProfileStatus: "features/admin/components/modals/sub/UserProfileStatus.tsx",
} as const;

/** Parts of the user profile that are not frames but used to carry the dark/light style table. */
const PROFILE_PARTS = [
    "features/admin/components/modals/sub/UserProfileAbout.tsx",
    "features/admin/components/modals/sub/UserProfileLocalTime.tsx",
    "features/admin/components/modals/sub/UserProfileLocation.tsx",
    "features/admin/components/modals/sub/UserProfileLocationShare.tsx",
    "features/admin/components/modals/sub/UserProfilePhone.tsx",
    "features/admin/components/modals/sub/UserProfileRole.tsx",
];

// Comments mention the old patterns; strip them.
const code = (file: string) =>
    readFileSync(join(src, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

const tokensOnly = (text: string) => {
    expect(text).not.toMatch(/linear-gradient|radial-gradient|backdropFilter/);
    expect(text).not.toMatch(/rgba\(\s*\d/);
    expect(text).not.toMatch(/--gp-/);
    // `isDark ? "color" : "color"`; handing `isDark` to a child is not the pattern.
    expect(text).not.toMatch(/isDark\s*\?\s*["'`]/);
    expect(text).not.toMatch(/ProfileModalStyles/);
};

describe("migrated dialogs (batch 3)", () => {
    for (const [name, file] of Object.entries(FRAMES)) {
        describe(`${name}: ${file}`, () => {
            const text = code(file);

            it("renders through ModalFrame and builds no dialog of its own", () => {
                expect(text).toMatch(/<ModalFrame\b/);
                expect(text).not.toMatch(/<ModalDialog\b/);
                expect(text).not.toMatch(/<Modal\b/);
                expect(text).not.toMatch(/<ModalClose\b/);
            });

            it("has no gradient surface, blur, glow, own keyframes or dialog-wide scrollbar class", () => {
                expect(text).not.toMatch(/custom-scrollbar-/);
                expect(text).not.toMatch(/keyframes/);
            });

            it("reads its colors from the tokens", () => tokensOnly(text));
        });
    }

    for (const file of PROFILE_PARTS) {
        it(`${file} reads the tokens, not the old dark/light style table`, () => {
            tokensOnly(code(file));
        });
    }

    it("the mobile account sheet (a bottom sheet, not a dialog) reads the tokens, not the purple palette", () => {
        const text = code("components/layout/MobileAccountSheet.tsx");
        expect(text).not.toMatch(/purplePalette/);
        expect(text).not.toMatch(/rgba\(\s*\d|--gp-/);
        expect(text).toMatch(/g\.accent\.text/);
    });

    describe("layers are the ones the dialogs always had", () => {
        const joyLayer = /zIndex=\{theme\.zIndex\.modal\}/;

        it("page-level dialogs keep 10010", () => {
            expect(code(FRAMES.createTeam)).toMatch(/zIndex=\{10010\}/);
            expect(code(FRAMES.requestOwnership)).toMatch(/zIndex=\{10010\}/);
            // the folder picker: the frame's own default (10010), raised only by a note host
            const move = code(FRAMES.moveToFolder);
            expect(move).not.toMatch(/zIndex=/);
            expect(move).toMatch(/hostZIndex=\{hostZIndex\}/);
            expect(code(FRAMES.exportFolder)).not.toMatch(/zIndex=/);
            expect(code(FRAMES.milestoneFolder)).toMatch(/zIndex=\{10010\}/);
            expect(code(FRAMES.shareMeetLink)).toMatch(/zIndex=\{10010\}/);
        });

        it("dialogs that were on Joy's default layer stay there", () => {
            expect(code(FRAMES.sprintConfig)).toMatch(joyLayer);
            expect(code(FRAMES.calendarEvent)).toMatch(joyLayer);
            expect(code(FRAMES.mentionGroup)).toMatch(joyLayer);
        });

        it("to-do pane dialogs follow the to-do host, else their own layer", () => {
            const remind = code(FRAMES.remindMe);
            expect(remind).toMatch(/useTodoDialogLayer\(10010\)/);
            expect(remind).toMatch(/zIndex=\{layer\}/);
            for (const f of [FRAMES.taskFromTodo, FRAMES.scheduledTodos]) {
                expect(code(f)).toMatch(/zIndex=\{layer \?\? theme\.zIndex\.modal\}/);
            }
            // the delete confirmation still sits ten above the scheduled-todos dialog
            expect(code(FRAMES.scheduledTodos)).toMatch(
                /zIndex=\{layer != null \? layer \+ 10 : undefined\}/
            );
        });

        it("note dialogs derive their layer from the note host (host + 2), else Joy's layer", () => {
            for (const f of [
                FRAMES.noteHistory,
                FRAMES.noteSharing,
                FRAMES.teamFolderName,
                FRAMES.teamFolderTags,
                FRAMES.teamFolderMembers,
                FRAMES.noteAsk,
            ]) {
                const text = code(f);
                expect(text).toMatch(/hostZIndex=\{hostZIndex\}/);
                expect(text).toMatch(joyLayer);
                expect(text).toMatch(/useNoteModalHostZIndex\(\)/);
            }
        });

        it("the thread ask dialog keeps its `zIndex` prop (a Spotlight / preview host raises it)", () => {
            expect(code(FRAMES.threadAsk)).toMatch(/zIndex=\{zIndex \?\? theme\.zIndex\.modal\}/);
        });

        it("Genos settings stay above the Spotlight overlay (13100)", () => {
            const text = code(FRAMES.spotlightSettings);
            expect(text).toMatch(/SPOTLIGHT_SETTINGS_Z_INDEX = 13200/);
            expect(text).toMatch(/zIndex=\{SPOTLIGHT_SETTINGS_Z_INDEX\}/);
        });

        it("profile dialogs: the user profile is on the profile layer, its time pickers above it", () => {
            expect(code(FRAMES.userProfile)).toMatch(/zIndex=\{PROFILE_MODAL_Z_INDEX\}/);
            expect(code(FRAMES.userProfileStatus).match(/zIndex=\{10020\}/g)).toHaveLength(2);
        });
    });

    describe("UrlLinkModal (the preview host) keeps its own frame and its host arithmetic", () => {
        // It is not a ModalFrame: the views inside carry their own headers and it floats an
        // "open full page" and an X over them. Only its surface reads the tokens now.
        const text = code("components/modals/UrlLinkModal.tsx");

        it("reads the tokens", () => {
            expect(text).not.toMatch(/rgba\(\s*\d/);
            expect(text).not.toMatch(/isDark|useColorScheme|theme\.palette\.mode/);
            expect(text).toMatch(/boxShadow: g\.shadow\.lg/);
            expect(text).toMatch(/borderRadius: g\.radius\.lg/);
        });

        it("still stacks at its `zIndex` (default 10020) and lifts Joy's listbox popups +10", () => {
            expect(text).toMatch(/const effectiveZIndex = zIndex \?\? 10020/);
            expect(text).toMatch(/zIndex: effectiveZIndex,/);
            expect(text).toMatch(/"--unstable_popup-zIndex": effectiveZIndex \+ 10/);
            expect(text).toMatch(
                /'& ~ \[role="listbox"\]': \{ "--unstable_popup-zIndex": effectiveZIndex \+ 10 \}/
            );
        });

        it("passes the same layer to every view as `hostZIndex`", () => {
            expect(text.match(/hostZIndex=\{effectiveZIndex\}/g)).toHaveLength(5);
        });
    });

    describe("sizes and phone behavior", () => {
        it("the user profile is the full-screen-on-phone profile frame, as its siblings", () => {
            const text = code(FRAMES.userProfile);
            expect(text).toMatch(/size="profile"/);
            expect(text).toMatch(/fullScreenOnMobile/);
            expect(text).toMatch(/\bflush\b/);
        });

        it("the sharing sheet clears the mobile bottom bar", () => {
            expect(code(FRAMES.noteSharing)).toMatch(/clearBottomBar/);
        });

        it("version history is the wide ladder and stacks its panes on a phone", () => {
            const text = code(FRAMES.noteHistory);
            expect(text).toMatch(/size="xl"/);
            expect(text).toMatch(/direction=\{\{ xs: "column", sm: "row" \}\}/);
        });
    });

    describe("behavior the move had to keep", () => {
        it("export cannot be dismissed while it runs", () => {
            expect(code(FRAMES.exportFolder)).toMatch(/dismissible=\{!running\}/);
        });

        it("request ownership cannot be dismissed while submitting", () => {
            expect(code(FRAMES.requestOwnership)).toMatch(/dismissible=\{!submitting\}/);
        });

        it("the ask dialogs keep their own close label", () => {
            expect(code(FRAMES.noteAsk)).toMatch(/closeLabel=\{t\.noteAsk\.modal\.close\}/);
            expect(code(FRAMES.threadAsk)).toMatch(/closeLabel=\{t\.threadAsk\.modal\.close\}/);
        });
    });
});
