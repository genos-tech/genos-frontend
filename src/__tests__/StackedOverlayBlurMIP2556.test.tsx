/**
 * MIP-2556: a modal stacked on another was laggy because both layers blurred the whole screen.
 * Only the top layer keeps its blur.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ModalFrame } from "../components/ui/modal/ModalFrame";
import { useCoveredOverlay } from "../components/ui/modal/overlayStack";

const Layer = ({ name, open = true, z }: { name: string; open?: boolean; z: number }) => {
    const covered = useCoveredOverlay(open, z);
    return <div data-testid={name}>{covered ? "covered" : "top"}</div>;
};

describe("useCoveredOverlay", () => {
    it("covers the lower z-index, whatever the opening order", () => {
        const view = render(
            <>
                <Layer name="preview" z={13200} />
                <Layer name="spotlight" z={13100} />
            </>
        );
        expect(view.getByTestId("preview").textContent).toBe("top");
        expect(view.getByTestId("spotlight").textContent).toBe("covered");
    });

    it("gives the lower layer back when the upper one closes", () => {
        const view = render(
            <>
                <Layer name="under" z={13100} />
                <Layer name="over" z={13200} />
            </>
        );
        expect(view.getByTestId("under").textContent).toBe("covered");
        view.rerender(
            <>
                <Layer name="under" z={13100} />
                <Layer name="over" open={false} z={13200} />
            </>
        );
        expect(view.getByTestId("under").textContent).toBe("top");
    });

    it("breaks a tie by opening order, and ignores closed layers", () => {
        const view = render(<Layer name="first" z={1300} />);
        view.rerender(
            <>
                <Layer name="first" z={1300} />
                <Layer name="second" z={1300} />
                <Layer name="closed" open={false} z={20000} />
            </>
        );
        expect(view.getByTestId("first").textContent).toBe("covered");
        expect(view.getByTestId("second").textContent).toBe("top");
        expect(view.getByTestId("closed").textContent).toBe("top");
    });

    it("keeps the opening order when an open layer changes its z-index", () => {
        const pair = (z: number) => (
            <>
                <Layer name="first" z={z} />
                <Layer name="second" z={10020} />
            </>
        );
        const view = render(pair(13200));
        expect(view.getByTestId("second").textContent).toBe("covered");
        view.rerender(pair(10020));
        expect(view.getByTestId("first").textContent).toBe("covered");
        expect(view.getByTestId("second").textContent).toBe("top");
    });

    it("marks the covered dialog of two stacked ModalFrames", () => {
        render(
            <>
                <ModalFrame title="Under" open onClose={() => {}}>
                    a
                </ModalFrame>
                <ModalFrame title="Over" zIndex={20000} open onClose={() => {}}>
                    b
                </ModalFrame>
            </>
        );
        const covered = document.querySelectorAll(".MuiModal-root[data-covered]");
        expect(covered).toHaveLength(1);
        expect(covered[0].textContent).toContain("Under");
    });
});
