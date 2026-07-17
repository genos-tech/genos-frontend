/**
 * Write-side units for team custom emoji: the picker-string → inline
 * node resolver, the `:` suggestion merge (custom first), the picker
 * flattener that turns a custom selection into ":name:", and the
 * Settings panel's uploader-only delete rule.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { insertEmojiValue } from "../components/editors/CustomEmoji";
import { getEmojiSuggestionItems } from "../components/editors/EmojiSuggestion";
import { TeamEmojiPanel } from "../components/layout/TeamEmojiPanel";
import { EmojiPicker } from "../components/ui/emoji/EmojiPicker";
import { TeamEmojiProvider } from "../context/TeamEmojiContext";
import { TeamEmojiApi } from "../hooks/common/useTeamEmoji";
import { TeamEmoji } from "../services/teamEmojiApi";
import { setTeamEmojiList } from "../services/teamEmojiStore";
import type { UserProps } from "../types/admin";

// Deterministic SearchIndex so the suggestion tests don't depend on
// emoji-mart's real fuzzy matcher (EmojiSuggestion calls init() at
// module load — stub that too).
vi.mock("emoji-mart", () => ({
    init: vi.fn(),
    SearchIndex: {
        search: vi.fn(() =>
            Promise.resolve([
                { id: "tada", name: "Party Popper", skins: [{ native: "🎉" }] },
                { id: "no-native" }, // filtered out (custom merged into global data)
            ])
        ),
    },
}));

const partyBlob: TeamEmoji = {
    emojiId: 1,
    name: "party-blob",
    url: "https://api.example.com/media/team_emoji/t1/u1-party-blob.gif",
    createdBy: "u1",
    tsCreatedAt: "2026-07-18T00:00:00Z",
};

afterEach(() => {
    setTeamEmojiList([]);
    vi.restoreAllMocks();
});

const mockEditor = () => ({ insertInlineContent: vi.fn() });

describe("insertEmojiValue", () => {
    it("turns a known :shortcode: into a customEmoji inline node + space", () => {
        setTeamEmojiList([partyBlob]);
        const editor = mockEditor();
        insertEmojiValue(editor, ":party-blob:");
        expect(editor.insertInlineContent).toHaveBeenCalledWith([
            { type: "customEmoji", props: { name: "party-blob", url: partyBlob.url } },
            " ",
        ]);
    });

    it("inserts unicode selections as plain text", () => {
        const editor = mockEditor();
        insertEmojiValue(editor, "🎉");
        expect(editor.insertInlineContent).toHaveBeenCalledWith([
            { type: "text", text: "🎉", styles: {} },
        ]);
    });

    it("falls back to plain text for unknown shortcodes", () => {
        const editor = mockEditor();
        insertEmojiValue(editor, ":ghost:");
        expect(editor.insertInlineContent).toHaveBeenCalledWith([
            { type: "text", text: ":ghost:", styles: {} },
        ]);
    });
});

describe("getEmojiSuggestionItems", () => {
    it("lists matching team emoji ahead of unicode results and inserts the inline node", async () => {
        setTeamEmojiList([partyBlob]);
        const editor = mockEditor();
        const items = await getEmojiSuggestionItems(editor, "party");

        expect(items[0].title).toBe("party-blob");
        expect(items[0].subtext).toBe(":party-blob:");
        expect(items.some((i) => i.title === "Party Popper")).toBe(true);
        expect(items.length).toBeLessThanOrEqual(12);

        items[0].onItemClick?.();
        expect(editor.insertInlineContent).toHaveBeenCalledWith([
            { type: "customEmoji", props: { name: "party-blob", url: partyBlob.url } },
            " ",
        ]);
    });

    it("returns only unicode results when no team emoji matches", async () => {
        setTeamEmojiList([partyBlob]);
        const items = await getEmojiSuggestionItems(mockEditor(), "zzz");
        expect(items.every((i) => i.title !== "party-blob")).toBe(true);
    });
});

describe("EmojiPicker selection flattener", () => {
    it("flattens a custom selection (no native) to its :shortcode: string", async () => {
        // Replace the lazy-loaded Picker with a button that reports a
        // custom-emoji selection shape (id + src, no native).
        vi.doMock("../components/ui/emoji/EmojiPickerInner", () => ({
            default: ({
                onEmojiSelect,
            }: {
                onEmojiSelect: (e: { id: string; src: string }) => void;
            }) => (
                <button
                    data-testid="fake-picker-custom"
                    onClick={() => onEmojiSelect({ id: "party-blob", src: partyBlob.url })}
                >
                    pick
                </button>
            ),
        }));

        const setSelectedEmoji = vi.fn();
        render(
            <CssVarsProvider>
                <EmojiPicker
                    setSelectedEmoji={setSelectedEmoji}
                    setShowEmojiPicker={vi.fn()}
                    showEmojiPicker
                />
            </CssVarsProvider>
        );

        fireEvent.click(await screen.findByTestId("fake-picker-custom"));
        await waitFor(() => expect(setSelectedEmoji).toHaveBeenCalledWith(":party-blob:"));
        vi.doUnmock("../components/ui/emoji/EmojiPickerInner");
    });
});

describe("TeamEmojiPanel", () => {
    const me = { userId: "u1", userName: "Me" } as UserProps;
    const renderPanel = (api: Partial<TeamEmojiApi>) =>
        render(
            <CssVarsProvider>
                <TeamEmojiProvider
                    value={{
                        teamEmoji: [],
                        loading: false,
                        refresh: async () => {},
                        create: async () => null,
                        remove: async () => true,
                        ...api,
                    }}
                >
                    <TeamEmojiPanel
                        myself={me}
                        teamMemberProfiles={{
                            u1: me,
                            u2: { userId: "u2", userName: "Other" } as UserProps,
                        }}
                    />
                </TeamEmojiProvider>
            </CssVarsProvider>
        );

    it("shows the delete button only on my own uploads and calls remove", () => {
        const remove = vi.fn(() => Promise.resolve(true));
        renderPanel({
            teamEmoji: [
                partyBlob, // createdBy u1 = mine
                { ...partyBlob, emojiId: 2, name: "other-blob", createdBy: "u2" },
            ],
            remove,
        });

        expect(screen.getByTestId("delete-team-emoji-party-blob")).toBeInTheDocument();
        expect(screen.queryByTestId("delete-team-emoji-other-blob")).toBeNull();

        fireEvent.click(screen.getByTestId("delete-team-emoji-party-blob"));
        expect(remove).toHaveBeenCalledWith(1);
    });
});
