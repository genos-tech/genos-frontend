import { createContext, useContext } from "react";

/**
 * The layer the to-do pane is hosted at, when it is inside a modal (MIP-1047).
 *
 * The to-do list opens in the preview modal (Ctrl+Cmd+D, the sidebar button,
 * a to-do link), which sits at 10020 or higher. The pane's own dialogs (Scheduled
 * todos, Manage tags, Create task, Remind me) used to open at their usual
 * 1300 / 10010 and so appeared BEHIND the modal that holds them. They read
 * this to open above it. `undefined` = on the page, where their usual layer is right.
 */
const TodoHostLayerContext = createContext<number | undefined>(undefined);

export const TodoHostLayerProvider = TodoHostLayerContext.Provider;

/** The layer a dialog of the to-do pane should open at, else `fallback`. */
export const useTodoDialogLayer = (fallback?: number): number | undefined => {
    const host = useContext(TodoHostLayerContext);
    return host != null ? host + 10 : fallback;
};
