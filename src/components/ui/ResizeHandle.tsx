import { PanelResizeHandle } from "react-resizable-panels";

// The one resize handle for react-resizable-panels (MIP-2606). The handle IS the
// divider: panes beside it draw no border of their own, so a pane can never leave
// a line at the page edge. Look, hover and cursor are `.gp-pane-handle` in
// index.css; the library's `data-panel-group-direction` picks the axis.
export const ResizeHandle = () => <PanelResizeHandle className="gp-pane-handle" />;
