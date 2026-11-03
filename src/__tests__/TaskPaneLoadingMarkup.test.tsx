/**
 * MIP-965 moves the pulsing dots + caption + delayed fade out of
 * `TaskPaneLoading` into the shared `LoadingIndicator`, so the new service
 * loader and the task loader are one look. The task loader must come out
 * IDENTICAL: same elements, same order, same styles.
 *
 * The expected markup below was captured from `TaskPaneLoading` BEFORE the
 * move. Emotion derives each `css-<hash>` class from the serialized styles
 * (keyframes names included), so an equal class name means an equal rule: any
 * change to the dots, the caption, the fade or the surface changes a hash and
 * fails here.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TaskPaneLoading } from "../features/tasks/components/contents/base/TaskPaneLoading";

const html = (props: { isDark: boolean; label: string; fadeInDelayMs?: number }) => {
    const { container, unmount } = render(
        <CssVarsProvider>
            <TaskPaneLoading {...props} />
        </CssVarsProvider>
    );
    const out = container.innerHTML;
    unmount();
    return out;
};

describe("TaskPaneLoading markup (unchanged by the LoadingIndicator extraction)", () => {
    it("default variant: whole pane slides in, dots and caption not delayed", () => {
        expect(html({ isDark: false, label: "L" })).toBe(
            '<div aria-busy="true" aria-label="L" role="status" class="MuiSheet-root MuiSheet-variantPlain MuiSheet-colorNeutral css-agj7mr-JoySheet-root"><div class="MuiBox-root css-o8qa57"></div><div class="MuiBox-root css-dtg2nl"><div class="MuiBox-root css-1wlap4s"></div><div class="MuiBox-root css-1c05keo"></div><div class="MuiBox-root css-17t0vub"></div></div><p class="MuiTypography-root MuiTypography-body-sm css-18718ga-JoyTypography-root">L</p></div>'
        );
    });

    it("switch variant (light): surface immediate, dots and caption fade in after the delay", () => {
        expect(html({ isDark: false, label: "L", fadeInDelayMs: 150 })).toBe(
            '<div aria-busy="true" aria-label="L" role="status" class="MuiSheet-root MuiSheet-variantPlain MuiSheet-colorNeutral css-dpyon1-JoySheet-root"><div class="MuiBox-root css-o8qa57"></div><div class="MuiBox-root css-2w2c6o"><div class="MuiBox-root css-1wlap4s"></div><div class="MuiBox-root css-1c05keo"></div><div class="MuiBox-root css-17t0vub"></div></div><p class="MuiTypography-root MuiTypography-body-sm css-17qfgcn-JoyTypography-root">L</p></div>'
        );
    });

    it("switch variant (dark)", () => {
        expect(html({ isDark: true, label: "L", fadeInDelayMs: 150 })).toBe(
            '<div aria-busy="true" aria-label="L" role="status" class="MuiSheet-root MuiSheet-variantPlain MuiSheet-colorNeutral css-uc0tbx-JoySheet-root"><div class="MuiBox-root css-o8qa57"></div><div class="MuiBox-root css-2w2c6o"><div class="MuiBox-root css-1wlap4s"></div><div class="MuiBox-root css-1c05keo"></div><div class="MuiBox-root css-17t0vub"></div></div><p class="MuiTypography-root MuiTypography-body-sm css-1pc4u9j-JoyTypography-root">L</p></div>'
        );
    });
});
