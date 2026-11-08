/**
 * MIP-1126, the last four: the saved-filter dialogs, the column settings, the tag manager and
 * the "no access to this note" card are ModalFrame / ConfirmDialog dialogs, and the tag manager
 * (a dark-only gradient card before) takes its colours from tokens so it reads in light mode.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("the last hand-built dialogs", () => {
    it("saved filters: the name form is a ModalFrame, delete is the shared ConfirmDialog", () => {
        const text = read("features/tasks/components/table/SavedFiltersMenu.tsx");
        expect(text).toMatch(/<ModalFrame[\s\S]*dismissible=\{!isSubmitting\}/);
        expect(text).toMatch(/<ConfirmDialog[\s\S]*destructive/);
    });

    it("column settings: a ModalFrame at Joy's layer, so the dragged row (1500) out-stacks it", () => {
        const text = read("features/tasks/components/table/TaskTableColumnSettings.tsx");
        expect(text).toMatch(/<ModalFrame/);
        expect(text).toMatch(/zIndex=\{1300\}/);
        expect(text).toMatch(/zIndex: 1500/);
    });

    it("tag manager: ModalFrame, the shared tag chip, and no literal colours", () => {
        const text = read("features/tasks/components/modals/ModalManageTags.tsx");
        expect(text).toMatch(/<ModalFrame/);
        expect(text).toMatch(/<ProjectTagChip/);
        expect(text).not.toMatch(/rgba\(|#[0-9a-fA-F]{3,8}\b(?!")/);
        expect(text).not.toMatch(/linear-gradient|isDark/);
    });

    it("access request: the panel sits in a ModalFrame titled by the note's privacy", () => {
        const text = read("features/chat/components/sidebar/activity/chatListItemForActivity.tsx");
        expect(text).toMatch(/<ModalFrame[\s\S]*t\.notes\.accessRequest\.privateBadge/);
    });
});
