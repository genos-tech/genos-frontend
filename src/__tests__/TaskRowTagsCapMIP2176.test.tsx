/**
 * A task with many tags used to push its title out of its row in "Sub tasks" and
 * "Tasks in this milestone" (MIP-2176). A row now shows at most 2 tag chips (1 on a
 * phone) plus a "+N" chip that names the hidden tags.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    capRowTags,
    MAX_ROW_TAGS_DESKTOP,
    MAX_ROW_TAGS_PHONE,
} from "../features/tasks/components/contents/base/capRowTags";
import { TaskRowTags } from "../features/tasks/components/contents/base/TaskRowTags";

let isPhone = false;
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => isPhone }));

const makeTags = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ tagName: `tag${i + 1}`, tagColor: "#336699" }));

const renderTags = (n: number, onRowClick = vi.fn()) => {
    render(
        <CssVarsProvider>
            <div role="button" tabIndex={0} onClick={onRowClick}>
                <TaskRowTags tags={makeTags(n)} taskId={7} />
            </div>
        </CssVarsProvider>
    );
    return onRowClick;
};

const shownNames = () => screen.queryAllByText(/^tag\d+$/).map((el) => el.textContent);

beforeEach(() => {
    isPhone = false;
});

describe("capRowTags", () => {
    it("keeps 2 on desktop and 1 on a phone", () => {
        expect(MAX_ROW_TAGS_DESKTOP).toBe(2);
        expect(MAX_ROW_TAGS_PHONE).toBe(1);
    });

    it.each([
        [0, 0, 0, 0, 0],
        [1, 1, 0, 1, 0],
        [2, 2, 0, 1, 1],
        [3, 2, 1, 1, 2],
        [8, 2, 6, 1, 7],
    ])(
        "%i tags: desktop shows %i hides %i, phone shows %i hides %i",
        (n, dShown, dHidden, pShown, pHidden) => {
            const tags = makeTags(n);
            const desktop = capRowTags(tags, false);
            const phone = capRowTags(tags, true);
            expect([desktop.shown.length, desktop.hidden.length]).toEqual([dShown, dHidden]);
            expect([phone.shown.length, phone.hidden.length]).toEqual([pShown, pHidden]);
            // Nothing is lost or reordered.
            expect([...desktop.shown, ...desktop.hidden]).toEqual(tags);
            expect([...phone.shown, ...phone.hidden]).toEqual(tags);
        }
    );
});

describe("TaskRowTags", () => {
    it.each([
        [0, [], null],
        [1, ["tag1"], null],
        [2, ["tag1", "tag2"], null],
        [3, ["tag1", "tag2"], "+1"],
        [8, ["tag1", "tag2"], "+6"],
    ])("desktop, %i tags", (n, names, more) => {
        renderTags(n);
        expect(shownNames()).toEqual(names);
        if (more) expect(screen.getByText(more)).toBeTruthy();
        else expect(screen.queryByText(/^\+\d+$/)).toBeNull();
    });

    it.each([
        [0, [], null],
        [1, ["tag1"], null],
        [2, ["tag1"], "+1"],
        [3, ["tag1"], "+2"],
        [8, ["tag1"], "+7"],
    ])("phone, %i tags", (n, names, more) => {
        isPhone = true;
        renderTags(n);
        expect(shownNames()).toEqual(names);
        if (more) expect(screen.getByText(more)).toBeTruthy();
        else expect(screen.queryByText(/^\+\d+$/)).toBeNull();
    });

    it("gives the +N chip a keyboard-reachable button with an aria-label naming the hidden tags", () => {
        renderTags(5);
        const button = screen.getByRole("button", { name: "3 more tags: tag3, tag4, tag5" });
        expect(button.tagName).toBe("BUTTON");
        expect(button.getAttribute("tabindex")).not.toBe("-1");
    });

    it("does not open the row when +N is clicked or activated by key", () => {
        const onRowClick = renderTags(4);
        const button = screen.getByRole("button", { name: /2 more tags/ });
        fireEvent.click(button);
        expect(onRowClick).not.toHaveBeenCalled();
    });

    it("on a phone a tap lists the hidden tags", () => {
        isPhone = true;
        renderTags(3);
        expect(screen.queryByRole("tooltip")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: /2 more tags/ }));
        expect(screen.getByRole("tooltip").textContent).toBe("tag2, tag3");
    });
});
