import AssignmentIcon from "@mui/icons-material/Assignment";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import { Avatar, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { fmt, useTranslation } from "../../../i18n";
import { ProjectProps } from "../../../types/tasks";
import { ProjectLabelChips } from "../../admin/components/projectLabels/ProjectLabelChips";

/**
 * How a project identifies itself in a list: its avatar, its team-scoped
 * labels, a lock when private, and its name.
 *
 * Extracted from the task sidebar's project row so the project picker can
 * present the same thing. A dropdown that shows a bare name while the
 * sidebar three inches away shows an icon and a colored label reads as two
 * different products, and the name alone is genuinely ambiguous once a
 * team runs "Website" in two label groups.
 *
 * Presentational only — no click handling, no selection state. The caller
 * supplies the row container (a `ListItemButton` in the sidebar, an
 * Autocomplete option `<li>` in the pickers) and any emphasis.
 */

type ProjectIdentity = Pick<
    ProjectProps,
    "projectId" | "projectName" | "projectLabels" | "isPrivate" | "isExternal" | "hostTeamName"
>;

// The glyphs, split out so the row and the closed-field decorator below
// can't drift apart — restyle the lock once and both follow. Each
// negative margin tightens the glyph against its neighbours inside a
// `gap: 1` flex parent, which is what both callers lay out with.

const ProjectAvatar = ({ avatarSrc, iconColor }: { avatarSrc?: string; iconColor?: string }) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    return (
        <Avatar size="sm" src={avatarSrc} sx={{ width: 20, height: 20, flexShrink: 0 }}>
            <AssignmentIcon
                sx={{
                    fontSize: 14,
                    color: iconColor ?? (isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)"),
                }}
            />
        </Avatar>
    );
};

const PrivateMark = () => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    return (
        <LockOutlineIcon
            sx={{
                fontSize: 14,
                mx: -0.5,
                flexShrink: 0,
                color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)",
            }}
        />
    );
};

/**
 * Somebody else's project, in your list. It has to be marked: these rows
 * sit among your own, and the difference is not cosmetic — the other team
 * can end the share, and rules you take for granted in your own projects
 * are theirs to set here. An icon rather than a chip because the name's
 * truncation budget is the scarce thing in this row; the team is named on
 * hover, which is where somebody asking "whose is this?" will look.
 * `titleAccess` rather than a Joy Tooltip so the name is in the
 * accessibility tree and not only in a popper — same as the lock above.
 */
const ExternalMark = ({ hostTeamName }: { hostTeamName?: string }) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    return (
        <ShareRoundedIcon
            sx={{
                fontSize: 14,
                mx: -0.25,
                flexShrink: 0,
                color: mode === "dark" ? "#2dd4bf" : "#0d9488",
            }}
            titleAccess={
                hostTeamName
                    ? fmt(t.tasks.projects.sharedByTeam, { team: hostTeamName })
                    : t.tasks.projects.sharedByAnotherTeam
            }
        />
    );
};

type ProjectIdentityRowProps = {
    project: ProjectIdentity;
    /** Resolved via `projectAvatarSrc`. Passed in rather than derived so
     *  a list of options doesn't re-scan the chat array per row. */
    avatarSrc?: string;
    /** Cap on label chips before a `+N` pill. 1 in the narrow sidebar
     *  row; the pickers have more width. */
    maxLabels?: number;
    /** Emphasis for the current selection (the sidebar's active project).
     *  Dropdown options leave this off — Joy already marks the focused
     *  and selected option itself. */
    nameColor?: string;
    nameWeight?: number;
    iconColor?: string;
};

export const ProjectIdentityRow = (props: ProjectIdentityRowProps) => {
    const { project, avatarSrc, maxLabels = 1, nameColor, nameWeight = 500, iconColor } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    return (
        <>
            <ProjectAvatar avatarSrc={avatarSrc} iconColor={iconColor} />

            {/* Labels sit right after the avatar and before the name, so
                the eye lands on the group before the title. Capped, with
                the full list on the chip's tooltip — the name is what
                users scan for and must keep its truncation budget. */}
            <ProjectLabelChips labels={project.projectLabels ?? []} max={maxLabels} />

            {project.isPrivate === true && <PrivateMark />}

            {project.isExternal === true && <ExternalMark hostTeamName={project.hostTeamName} />}

            <Typography
                level="body-sm"
                sx={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                    minWidth: 0,
                    fontWeight: nameWeight,
                    color: nameColor ?? (isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)"),
                }}
                noWrap
            >
                {project.projectName}
            </Typography>
        </>
    );
};

type ProjectIdentityDecoratorProps = {
    /** The picker's current value. Nothing renders without one. */
    project: ProjectIdentity | null | undefined;
    avatarSrc?: string;
    /** Stand-in while the field is empty, e.g. a generic folder glyph. */
    fallback?: React.ReactNode;
};

/**
 * The same identity, for an Autocomplete's CLOSED field.
 *
 * A closed Autocomplete is a real `<input>` — you type into it to filter
 * the list — so its displayed value can only ever be the `getOptionLabel`
 * string, never the row above. (Joy has no `renderValue`; that belongs to
 * `Select`, which takes no typed input.) Left alone, the project the user
 * just picked collapses to a bare name the moment the listbox closes,
 * which is the one place they look to confirm the choice. Rendering the
 * identity as the field's `startDecorator` puts it back beside the name.
 *
 * Labels are deliberately dropped: these fields run ~220px and every
 * pixel spent here comes out of the project name.
 */
export const ProjectIdentityDecorator = ({
    project,
    avatarSrc,
    fallback,
}: ProjectIdentityDecoratorProps) => {
    if (!project) return <>{fallback}</>;
    return (
        <Stack alignItems="center" direction="row" spacing={1} sx={{ minWidth: 0 }}>
            <ProjectAvatar avatarSrc={avatarSrc} />
            {project.isPrivate === true && <PrivateMark />}
            {project.isExternal === true && <ExternalMark hostTeamName={project.hostTeamName} />}
        </Stack>
    );
};
