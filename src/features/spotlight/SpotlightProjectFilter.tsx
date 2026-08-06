// Project scope picker for the Spotlight filter row.
//
// Sits beside the service chips but is a different KIND of control on
// purpose: services are a fixed five-item vocabulary (toggles), while
// projects are a per-team list that can run to dozens — so this is a
// multi-select dropdown with type-to-filter, not more chips.
//
// The option row is `ProjectIdentityRow`, the same component the task
// pickers (`ACTeamProjects`) and the task sidebar render, so a project
// looks like itself everywhere: avatar, labels, then the name. Avatars
// live on a project's PM chat, which this overlay can't reach (it mounts
// outside the chat provider tree), so they arrive pre-resolved in
// `projectAvatars` — threaded from App like `projects` itself. A project
// missing from that map falls back to the generic project icon, the
// documented `avatarSrc`-absent path in `ProjectIdentityRow`.

import { Autocomplete, AutocompleteOption, Box, Chip, Typography } from "@mui/joy";

import { ProjectProps } from "../../types/tasks";
import { ProjectIdentityRow } from "../tasks/components/ProjectIdentityRow";

// The listbox is portaled to <body>, so it needs to clear the Spotlight
// sheet (13100) or it renders behind the surface that owns it. Same
// value as the `@`/`#` mention dropdown inside this overlay, which
// solved the identical problem — keep the two in step.
const LISTBOX_Z_INDEX = 14000;

type SpotlightProjectFilterProps = {
    /** The team's projects, threaded from App (this overlay mounts
     *  outside the project provider tree). */
    projects: ProjectProps[];
    /** Currently scoped project ids. Empty = every project. */
    selectedIds: number[];
    /** Project id → avatar url, from `projectAvatarSrcMap`. Absent ids
     *  fall back to the generic project icon. */
    projectAvatars?: Map<number, string>;
    onChange: (projectIds: number[]) => void;
    isDark: boolean;
    placeholder: string;
    ariaLabel: string;
};

export const SpotlightProjectFilter = ({
    projects,
    selectedIds,
    projectAvatars,
    onChange,
    isDark,
    placeholder,
    ariaLabel,
}: SpotlightProjectFilterProps) => {
    // Derive the Autocomplete's value from the id list rather than
    // storing project objects in the hook: `teamProjects` is refetched
    // (rename, label change, join), and a stale captured object would
    // both render old text and fail `isOptionEqualToValue`, which makes
    // Joy warn and drop the selection.
    const selected = projects.filter((p) => selectedIds.includes(p.projectId));

    return (
        <Autocomplete
            aria-label={ariaLabel}
            getOptionLabel={(option) => option.projectName}
            isOptionEqualToValue={(option, value) => option.projectId === value.projectId}
            // One tag inline, the rest collapse to "+N" — the filter row
            // must stay one line tall no matter how many projects are
            // scoped, or it pushes the results list down as you pick.
            limitTags={1}
            options={projects}
            placeholder={selected.length === 0 ? placeholder : ""}
            size="sm"
            value={selected}
            renderOption={(optionProps, option) => (
                // Joy's own option component (not a bare <li>) brings the
                // padding, hover, focus and selected states — the same
                // reasoning as ACTeamProjects.
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
            )}
            renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                    <Chip
                        {...getTagProps({ index })}
                        key={option.projectId}
                        size="sm"
                        variant="soft"
                        sx={{
                            borderRadius: "5px",
                            fontWeight: 600,
                            maxWidth: 130,
                            "& .MuiChip-label": {
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            },
                        }}
                    >
                        {option.projectName}
                    </Chip>
                ))
            }
            slotProps={{
                listbox: {
                    sx: {
                        zIndex: LISTBOX_Z_INDEX,
                        maxHeight: 280,
                        "--ListItem-minHeight": "32px",
                    },
                },
            }}
            sx={{
                // Mobile: take the whole width so the picker wraps onto a
                // deliberate line of its own BELOW the service chips,
                // rather than squeezing in beside them and forcing a
                // ragged two- or three-line row at 390px. The filter row
                // is `flexWrap: wrap`, so `width: 100%` is all it takes.
                // `minWidth: 0` keeps it from overflowing the sheet's
                // `px: 1` gutter.
                width: { xs: "100%", sm: "auto" },
                minWidth: { xs: 0, sm: 150 },
                // Bounded on desktop so a long project name can't crowd
                // out the service chips it shares the row with.
                maxWidth: { xs: "100%", sm: 260 },
                flexShrink: 1,
                "--Chip-minHeight": "20px",
                fontSize: "0.8125rem",
                // Soft/outlined surfaces disappear against the
                // translucent purple sheet — same explicit treatment the
                // inactive service chips carry, for the same reason.
                ...(isDark
                    ? {
                          backgroundColor: "rgba(255,255,255,0.07)",
                          borderColor: "rgba(255,255,255,0.16)",
                          color: "#f1e8ff",
                          "&:hover": { backgroundColor: "rgba(255,255,255,0.11)" },
                      }
                    : {}),
            }}
            // Joy types the multi-select handler's value as readonly;
            // map straight to ids so the hook never holds project objects.
            multiple
            onChange={(_e, value) => onChange(value.map((p) => p.projectId))}
        />
    );
};

// Compact "N projects" read-out for the filter row. Rendered next to the
// picker so the active scope stays legible once the tags collapse to
// "+N", and clickable to clear the whole selection — otherwise removing
// several scoped projects means popping tags one at a time.
export const SpotlightProjectFilterSummary = ({
    count,
    isDark,
    label,
    clearLabel,
    onClear,
}: {
    count: number;
    isDark: boolean;
    label: string;
    clearLabel: string;
    onClear: () => void;
}) => {
    if (count === 0) return null;
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
            <Typography
                level="body-xs"
                sx={{
                    whiteSpace: "nowrap",
                    color: isDark ? "#cebfeb" : undefined,
                    opacity: isDark ? 1 : 0.6,
                }}
            >
                {label}
            </Typography>
            <Chip
                color="neutral"
                size="sm"
                variant="soft"
                sx={{
                    "--Chip-minHeight": "22px",
                    fontWeight: 600,
                    fontSize: "0.7rem",
                    ...(isDark
                        ? { color: "#cebfeb", backgroundColor: "rgba(255,255,255,0.07)" }
                        : {}),
                }}
                onClick={onClear}
            >
                {clearLabel}
            </Chip>
        </Box>
    );
};
