/**
 * MIP-2307: a reader of a skill (not its owner or a co-editor) sees the skill's tags read-only.
 * The tag catalog is owner-only on the API (403/404 for a reader), so a disabled Tags field must
 * not request it and must not show "Couldn't load the tag list.".
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as api from "../features/genos/skills/skillsApi";
import { SkillTagsField } from "../features/genos/skills/SkillTagsField";
import { I18nProvider } from "../i18n";

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

vi.mock("../features/genos/skills/skillsApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../features/genos/skills/skillsApi")>();
    return { ...actual, fetchSkillTags: vi.fn().mockResolvedValue({ ok: false, status: 403 }) };
});

afterEach(cleanup);

describe("the Tags field for a reader", () => {
    it("shows the tags read-only, asks for no catalog and shows no error", async () => {
        render(
            <CssVarsProvider>
                <I18nProvider>
                    <SkillTagsField
                        selected={["weekly", "ops"]}
                        skillId="s1"
                        teamId="team-1"
                        disabled
                        onChange={vi.fn()}
                    />
                </I18nProvider>
            </CssVarsProvider>
        );
        expect(screen.getByText("weekly")).toBeTruthy();
        expect(screen.getByText("ops")).toBeTruthy();
        expect(screen.queryByText("Couldn't load the tag list.")).toBeNull();
        expect(screen.queryByRole("button", { name: "Add a tag" })).toBeNull();
        expect(screen.queryByRole("button", { name: /Remove tag/ })).toBeNull();
        expect(api.fetchSkillTags).not.toHaveBeenCalled();
    });
});
