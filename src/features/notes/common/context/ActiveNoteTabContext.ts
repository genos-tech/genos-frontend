import { createContext, useContext } from "react";

import { isNoteOpen } from "../utils/openNote";

/** The open tab, as `isNoteOpen` takes it. */
export type ActiveNoteTab = Parameters<typeof isNoteOpen>[0];

/**
 * The open note tab for the sidebar rows (MIP-2379).
 *
 * The rows used to get it as a prop from the sidebar, so every tab change re-rendered the whole
 * sidebar body just to hand it down. Through a context only the rows that read it re-render, and
 * the body (sections, headers, folder rows) stays put. A row can still be given `activeTab` as a
 * prop, which wins (tests, other hosts).
 */
export const ActiveNoteTabContext = createContext<ActiveNoteTab>(undefined);

export const useActiveNoteTab = (): ActiveNoteTab => useContext(ActiveNoteTabContext);
