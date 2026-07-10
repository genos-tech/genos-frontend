import { createContext, useContext } from "react";

// Stacking coordination for the task-graph dialog.
//
// ModalTaskDiagram historically sat at a fixed 9999 — above the
// BlockNote floating UI (1400) but below the UrlLinkModal (10020) so a
// canvas-node click could open a task/milestone preview ON TOP of the
// graph. That static ordering breaks the moment the graph itself is
// opened FROM a preview hosted inside the UrlLinkModal ("Open task
// graph" in the modal's task header): the graph must then stack above
// its 10020 host or it renders invisibly behind it.
//
// So the dialog now takes its z-index from its opener (host surface
// z + DIAGRAM_LIFT when hosted in a modal, DIAGRAM_DEFAULT_Z_INDEX
// otherwise) and publishes the effective value through this context so
// everything rendered inside the graph re-derives its own layer from
// it instead of hardcoding:
//   - node-card popups (status menu, date editor): z + 1
//   - canvas-node preview opens: max(URL_LINK_MODAL_DEFAULT_Z, z + DIAGRAM_LIFT)
// The defaults reproduce the historical values exactly (9999 → popups
// 10000, previews 10020), so page-hosted diagrams are unchanged.

export const DIAGRAM_DEFAULT_Z_INDEX = 9999;

// How far a layer lifts above its host surface. Also used by
// TaskFlowCanvas to push node-click previews above the graph.
export const DIAGRAM_LIFT = 15;

// UrlLinkModal's default stacking (see UrlLinkModal.tsx).
export const URL_LINK_MODAL_DEFAULT_Z = 10020;

const DiagramZIndexContext = createContext<number>(DIAGRAM_DEFAULT_Z_INDEX);

export const DiagramZIndexProvider = DiagramZIndexContext.Provider;

// eslint-disable-next-line react-refresh/only-export-components
export const useDiagramZIndex = (): number => useContext(DiagramZIndexContext);
