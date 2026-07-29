/**
 * The velocity chart's four series colors are a fixed categorical palette.
 *
 * The bug: `updated` read `var(--gp-brandalt-400)`. On the blue theme that
 * resolved to the same blue as `created`; on amber, the same amber as
 * `started`. Two bars in one cluster wearing one color — the one thing a
 * categorical palette must never do. Series color is an identity channel,
 * so a user-selectable brand accent cannot occupy a slot in it.
 *
 * These assertions are the cheap half. The expensive half — that the four
 * hues stay distinguishable under simulated protanopia/deuteranopia — is
 * computed, not eyeballed; the commands are in the SERIES comment and the
 * measured figures are recorded there. This test exists so a future edit
 * that reintroduces a theme variable fails loudly rather than shipping a
 * chart that looks fine on whichever theme the author happened to use.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TaskVelocityChart } from "../features/tasks/components/dashboard/TaskVelocityChart";
import type { VelocityPoint } from "../features/tasks/services/loadTaskVelocity";

const point = (date: string): VelocityPoint =>
    ({ date, created: 3, started: 2, closed: 1, updated: 4 }) as VelocityPoint;

const renderChart = (isDark: boolean) =>
    render(
        // The per-bar AppTooltip reads the Joy color scheme; without the
        // provider it renders against an undefined mode and throws.
        <CssVarsProvider>
            <TaskVelocityChart
                data={[point("2026-07-01"), point("2026-07-02")]}
                granularity="day"
                isDark={isDark}
                textMuted="#888888"
                textSecondary="#666666"
            />
        </CssVarsProvider>
    );

/** Every fill actually painted on the bars, in DOM order. */
const barFills = (container: HTMLElement): string[] =>
    [...container.querySelectorAll("rect")]
        .map((r) => r.getAttribute("fill") ?? "")
        .filter((f) => f !== "");

describe("TaskVelocityChart — categorical palette", () => {
    it("paints four distinct colors per bucket, in both modes", () => {
        for (const isDark of [false, true]) {
            const { container, unmount } = renderChart(isDark);
            const fills = barFills(container);

            // 2 buckets × 4 series, and each bucket's four are distinct.
            expect(fills).toHaveLength(8);
            expect(new Set(fills.slice(0, 4)).size).toBe(4);
            unmount();
        }
    });

    it("uses no theme variable for any series", () => {
        // The regression itself: a `var(--gp-…)` fill resolves to whatever
        // the user's theme is, which is how `updated` collided with
        // `created` on blue and `started` on amber.
        for (const isDark of [false, true]) {
            const { container, unmount } = renderChart(isDark);
            for (const fill of barFills(container)) {
                expect(fill).not.toContain("var(");
                expect(fill).toMatch(/^#[0-9a-f]{6}$/i);
            }
            unmount();
        }
    });

    it("paints the validated hexes", () => {
        // Pinned so a casual "let's make it match the brand" edit has to
        // re-run the validator (commands are in the SERIES comment).
        const { container: light, unmount: unmountLight } = renderChart(false);
        expect(barFills(light).slice(0, 4)).toEqual(["#2a78d6", "#eda100", "#008300", "#e87ba4"]);
        unmountLight();

        const { container: dark } = renderChart(true);
        expect(barFills(dark).slice(0, 4)).toEqual(["#3987e5", "#c98500", "#008300", "#d55181"]);
    });
});
