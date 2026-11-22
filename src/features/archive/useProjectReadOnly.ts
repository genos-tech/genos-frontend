import { createContext, useContext } from "react";

/** See ProjectReadOnly.tsx. Outside any provider nothing is read-only. */
export const ProjectReadOnlyContext = createContext<boolean>(false);

/** True when the surrounding project is archived (MIP-1933). */
export const useProjectReadOnly = (): boolean => useContext(ProjectReadOnlyContext);
