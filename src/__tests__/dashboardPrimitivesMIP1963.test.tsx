/**
 * Shared dashboard primitives (MIP-1963 PR 1): states, a11y labels, number / date formatting,
 * the chart palette tokens, and "no literals" for the new files.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
    DashboardCard,
    formatRelativeTime,
    makeNumberFormat,
    MeterRow,
    ProportionBar,
    SegmentedChips,
    StatStrip,
    StatTile,
} from "../components/ui/dashboard";
import { EFFORT_NAMES, EFFORT_TONE } from "../features/tasks/meta/taskTone";
import { g } from "../theme/tokens";
import { buildTokenStylesheet, CHART_SERIES } from "../theme/tokens/tokenStyles";

const wrap = (ui: React.ReactNode) => render(<CssVarsProvider>{ui}</CssVarsProvider>);

describe("DashboardCard", () => {
    it("renders the title as a heading and the ready children", () => {
        wrap(
            <DashboardCard count="3" title="Needs you">
                <p>body</p>
            </DashboardCard>
        );
        expect(screen.getByRole("heading", { name: "Needs you" })).toBeTruthy();
        expect(screen.getByText("body")).toBeTruthy();
    });

    it("loading shows a skeleton, never the children", () => {
        wrap(
            <DashboardCard state="loading" title="T">
                <p>body</p>
            </DashboardCard>
        );
        expect(screen.queryByText("body")).toBeNull();
        expect(document.querySelector('[data-skeleton="lines"]')).toBeTruthy();
    });

    it("error shows Retry that calls back", () => {
        const onRetry = vi.fn();
        wrap(
            <DashboardCard errorTitle="Couldn't load" state="error" title="T" onRetry={onRetry} />
        );
        fireEvent.click(screen.getByRole("button"));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("error without onRetry still shows the error state, not the children", () => {
        wrap(
            <DashboardCard errorTitle="Couldn't load" state="error" title="T">
                <p>stale</p>
            </DashboardCard>
        );
        expect(screen.queryByText("stale")).toBeNull();
        expect(screen.getByText("Couldn't load")).toBeTruthy();
    });

    it("help text is exposed through aria-describedby", () => {
        wrap(<DashboardCard help="Counted across projects" helpLabel="More info" title="T" />);
        const b = screen.getByRole("button", { name: "More info" });
        const id = b.getAttribute("aria-describedby")!;
        expect(document.getElementById(id)?.textContent).toBe("Counted across projects");
    });

    it("empty says what is empty and the action runs", () => {
        const onClick = vi.fn();
        wrap(
            <DashboardCard
                emptyAction={{ label: "Add", onClick }}
                emptyBody="Add one."
                emptyTitle="Nothing yet"
                state="empty"
                title="T"
            />
        );
        expect(screen.getByText("Nothing yet")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Add" }));
        expect(onClick).toHaveBeenCalled();
    });
});

describe("StatTile", () => {
    it("is a plain block without onClick and a pressed button with it", () => {
        const onClick = vi.fn();
        wrap(
            <StatStrip>
                <StatTile label="Plain" value="3" />
                <StatTile
                    label="Filter"
                    raw={2}
                    tone="danger"
                    value="2"
                    pressed
                    onClick={onClick}
                />
            </StatStrip>
        );
        const b = screen.getByRole("button", { name: /Filter/ });
        expect(b.getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(b);
        expect(onClick).toHaveBeenCalled();
        expect(screen.getAllByRole("button")).toHaveLength(1);
    });
});

describe("ProportionBar", () => {
    const segs = [
        { key: "open", label: "Open", value: 3, tone: "info" as const },
        { key: "wip", label: "WIP", value: 0, tone: "warning" as const },
    ];
    it("reads the counts and keeps a zero legend item (greyed, not hidden)", () => {
        wrap(<ProportionBar ariaLabel="Open 3, WIP 0" segments={segs} />);
        expect(screen.getByRole("img", { name: "Open 3, WIP 0" })).toBeTruthy();
        const zero = document.querySelector('[data-zero="true"]');
        expect(zero?.textContent).toContain("WIP");
        expect(document.querySelectorAll("[data-segment]")).toHaveLength(1);
    });
    it("keeps a share-scale spacer so a bar below `total` does not fill the track", () => {
        wrap(<ProportionBar ariaLabel="x" segments={segs} total={10} />);
        const seg = document.querySelector<HTMLElement>("[data-segment]")!;
        expect(seg.nextElementSibling?.getAttribute("aria-hidden")).toBe("true");
    });
    it("draws no segment when everything is zero", () => {
        wrap(<ProportionBar ariaLabel="none" segments={segs.map((s) => ({ ...s, value: 0 }))} />);
        expect(document.querySelectorAll("[data-segment]")).toHaveLength(0);
    });
});

describe("SegmentedChips", () => {
    const Harness = () => {
        const [v, setV] = useState("day");
        return (
            <SegmentedChips
                ariaLabel="Range"
                value={v}
                options={[
                    { value: "day", label: "Day" },
                    { value: "week", label: "Week" },
                ]}
                onChange={setV}
            />
        );
    };
    it("a click selects the chip (Joy ignores an onClick set on the action slot)", () => {
        wrap(<Harness />);
        fireEvent.click(screen.getByRole("radio", { name: "Week" }));
        expect(screen.getByRole("radio", { name: "Week" }).getAttribute("aria-checked")).toBe(
            "true"
        );
    });
    it("is a radio group with roving tabindex and arrow keys", () => {
        wrap(<Harness />);
        expect(screen.getByRole("radiogroup", { name: "Range" })).toBeTruthy();
        const day = screen.getByRole("radio", { name: "Day" });
        expect(day.getAttribute("aria-checked")).toBe("true");
        expect(day.tabIndex).toBe(0);
        fireEvent.keyDown(day, { key: "ArrowRight" });
        const week = screen.getByRole("radio", { name: "Week" });
        expect(week.getAttribute("aria-checked")).toBe("true");
        expect(week.tabIndex).toBe(0);
        expect(screen.getByRole("radio", { name: "Day" }).tabIndex).toBe(-1);
    });
});

describe("MeterRow", () => {
    it("shows name and value", () => {
        wrap(
            <MeterRow
                ariaLabel="Sam 7"
                avatar={<span />}
                name="Sam Taylor"
                segments={[{ key: "a", label: "A", value: 7, tone: "info" }]}
                total={10}
                value="7"
            />
        );
        expect(screen.getByText("Sam Taylor")).toBeTruthy();
        expect(screen.getByText("7")).toBeTruthy();
    });
});

describe("formatting", () => {
    it("numbers and percents follow the locale", () => {
        expect(makeNumberFormat("en").number(1234)).toBe("1,234");
        expect(makeNumberFormat("es").number(12345)).toBe("12.345");
        expect(makeNumberFormat("en").percent(0.42)).toBe("42%");
    });
    it("relative time uses Intl in the app language", () => {
        const now = Date.UTC(2026, 10, 22);
        const twoDays = now - 2 * 86_400_000;
        expect(formatRelativeTime(twoDays, "en", now)).toBe("2 days ago");
        expect(formatRelativeTime(twoDays, "ja", now)).toBe("一昨日");
        expect(formatRelativeTime(now - 86_400_000, "en", now)).toBe("yesterday");
        expect(formatRelativeTime(null, "en", now)).toBe("");
    });
});

describe("tokens", () => {
    it("chart series are defined in both modes and referenced by g.chart", () => {
        const css = buildTokenStylesheet();
        for (const mode of ["light", "dark"] as const) {
            const sel = `[data-g-theme="purple"][data-g-mode="${mode}"]`;
            const start = css.indexOf(sel);
            const body = css.slice(start, css.indexOf("}", start));
            CHART_SERIES[mode].forEach((c, i) =>
                expect(body).toContain(`--g-chart-${i + 1}: ${c}`)
            );
        }
        expect(g.chart.series1).toBe("var(--g-chart-1)");
    });
    it("every effort level has a tone", () => {
        for (const e of EFFORT_NAMES) expect(EFFORT_TONE[e]).toBeTruthy();
    });
});

describe("no literals in the new primitives", () => {
    const dir = join(__dirname, "../components/ui/dashboard");
    const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f));
    it.each(files)("%s has no hex, rgba, gradient, isDark or weight 700", (f) => {
        const src = readFileSync(join(dir, f), "utf8");
        expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(src).not.toMatch(/rgba?\(/);
        expect(src).not.toMatch(/gradient\(/);
        expect(src).not.toMatch(/isDark/);
        expect(src).not.toMatch(/fontWeight:\s*700/);
    });
});
