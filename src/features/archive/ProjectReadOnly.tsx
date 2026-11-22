/**
 * Whether the project a surface shows is archived, so the surface is read-only (MIP-1933).
 *
 * The value is "archived". A surface that holds the project provides it once; the editors below
 * (inline cell editors, the preview's title, body, fields and comment composer, drag handles)
 * read it and switch themselves off, instead of letting the user try and meet the 409 toast.
 * Outside any provider the answer is `false`: nothing is read-only unless a host says so.
 */
import { type ReactNode } from "react";
import { Box } from "@mui/joy";

import { useIsProjectArchived } from "./archiveState";
import { ProjectReadOnlyContext } from "./useProjectReadOnly";

export const ProjectReadOnlyProvider = ({
    readOnly,
    children,
}: {
    readOnly: boolean;
    children: ReactNode;
}) => (
    <ProjectReadOnlyContext.Provider value={readOnly}>{children}</ProjectReadOnlyContext.Provider>
);

/**
 * Wraps a surface that edits one project's data. Read-only is decided from `projectId`, the
 * project the shown item itself belongs to, never from the project the page has selected: a task
 * opened from chat or a note sits in whatever project it sits in. When archived, the subtree is
 * `inert` (no focus, no click, no typing) and the context says so for editors that need to know.
 */
export const ProjectReadOnlyGate = ({
    projectId,
    children,
}: {
    projectId: number | null | undefined;
    children: ReactNode;
}) => {
    const readOnly = useIsProjectArchived(projectId);
    return (
        <ProjectReadOnlyProvider readOnly={readOnly}>
            <Box inert={readOnly} sx={{ display: "contents" }}>
                {children}
            </Box>
        </ProjectReadOnlyProvider>
    );
};
