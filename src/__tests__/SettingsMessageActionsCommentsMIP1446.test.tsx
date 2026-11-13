/**
 * Settings -> Message actions says which pins do not apply to task comments (MIP-1446).
 *
 * The pin list is ONE list for chat messages, thread replies and task comments. A task comment has
 * no thread and its Edit is its own button, so a pinned Reply or Edit shows on a chat message and
 * on nothing in a comment. The two rows say so, in the viewer's language.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MessageActionsSection } from "../components/layout/SettingsModal";
import { PINNABLE_BUBBLE_ACTIONS } from "../hooks/common/useBubbleActionsPreference";
import { en } from "../i18n/locales/en";

afterEach(cleanup);

const renderSection = () =>
    render(
        <CssVarsProvider>
            <MessageActionsSection />
        </CssVarsProvider>
    );

const NOT_ON_COMMENTS = "Not shown on task comments.";

/** The checkbox row a label sits in. */
const rowOf = (label: RegExp) => screen.getByText(label).closest("label") as HTMLElement;

describe("Settings: Message actions on task comments", () => {
    it("says Reply and Edit are not shown on task comments", () => {
        renderSection();
        expect(rowOf(/^Reply in thread/).textContent).toContain(NOT_ON_COMMENTS);
        expect(rowOf(/^Edit/).textContent).toContain(NOT_ON_COMMENTS);
    });

    it("says it on those two rows only: every other action IS offered on a comment", () => {
        renderSection();
        expect(screen.getAllByText(NOT_ON_COMMENTS)).toHaveLength(2);
        for (const label of [
            /^Flag for later/,
            /^Remind me/,
            /^Add to To-Do/,
            /^Copy message link/,
            /^Unwrap/,
            /^Delete/,
        ]) {
            expect(rowOf(label).textContent).not.toContain(NOT_ON_COMMENTS);
        }
    });

    it("still lists every pinnable action once", () => {
        renderSection();
        expect(screen.getAllByRole("checkbox")).toHaveLength(PINNABLE_BUBBLE_ACTIONS.length);
    });

    it("keeps the flag and to-do definitions (MIP-1433)", () => {
        renderSection();
        expect(rowOf(/^Flag for later/).textContent).toContain("read again");
        expect(rowOf(/^Add to To-Do/).textContent).toContain("do something");
    });
});

describe("the line is translated in every locale", () => {
    const CODES = ["en", "ja", "zh", "es", "fr", "hi", "ar"];
    const load = async (code: string) =>
        (await import(`../i18n/locales/${code}`))[code] as typeof en;

    it.each(CODES)("%s has its own wording", async (code) => {
        const line = (await load(code)).settings.messageActions.notOnComments;
        expect(line.trim().length).toBeGreaterThan(3);
        if (code !== "en") expect(line).not.toBe(en.settings.messageActions.notOnComments);
    });
});
