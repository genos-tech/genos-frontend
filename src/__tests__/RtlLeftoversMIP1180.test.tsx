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
                    value={null}
                    members={[
                        {
                            userId: "1",
                            userName: "(DY) Ken Kamiya",
                            userEmail: "k@x.dev",
                        } as never,
                    ]}
                    onChange={() => {}}
                />
            </CssVarsProvider>
        );
        expect(document.querySelector("input")?.getAttribute("dir")).toBe("auto");
    });

    it("the preview's assignee / reporter picker input is dir=auto", () => {
        expect(source("features/tasks/components/autocompletes/ACTeamUsers.tsx")).toContain(
            'slotProps={{ input: { dir: "auto", ...pickerInputProps(field) } }}'
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
        const bubble = source("features/inbox/components/InboxBubble.tsx");
        expect(bubble).toMatch(
            /'& \[class\*="inbox-preview-"\] p, & \[class\*="inbox-preview-"\] li': \{\s*unicodeBidi: "plaintext",?\s*\}/
        );
        // The old selectors targeted a bare `.inbox-preview` class that never exists.
        expect(bubble).not.toContain('"& .inbox-preview');
    });

    it("the preview selector matches the class BnChatPreview really renders", () => {
        // BnChatPreview builds `${customClassName}-${mode}`; the selector's attribute
        // substring must be a substring of that, and of the class passed by the bubble.
        expect(source("components/editors/bnChatPreview.tsx")).toContain("${customClassName}-");
        const box = document.createElement("div");
        box.className = "inbox-preview-light";
        const p = document.createElement("p");
        box.appendChild(p);
        document.body.appendChild(box);
        expect(box.matches('[class*="inbox-preview-"]')).toBe(true);
        expect(p.closest('[class*="inbox-preview-"]')).toBe(box);
        expect(box.matches(".inbox-preview")).toBe(false);
        box.remove();
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
