/**
 * MIP-1122: the shared StatusLabel, PriorityIcon and Tag.
 *
 * Layout and color are checked by screenshot; these pin the contracts the
 * rest of the app relies on: color lives in the ICON (words stay neutral), a
 * priority is drawn only when set, status and priority are never color alone,
 * and Tag renders with no provider at all (the table and board are Material
 * subtrees with no Joy palette, where a Joy/Material <Chip> threw).
 */

import { render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusChip } from "../features/tasks/components/autocompletes/ACTaskSelector";
import { PriorityIcon } from "../features/tasks/components/meta/PriorityIcon";
import { StatusLabel } from "../features/tasks/components/meta/StatusLabel";
import { Tag } from "../features/tasks/components/meta/Tag";
import { ProjectTagChip } from "../features/tasks/components/ProjectTagChip";
import { TaskStatusChip } from "../features/tasks/components/TaskStatusChip";
import { PRIORITY_NAMES, STATUS_NAMES } from "../features/tasks/meta/taskTone";
import { I18nProvider, loadLocale } from "../i18n";
import { ja } from "../i18n/locales/ja";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";

afterEach(() => localStorage.removeItem(LOCALE_STORAGE_KEY));

const iconWrapper = (container: HTMLElement) =>
    container.querySelector('span[aria-hidden="true"]') as HTMLElement;

describe("StatusLabel", () => {
    it.each([
        ["Open", "var(--g-info-text)"],
        ["WIP", "var(--g-warning-text)"],
        ["Blocked", "var(--g-danger-text)"],
        ["Pending", "var(--g-text-secondary)"],
        ["Closed", "var(--g-success-text)"],
        ["Deleted", "var(--g-text-tertiary)"],
    ])("%s: the ICON carries %s, the words stay neutral", (status, color) => {
        const { container, getByText } = render(<StatusLabel status={status} />);
        expect(iconWrapper(container).style.color).toBe(color);
        // The label is the neutral text color, never the status color.
        const label = getByText(status);
        expect(label.parentElement!.style.color).toBe("var(--g-text-secondary)");
    });

    it("the icon takes the status color through --Icon-color (Joy's SvgIcon ignores inherited color)", () => {
        // Found in a real browser: the wrapper was colored but every icon computed to
        // the gray `text-icon` role, because Joy's SvgIcon sets `color` itself.
        const { container } = render(<StatusLabel status="Blocked" />);
        expect(iconWrapper(container).style.getPropertyValue("--Icon-color")).toBe(
            "var(--g-danger-text)"
        );
    });

    it("every status has its own icon shape, so it is not told apart by color alone", () => {
        const shapes = STATUS_NAMES.map((s) => {
            const { container, unmount } = render(<StatusLabel status={s} />);
            const id = container.querySelector("svg")!.getAttribute("data-testid");
            unmount();
            return id;
        });
        // Open, WIP, Blocked, Pending, Closed, Deleted: six different icons.
        expect(new Set(shapes).size).toBe(STATUS_NAMES.length);
    });

    it("iconOnly drops the words and names the icon instead", () => {
        const { container, queryByText, getByRole } = render(
            <StatusLabel status="WIP" iconOnly />
        );
        expect(queryByText("WIP")).toBeNull();
        expect(getByRole("img").getAttribute("aria-label")).toBe("WIP");
        expect(iconWrapper(container).getAttribute("aria-hidden")).toBe("true");
    });

    it("an unknown or empty status renders neutrally and does not throw", () => {
        const { container } = render(<StatusLabel status="Archived" />);
        expect(iconWrapper(container).style.color).toBe("var(--g-text-secondary)");
        expect(() => render(<StatusLabel status={null} />)).not.toThrow();
    });

    it("an unknown status shows its words and a neutral dash, never an Open circle", () => {
        const { container, getByText } = render(<StatusLabel status="Review" />);
        expect(getByText("Review")).toBeTruthy();
        expect(container.querySelector("svg")!.getAttribute("data-testid")).toBe(
            "HorizontalRuleRoundedIcon"
        );
        expect(iconWrapper(container).style.color).toBe("var(--g-text-secondary)");
    });

    it("no status at all is a dash, not an icon with no words", () => {
        for (const empty of [null, undefined, "", "  "]) {
            const { container, unmount } = render(<StatusLabel status={empty} />);
            expect(container.textContent).toBe("—");
            expect(container.querySelector("svg")).toBeNull();
            unmount();
        }
    });

    it("shows the translated name, not the stored value", async () => {
        localStorage.setItem(LOCALE_STORAGE_KEY, "ja");
        await loadLocale("ja");
        const { getByText } = render(
            <I18nProvider>
                <StatusLabel status="WIP" />
            </I18nProvider>
        );
        expect(getByText(ja.tasks.filters.wip)).toBeTruthy();
    });

    it("follows the theme by variable, with no isDark and no provider", () => {
        const { container } = render(<StatusLabel status="Open" />);
        expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}|rgba?\(/i);
    });
});

