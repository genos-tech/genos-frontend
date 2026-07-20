import { lazy, Suspense } from "react";

import type { ModalTaskDiagramProps } from "./ModalTaskDiagram";

// Code-split boundary for the task diagram.
//
// ModalTaskDiagram pulls @xyflow/react, @xyflow/system, @dagrejs/dagre
// and the d3 modules xyflow depends on — the single heaviest dependency
// tree in the task feature. It was statically imported from App.tsx (and
// from four task surfaces), which put all of it in the entry chunk, so
// every page load paid for a modal most sessions never open.
//
// The type import above is `import type` ON PURPOSE: a value import here
// would recreate the static edge this file exists to break.
//
// Rendering nothing while closed is not a behavior change. ModalTaskDiagram
// already gates its canvas on `{open && <TaskFlowCanvas/>}`, and its two
// pieces of state are documented as deliberately non-persisted ("the
// initial state each time the diagram opens, not a saved preference") —
// so unmounting between opens preserves the intended reset. It also means
// the chunk is not fetched until a diagram is actually opened.
const ModalTaskDiagram = lazy(() =>
    import("./ModalTaskDiagram").then((m) => ({ default: m.ModalTaskDiagram }))
);

export const LazyTaskDiagram = (props: ModalTaskDiagramProps) => {
    if (!props.open) return null;
    // No fallback: the opener stays interactive and the modal appears when
    // the chunk lands. A spinner-in-a-modal would flash on every warm open
    // (the chunk is cached after the first), which reads worse than the
    // brief nothing on the one cold open.
    return (
        <Suspense fallback={null}>
            <ModalTaskDiagram {...props} />
        </Suspense>
    );
};
