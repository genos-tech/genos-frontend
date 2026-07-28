/**
 * Collapsing the note breadcrumb trail.
 *
 * A note a few folders deep produced a trail long enough to overflow the
 * header into a horizontal scrollbar — pushing the two crumbs that
 * matter (where am I, what's directly above me) off-screen, which is
 * exactly backwards.
 *
 * Collapsed shape is: root badge › show-more › parent › current.
 *
 * The subtlety worth pinning: container crumbs and note crumbs are
 * DIFFERENT component branches but must collapse as ONE sequence. Keeping
 * "the last two notes" independently of the folders would hide the
 * folder of a note only one level deep while keeping nothing useful.
 */

import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
    BreadcrumbNode,
    ContextCrumb,
    NoteBreadcrumbs,
} from "../features/notes/common/components/NoteBreadcrumbs";
import { collapseCrumbs } from "../features/notes/common/utils/collapseCrumbs";

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));

const note = (id: number, title: string): BreadcrumbNode => ({ noteId: id, title });
const ctx = (key: string, label: string): ContextCrumb => ({
    key,
    label,
    icon: <FolderRoundedIcon />,
});

const renderCrumbs = (props: Partial<React.ComponentProps<typeof NoteBreadcrumbs>> = {}) => {
    const onNodeClick = props.onNodeClick ?? vi.fn();
    render(
        <CssVarsProvider>
            <NoteBreadcrumbs
                color="primary"
                icon={<FolderRoundedIcon />}
                label="My Notes"
                noteChain={null}
                {...props}
                onNodeClick={onNodeClick}
            />
        </CssVarsProvider>
    );
    return { onNodeClick };
};

describe("collapseCrumbs", () => {
    it("keeps a short trail whole", () => {
        expect(collapseCrumbs(["a", "b"], 2)).toEqual({ hidden: [], visible: ["a", "b"] });
    });

    it("keeps the LAST crumbs, not the first", () => {
        // The root is rendered separately; the tail is what tells the
        // user where they are.
        expect(collapseCrumbs(["a", "b", "c", "d"], 2)).toEqual({
            hidden: ["a", "b"],
            visible: ["c", "d"],
        });
    });

    it("hides nothing when the trail exactly fits", () => {
        expect(collapseCrumbs(["a", "b", "c"], 3).hidden).toEqual([]);
    });

    it("handles an empty trail", () => {
        expect(collapseCrumbs([], 2)).toEqual({ hidden: [], visible: [] });
    });

    it("never hides the current item, even with a zero budget", () => {
        // A non-positive budget would otherwise leave the user with no
        // indication of where they are.
        expect(collapseCrumbs(["a", "b", "c"], 0).visible).toEqual(["c"]);
    });
});

describe("NoteBreadcrumbs collapsing", () => {
    const deepChain = [
        note(1, "Alpha"),
        note(2, "Beta"),
        note(3, "Gamma"),
        note(4, "Delta"),
        note(5, "Current"),
    ];

    it("shows only the parent and current note when deep", () => {
        renderCrumbs({ noteChain: deepChain });

        expect(screen.getByText("Delta")).toBeTruthy();
        expect(screen.getByText("Current")).toBeTruthy();
        expect(screen.queryByText("Alpha")).toBeNull();
        expect(screen.queryByText("Beta")).toBeNull();
        expect(screen.queryByText("Gamma")).toBeNull();
    });

    it("always shows the root badge", () => {
        renderCrumbs({ noteChain: deepChain });
        expect(screen.getByText("My Notes")).toBeTruthy();
    });

    it("reveals the rest when the show-more control is clicked", () => {
        renderCrumbs({ noteChain: deepChain });

        fireEvent.click(screen.getByLabelText(/hidden breadcrumbs/i));

        for (const title of ["Alpha", "Beta", "Gamma", "Delta", "Current"]) {
            expect(screen.getByText(title)).toBeTruthy();
        }
    });

    it("labels the control with how many crumbs are hidden", () => {
        renderCrumbs({ noteChain: deepChain });
        // 5 crumbs, 2 kept → 3 hidden.
        expect(screen.getByLabelText("Show 3 hidden breadcrumbs")).toBeTruthy();
    });

    it("drops the control once expanded", () => {
        renderCrumbs({ noteChain: deepChain });
        fireEvent.click(screen.getByLabelText(/hidden breadcrumbs/i));
        expect(screen.queryByLabelText(/hidden breadcrumbs/i)).toBeNull();
    });

    it("shows no control when the trail already fits", () => {
        renderCrumbs({ noteChain: [note(1, "Parent"), note(2, "Current")] });

        expect(screen.queryByLabelText(/hidden breadcrumbs/i)).toBeNull();
        expect(screen.getByText("Parent")).toBeTruthy();
        expect(screen.getByText("Current")).toBeTruthy();
    });

    it("collapses folders and notes as one sequence", () => {
        // The important case: three folders and a single note. Treating
        // the two lists separately would keep the note and drop every
        // folder, so the user would see root › Current with no sense of
        // where it lives — while the budget could have shown the folder
        // directly above it.
        renderCrumbs({
            contextCrumbs: [ctx("f1", "Documents"), ctx("f2", "Specs"), ctx("f3", "2026")],
            noteChain: [note(9, "Current")],
        });

        expect(screen.getByText("2026")).toBeTruthy();
        expect(screen.getByText("Current")).toBeTruthy();
        expect(screen.queryByText("Documents")).toBeNull();
        expect(screen.queryByText("Specs")).toBeNull();
    });

    it("still opens a note when its crumb is clicked", () => {
        const { onNodeClick } = renderCrumbs({ noteChain: deepChain });

        fireEvent.click(screen.getByText("Delta"));

        expect(onNodeClick).toHaveBeenCalledWith(4);
    });

    it("opens a crumb that was revealed by expanding", () => {
        const { onNodeClick } = renderCrumbs({ noteChain: deepChain });
        fireEvent.click(screen.getByLabelText(/hidden breadcrumbs/i));

        fireEvent.click(screen.getByText("Beta"));

        expect(onNodeClick).toHaveBeenCalledWith(2);
    });

    it("respects a custom visible tail", () => {
        renderCrumbs({ noteChain: deepChain, visibleTail: 3 });

        expect(screen.getByText("Gamma")).toBeTruthy();
        expect(screen.queryByText("Beta")).toBeNull();
    });

    it("renders nothing but the root for an empty chain", () => {
        renderCrumbs({ noteChain: [] });

        expect(screen.getByText("My Notes")).toBeTruthy();
        expect(screen.queryByLabelText(/hidden breadcrumbs/i)).toBeNull();
    });

    it("truncates long titles", () => {
        renderCrumbs({ noteChain: [note(1, "A title well past the limit")], maxTitleLength: 6 });
        expect(screen.getByText("A titl...")).toBeTruthy();
    });
});