describe("PriorityIcon", () => {
    it.each(["toString", "constructor", "__proto__"])(
        "%s (an inherited member) renders nothing",
        (p) => {
            const { container } = render(<PriorityIcon priority={p} />);
            expect(container.innerHTML).toBe("");
        }
    );

    it.each([undefined, null, "", "Medium", "urgent"])(
        "%s renders nothing (shown only when set)",
        (p) => {
            const { container } = render(
                <PriorityIcon priority={p as string | null | undefined} />
            );
            expect(container.innerHTML).toBe("");
        }
    );

    it.each([
        ["Minimal", "var(--g-text-tertiary)"],
        ["Low", "var(--g-text-secondary)"],
        ["Normal", "var(--g-info-text)"],
        ["High", "var(--g-warning-text)"],
        ["Critical", "var(--g-danger-text)"],
    ])("%s is named and colored %s", (priority, color) => {
        const { getByRole } = render(<PriorityIcon priority={priority} />);
        const el = getByRole("img");
        expect(el.getAttribute("aria-label")).toBe(priority);
        expect(el.style.color).toBe(color);
    });

    it("Critical's icon takes the color through --Icon-color too", () => {
        const { getByRole } = render(<PriorityIcon priority="Critical" />);
        expect(getByRole("img").style.getPropertyValue("--Icon-color")).toBe(
            "var(--g-danger-text)"
        );
    });

    it("level is in the SHAPE too: five distinct glyphs, so it is never color alone", () => {
        const shape = (p: string) => {
            const { container, unmount } = render(<PriorityIcon priority={p} />);
            const id = container.querySelector("svg")!.getAttribute("data-testid");
            unmount();
            return id;
        };
        expect(PRIORITY_NAMES.map(shape)).toEqual([
            "PriorityBars1",
            "PriorityBars2",
            "PriorityBars3",
            "PriorityBars4",
            "PriorityHighRoundedIcon",
        ]);
    });

    it("the bars fill up with the level (a glyph you can actually read, unlike a one-stroke icon)", () => {
        const opacities = (p: string) => {
            const { container, unmount } = render(<PriorityIcon priority={p} />);
            const o = Array.from(container.querySelectorAll("rect"), (r) =>
                r.getAttribute("opacity")
            );
            unmount();
            return o;
        };
        expect(opacities("Minimal")).toEqual(["1", "0.25", "0.25", "0.25"]);
        expect(opacities("Normal")).toEqual(["1", "1", "1", "0.25"]);
        expect(opacities("High")).toEqual(["1", "1", "1", "1"]);
    });

    it("showLabel puts the name beside the icon instead of on a role=img", () => {
        const { getByText, queryByRole } = render(<PriorityIcon priority="High" showLabel />);
        expect(getByText("High")).toBeTruthy();
        expect(queryByRole("img")).toBeNull();
    });
});

describe("Tag", () => {
    it("renders with no provider at all (the table and board have no Joy palette)", () => {
        expect(() => render(<Tag color="#8b5cf6" label="UI&UX" />)).not.toThrow();
    });

    it("the tag's own color is the dot; the chip and its words stay neutral", () => {
        const { container, getByText } = render(<Tag color="#8b5cf6" label="frontend" />);
        const dot = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
        expect(dot.style.background).toBe("rgb(139, 92, 246)");
        const chip = container.firstElementChild as HTMLElement;
        expect(chip.style.border).toContain("var(--g-border");
        expect(chip.style.color).toContain("var(--g-text-secondary");
        expect(getByText("frontend")).toBeTruthy();
    });

    it("a missing or empty color still draws a visible neutral dot", () => {
        for (const color of ["", undefined as unknown as string]) {
            const { container, unmount } = render(<Tag color={color} label="x" />);
            const dot = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
            expect(dot.style.background).toContain("var(--g-text-tertiary");
            unmount();
        }
    });

    it("a long label truncates instead of pushing the row wider", () => {
        const { container } = render(<Tag color="#3b82f6" label={"x".repeat(80)} />);
        const chip = container.firstElementChild as HTMLElement;
        expect(chip.style.maxWidth).toBe("100%");
        expect(chip.style.overflow).toBe("hidden");
        expect(chip.title).toBe("x".repeat(80));
    });

    it("ProjectTagChip (15 callers) is the same chip and ignores isDark", () => {
        const light = render(<ProjectTagChip isDark={false} label="bug" tagColor="#ef4444" />);
        const dark = render(<ProjectTagChip label="bug" tagColor="#ef4444" isDark />);
        expect(dark.container.innerHTML).toBe(light.container.innerHTML);
        // ...at the 0.7rem it always had: the table's tag column is narrow.
        const bare = render(<Tag color="#ef4444" fontSize="0.7rem" label="bug" />);
        expect(light.container.innerHTML).toBe(bare.container.innerHTML);
    });
});

describe("the old chips are the shared label now", () => {
    it("TaskStatusChip and the dependency StatusChip render a StatusLabel", () => {
        const a = render(<TaskStatusChip status="Blocked" />);
        const b = render(
            <StatusChip
                meta={{ code: 0, status: "Blocked", color: "#dc2626", textColor: "#fff" }}
            />
        );
        for (const r of [a, b]) {
            expect(iconWrapper(r.container).style.color).toBe("var(--g-danger-text)");
            expect(within(r.container).getByText("Blocked")).toBeTruthy();
        }
    });
});
