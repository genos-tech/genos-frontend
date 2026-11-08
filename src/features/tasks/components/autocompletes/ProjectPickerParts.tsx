// The pieces of a project dropdown that every project picker in the app shares.
//
// The Genos search filter (`SpotlightProjectFilter`, multi-select) and the
// schedule form's project parameter (`ScheduleParamPickers`, single choice) are
// different controls, but a project must look like itself in both: the same
// option row (avatar, label chips, lock / share marks, name), the same list
// height and row density, and the same rules for matching a typed word and for
// telling two options apart. They live here once so the two cannot drift.

import type { HTMLAttributes } from "react";
import { AutocompleteOption } from "@mui/joy";

import { ProjectIdentityRow, type ProjectIdentity } from "../ProjectIdentityRow";

/** The text type-to-filter matches on and the closed field shows. */
export const projectOptionLabel = (option: Pick<ProjectIdentity, "projectName">): string =>
    option.projectName;

/** Options are told apart by id, never by object: the project list is refetched
 *  (rename, label change, join) and a stale captured object must still match. */
export const isSameProject = (
    option: Pick<ProjectIdentity, "projectId">,
    value: Pick<ProjectIdentity, "projectId">
): boolean => option.projectId === value.projectId;

/**
 * One option row. Joy's own `AutocompleteOption` (not a bare `<li>`) brings the
 * padding, hover, focus and selected states; `ProjectIdentityRow` is the row the
 * task pickers and the task sidebar render. `projectAvatars` is the id -> url map
 * (`projectAvatarSrcMap`): a project missing from it gets the generic project icon.
 */
export const renderProjectOption =
    <T extends ProjectIdentity>(projectAvatars?: Map<number, string>) =>
    (optionProps: Omit<HTMLAttributes<HTMLLIElement>, "color">, option: T) => (
        <AutocompleteOption
            {...optionProps}
            key={option.projectId}
            sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
        >
            <ProjectIdentityRow
                avatarSrc={projectAvatars?.get(option.projectId)}
                maxLabels={2}
                project={option}
            />
        </AutocompleteOption>
    );

/** The dropdown list itself: a bounded height and the compact row density. The
 *  listbox is portaled to <body>, so each host gives the z-index that clears the
 *  surface it lives in (the Spotlight sheet, a Joy dialog). */
export const projectListboxSlotProps = (zIndex: number) => ({
    listbox: {
        sx: {
            zIndex,
            maxHeight: 280,
            "--ListItem-minHeight": "32px",
        },
    },
});
