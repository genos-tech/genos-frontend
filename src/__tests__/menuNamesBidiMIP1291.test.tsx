/**
 * MIP-1291: names in the Chat Activity filter menus are bidi islands. In `ar`, a name that
 * starts with a bracket ("(DY) Ken Kamiya") read "Ken Kamiya (DY)", and a long Latin name lost
 * its START to the row's ellipsis, because the row's direction is rtl. `<bdi
 * className="g-bidi-island">` (App.css) fixes both, as the task, member and header names do.
 * jsdom has no bidi algorithm, so this pins the markup; the pixels were checked in Chromium
 * in `ar` at 390 (see the PR).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GMTagFilterRow } from "../features/chat/components/sidebar/GMTagFilterRow";

vi.mock("../hooks/common/usePersonalGMTags", () => ({
    usePersonalGMTags: () => ({
        tags: [
            {
                tagId: 1,
                name: "(DY) Launch",
                color: "#8e23ff",
                textColor: "#ffffff",
                isDefaultVisible: true,
                sortOrder: 1,
            },
        ],
        defaultVisibleTagIds: [1],
        updateTag: vi.fn(),
    }),
}));
vi.mock("../features/chat/components/modals/ModalManageGMTags", () => ({
    ModalManageGMTags: () => null,
}));

afterEach(cleanup);

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(resolve(srcDir, path), "utf8").replace(/\s+/g, " ");

const islandsWith = (text: string) =>
    Array.from(document.querySelectorAll("bdi.g-bidi-island")).filter(
        (el) => el.textContent === text
    );

describe("the GM tag filter", () => {
    it("shows a tag name as a bidi island in the chip row and in the Tags menu", async () => {
        render(
            <CssVarsProvider>
                <GMTagFilterRow selectedTagIds={new Set()} setSelectedTagIds={() => {}} />
            </CssVarsProvider>
        );
        // The chip row.
        expect(islandsWith("(DY) Launch")).toHaveLength(1);
        // The menu lists every tag again.
        await userEvent.click(screen.getByRole("button", { name: "Tags" }));
        await waitFor(() => expect(islandsWith("(DY) Launch")).toHaveLength(2));
    });
});

describe("the Activity By name / By group menus", () => {
    const file = "features/chat/components/sidebar/ChatSidebarDividers.tsx";

    it("show a chat's name as an island inside the truncating box", () => {
        expect(source(file)).toMatch(
            /<bdi className="g-bidi-island"> \{resolveChatDisplayName\(chat\)/
        );
    });

    it("show a mention group's name as an island", () => {
        expect(source(file)).toContain('<bdi className="g-bidi-island">{group.groupName}</bdi>');
    });
});
