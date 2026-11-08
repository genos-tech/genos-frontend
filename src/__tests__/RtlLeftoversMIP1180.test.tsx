/**
 * MIP-1180: the RTL leftovers of the Arabic pass. jsdom has no bidi algorithm and does not
 * evaluate `[dir="rtl"]` selectors against a real document direction, so most of this pins
 * the markup that makes the browser do it (checked in Chromium in `ar`, see the PR); the
 * member picker's input is rendered.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MemberAutocomplete } from "../features/tasks/components/table/cellEditors";

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(resolve(srcDir, path), "utf8").replace(/\s+/g, " ");

describe("names in input values keep their reading order", () => {
    it("the table's member picker input is dir=auto", () => {
        render(
            <CssVarsProvider>
                <MemberAutocomplete
                    members={[
                        {
                            userId: "1",
                            userName: "(DY) Ken Kamiya",
                            userEmail: "k@x.dev",
                        } as never,
                    ]}
                    value={null}
                    onChange={() => {}}
                />
            </CssVarsProvider>
        );
        expect(document.querySelector("input")?.getAttribute("dir")).toBe("auto");
    });

    it("the preview's assignee / reporter picker input is dir=auto", () => {
        expect(source("features/tasks/components/autocompletes/ACTeamUsers.tsx")).toContain(
            'slotProps={{ input: { dir: "auto" } }}'
        );
    });
});

describe("the other RTL leftovers", () => {
    it("the row-expand chevron mirrors in RTL", () => {
        expect(source("features/tasks/components/table/DraggableTaskRow.tsx")).toMatch(
            /<KeyboardArrowRightRoundedIcon sx=\{\{ fontSize: 18, '\[dir="rtl"\] &': \{ transform: "scaleX\(-1\)" \} \}\} \/>/
        );
    });

    it("inbox previews isolate each paragraph's direction", () => {
        expect(source("features/inbox/components/InboxBubble.tsx")).toMatch(
            /"& \.inbox-preview p, & \.inbox-preview li": \{ unicodeBidi: "plaintext",? \}/
        );
    });

    it.each([
        "features/chat/components/headers/ThreadChatPaneHeader.tsx",
        "features/chat/components/headers/HeaderUserName.tsx",
    ])("%s: the name is an island and the (you) suffix stays outside it", (file) => {
        const text = source(file);
        expect(text).toContain('<bdi className="g-bidi-island">{dmDisplayName}</bdi>');
        expect(text).toContain('{isYou ? ` ${t.chat.sidebar.youSuffix}` : ""}');
        // No more suffix glued into the name string.
        expect(text).not.toContain("`${dmDisplayName} ${t.chat.sidebar.youSuffix}`");
    });
});
