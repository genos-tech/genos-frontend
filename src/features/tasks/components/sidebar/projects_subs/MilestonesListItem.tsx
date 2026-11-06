import { memo, ReactNode, useEffect, useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import DirectionsRunRoundedIcon from "@mui/icons-material/DirectionsRunRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import {
    Avatar,
    AvatarGroup,
    Box,
    Chip,
    List,
    ListItem,
    ListItemContent,
    Stack,
    Typography,
} from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";

import { AvatarWithStatus } from "../../../../../components/ui/avatars/avatarWithStatus";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { Milestone, MilestoneFolder } from "../../../sprint-milestone/types";
import { groupMilestonesByFolder } from "../../../sprint-milestone/utils/groupMilestonesByFolder";
import {
    getMilestoneStatusChipColor,
    groupMilestonesByYearAndSprint,
    selectSidebarLiveMilestones,
    selectSidebarPastMilestones,
} from "../../../sprint-milestone/utils/sortMilestones";
import { taskMetaLabel } from "../../../utils/taskMeta";
import { openMilestoneFromSidebar } from "../openMilestone";
import type {
    SidebarTreePM,
    SidebarTreeSM,
    SidebarTreeTEM,
    SidebarTreeTM,
} from "../useSidebarSlices";
import {
    FavoriteMark,
    FolderMenu,
    MilestoneFavoriteStar,
    MilestoneRowMenu,
} from "./MilestoneFolderMenus";
import { MilestoneFolderModalState, ModalMilestoneFolder } from "./ModalMilestoneFolder";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

// ── Narrow-sidebar layout (MIP-1012) ──
// The task sidebar is a resizable panel (10-30% of the window, ~137px at
// 1440). Rows adapt with CSS container queries only: no width state and no
// ResizeObserver, so dragging the panel never re-renders the tree (MIP-904).
//   - Every row is always 2 lines: row 2 never wraps; the sprint chip
//     ellipsizes while the status chip, avatars and progress chip keep size.
//   - `ms-list` (the root <List>) drives the indent: the staircase has to
//     shrink for folders, rows and the add rows together, so the container
//     is the element above all of them. A container can't query itself, so
//     the rule restyles the List's children.
//   - `ms-row` (each row's ListItemContent) drives the chips: what fits
//     depends on the row's OWN width, which differs by depth (a Past row is
//     indented three levels deeper than an unfiled one).
// The sidebar Sheet itself gets no containment: it hosts fixed-position UI
// (the search popper). Row menus portal to <body>, so they are unaffected.
const MS_LIST = "ms-list";
const MS_ROW = "ms-row";
// Where the row menu sits vertically: centred on the first line (title), so it
// covers the progress chip and not the second line's chips and avatars.
const MS_MENU_TOP = "17px";
// List width below which the indent steps get smaller.
const LIST_COMPACT_MAX_PX = 299;
// MIP-1021: below this list width (a panel of ~210px, the 10% minimum on most
// screens) the indent, Joy's nested inset and the ListItem padding shrink
// further: at ~140px the old 24px base + 32px inset + 8px padding left the
// title no room at all.
const LIST_TIGHT_MAX_PX = 199;
// ...and below this, folder rows drop their count chip (the title would get
// ~20px next to icon + count + arrow).
const LIST_NO_FOLDER_COUNT_MAX_PX = 159;
const PROGRESS_CLASS = "MsRowProgress";
const FOLDER_COUNT_CLASS = "MsFolderCount";
// The title never gets less than this; a chip or the indent never wins.
const TITLE_MIN_WIDTH = "4ch";
// Row content widths (tuned in a browser): row 2 is the sprint chip (the
// flexible part), a status chip of up to ~60px and the avatars (~54px for
// four, ~34px for one + "+N"). Below 180px only one avatar + "+N" shows; below
// 160px the sprint chip would be an unreadable stub, so it goes; below 100px
// even status + one avatar can't fit, so the avatars go and status stays. The
// progress chip goes at the same width (MIP-1021): with it the title would
// get under ~60px (about 8 characters), and the title never goes.
const ROW_ONE_AVATAR_MAX_PX = 179;
const ROW_NO_SPRINT_MAX_PX = 159;
const ROW_NO_AVATARS_MAX_PX = 99;
const AVATARS_CLASS = "MsRowAvatars";
const SURPLUS_CLASS = "MsRowAvatarSurplus";
const SPRINT_CLASS = "MsRowSprint";

// ── Row menu and title room (MIP-1021) ──
// A row's "..." menu shows only while the row is hovered, keyboard-focused or
// its menu is open, and always on a touch device (no hover there). While
// hidden it takes NO width: it is Joy's absolutely positioned `endAction`, and
// the row no longer keeps a 32px margin for it, so the title gets that room
// and does not move when the menu appears (it overlays the row's right end).
//   - The button stays in the DOM and in the tab order (opacity, not display
//     or visibility), so keyboard and screen-reader users still reach it.
//   - Opacity and pointer-events sit on the BUTTON, not the endAction wrapper:
//     an opacity-0 wrapper would hide the button in every state. The wrapper
//     never takes a click itself, so a hidden menu can't block the row.
//   - No `:has()` (MIP-963: one cost a second of style recalc). Row focus is
//     read from Joy's `.Mui-focusVisible` on the preceding row button, so a
//     mouse click on a row does not leave its menu showing.
//   - `--ms-menu-reserve` is the margin a touch device keeps for the visible
//     button (32px, as before) so it never covers the chips; it is 0 for a
//     mouse, and 0 in a compact (<= 299px) list on touch too: title room is
//     scarcer than chip room there, and the button simply overlays.
//   - Where the button overlays, it has the row's hover colour as background
//     and a same-colour shadow fading to its left (a chip under its edge
//     fades out instead of being cut). Where it has its own space (touch in a
//     wide list) both are off: `--ms-menu-bg` / `--ms-menu-fade`.
const MENU_RESERVE_TOUCH = "32px";
// A folder row ends in a chevron that is also a click target: the menu sits
// just left of it (over the count chip), not on it. 18px = the chevron (16px)
// + its margin (4px) + the button's padding (4px) less Joy's 4px shift of the
// button; plus the row's right padding. On touch in a wide list the reserved
// 32px already keeps the chevron clear, so the menu goes back to the edge.
const FOLDER_MENU_RIGHT = "max(0px, calc(var(--ms-li-pr, 8px) + 18px - var(--ms-menu-reserve)))";
const END_ACTION = ".MuiListItem-endAction";
const REVEAL_SELECTORS = [
    `&:hover > ${END_ACTION} button`,
    `& > .Mui-focusVisible ~ ${END_ACTION} button`,
    `& > ${END_ACTION} button:focus-visible`,
    `& > ${END_ACTION} button[aria-expanded="true"]`,
].join(", ");
const rowMenuSx = (place: { top?: string; right?: string } = {}) => ({
    [`& > ${END_ACTION}`]: { pointerEvents: "none", ...place },
    [`& > ${END_ACTION} button`]: {
        opacity: 0,
        pointerEvents: "none",
        transition: "opacity 0.12s",
        "--IconButton-size": "28px",
        // Opaque, as the row's hover colour: it overlays whatever is under it.
        // The shadow is the same colour, fading out to the left, so a chip
        // under the button's edge fades instead of being cut off.
        backgroundColor: "var(--ms-menu-bg)",
        boxShadow: "var(--ms-menu-fade)",
    },
    [REVEAL_SELECTORS]: { opacity: 1, pointerEvents: "auto" },
    "@media (hover: none)": {
        [`& > ${END_ACTION} button`]: {
            opacity: 1,
            pointerEvents: "auto",
            "--IconButton-size": "32px",
        },
    },
});

// Left indent for tree level `depth` (0 = directly under the project row).
// Normal 40/56/72/88px (spacing 5 + 2 per level); compact 24/32/40/48px;
// tight (list <= 199px) 16/22/28/34px.
const indentSx = (depth: number) => ({
    ml: `calc(var(--ms-indent-base) + ${depth} * var(--ms-indent-step))`,
});
// Joy gives every button in a nested list an inset of 24px + 8px. The tight
// tier shrinks it (`--ms-btn-pl`); elsewhere the variable is unset and the
// fallback is Joy's own value.
const BTN_PL = "var(--ms-btn-pl, var(--ListItem-paddingLeft))";
// Joy puts an 8px gap between a row's icon, label and arrow; the icons carry
// their own right margin, so the tight tier drops it (`--ms-btn-gap`).
const BTN_GAP = "var(--ms-btn-gap, var(--ListItem-gap))";
// The ListItem's right padding (8px): 0 in the tight tier.
const LI_PR = "var(--ms-li-pr, 8px)";

// The managers arrive as slices (MIP-971): TypeScript forbids reading a member
// outside them, and `memo` skips the render of an `AppBody` pass that changed
// none of the values below. Every prop must therefore be referentially stable
// from the parent: slices from `useSidebarSlices`, `myself` and the id.
type Props = {
    currentProjectId: number;
    usePM: SidebarTreePM;
    useSM: SidebarTreeSM;
    useTM: SidebarTreeTM;
    useTEM: SidebarTreeTEM;
    myself: UserProps;
};

export const MilestonesListItem = memo(function MilestonesListItem({
    currentProjectId,
    usePM,
    useSM,
    useTM,
    useTEM,
    myself,
}: Props) {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    const sprints = useSM.projectSprints[currentProjectId] ?? [];

    const milestones: Milestone[] = useMemo(
        () =>
            selectSidebarLiveMilestones(useSM.projectMilestones[currentProjectId] ?? [], sprints),
        [useSM.projectMilestones, currentProjectId, sprints]
    );

    // "Past milestones": Closed milestones whose sprint has ended, plus Closed
    // milestones that never got a sprint (shown here as "No Sprint"). The
    // ended-sprint ones are hidden from the board/table (and the member
    // filter); this folder is the only way to reach them. Clicking one scopes the table/board to it (same
    // `handleOpen` as a live milestone), which un-hides its full task history.
    const pastMilestones: Milestone[] = useMemo(
        () =>
            selectSidebarPastMilestones(useSM.projectMilestones[currentProjectId] ?? [], sprints),
        [useSM.projectMilestones, currentProjectId, sprints]
    );

    // Same past milestones, bucketed into a year → sprint tree so the folder
    // renders as `<year>/<sprint>/<milestone>` instead of a flat list that
    // could run to hundreds of rows. Display-only — every consumer that filters
    // or scopes still reads the flat `pastMilestones` above.
    const pastMilestonesByYear = useMemo(
        () => groupMilestonesByYearAndSprint(pastMilestones, sprints),
        [pastMilestones, sprints]
    );

    // Folders (MIP-847): load the project's folders when the sidebar shows it,
    // and again whenever its milestones reload, so a folder renamed or filed
    // into elsewhere shows up. Members change folders from other tabs and
    // devices; there is no socket push for them, same as sprint moves.
    const { loadFoldersForProject, tsLastMilestonesLoaded } = useSM;
    useEffect(() => {
        void loadFoldersForProject(currentProjectId);
    }, [loadFoldersForProject, currentProjectId, tsLastMilestonesLoaded]);

    const folders: MilestoneFolder[] = useSM.projectFolders[currentProjectId] ?? [];
    // Plain grouping of the VISIBLE milestones. A Closed milestone whose sprint
    // ended is not in `milestones`, so it appears only under Past milestones
    // (and keeps its folder for if it comes back).
    const { folders: folderGroups, unfiled } = useMemo(
        () => groupMilestonesByFolder(milestones, folders),
        [milestones, folders]
    );
    const [folderModal, setFolderModal] = useState<MilestoneFolderModalState | null>(null);
    // A Closed milestone that never had a sprint buckets under a null sprint
    // (its name would otherwise render as the "—" placeholder).
    const pastSprintLabel = (g: { sprintId: number | null; sprintName: string }) =>
        g.sprintId == null ? t.tasks.sidebar.noSprint : g.sprintName;

    const handleOpen = (milestoneId: number) =>
        openMilestoneFromSidebar({ usePM, useTM }, milestoneId, currentProjectId);

    const handleAddMilestone = () => {
        useTM.setIsCreatingTask({
            flag: true,
            parentTaskId: null,
            rootTaskId: null,
            creationKind: "milestone",
            milestoneId: null,
        });
        useTM.setIsTaskTableVisible(false);
    };

    // `depth` indents the row one tree level per step: 1 inside a folder, 3
    // inside the Past-milestones year/sprint tree (0 = the flat, top level).
    const renderMilestoneRow = (m: Milestone, depth = 0, canFile = true) => {
        const sprintName =
            m.sprintId == null
                ? t.tasks.sidebar.noSprint
                : (sprints.find((s) => s.sprintId === m.sprintId)?.name ??
                  t.tasks.sidebar.sprintFallback);
        const favorited = useSM.isMilestoneFavorited(m.milestoneId);
        const toggleFavorite = () => void useSM.toggleMilestoneFavorite(m);
        return (
            <ListItem
                key={m.milestoneId}
                sx={{ pl: 0, pr: LI_PR, ...rowMenuSx({ top: MS_MENU_TOP }) }}
                endAction={
                    // The star and the "..." menu share the end action, so the row's
                    // hover reveal shows both. Past milestones keep their folder but
                    // are not filed from here: they sit in the year/sprint tree, not
                    // in a folder, so their menu holds only the favorite item.
                    <Stack alignItems="center" direction="row">
                        <MilestoneFavoriteStar
                            isFavorited={favorited}
                            milestoneTitle={m.title}
                            onToggle={toggleFavorite}
                        />
                        <MilestoneRowMenu
                            canMove={canFile}
                            currentFolderId={m.folderId ?? null}
                            folders={folders}
                            isFavorited={favorited}
                            milestoneTitle={m.title}
                            onMoveToFolder={(folderId) =>
                                void useSM.moveMilestoneToFolder(m.milestoneId, folderId)
                            }
                            onToggleFavorite={toggleFavorite}
                        />
                    </Stack>
                }
            >
                <ListItemButton
                    selected={
                        useTM.currentPreviewKind === "milestone" &&
                        useTM.currentPreviewMilestoneId === m.milestoneId
                    }
                    // `endAction` is absolutely positioned at the right edge. A
                    // mouse keeps no room for it (it shows over the row's end on
                    // hover); a touch device, where it is always visible, keeps
                    // 32px (see `rowMenuSx`).
                    sx={{
                        borderRadius: 8,
                        ...indentSx(depth),
                        py: 0.5,
                        pl: BTN_PL,
                        pr: 0.5,
                        gap: BTN_GAP,
                        // Two buttons now (star + menu), so twice the touch reserve.
                        mr: "calc(var(--ms-menu-reserve) * 2)",
                    }}
                    onClick={() => handleOpen(m.milestoneId)}
                >
                    <FlagRoundedIcon sx={{ fontSize: 14, color: "#f97316", mr: 0.75 }} />
                    <ListItemContent
                        sx={{
                            containerType: "inline-size",
                            containerName: MS_ROW,
                            [`@container ${MS_ROW} (max-width: ${ROW_ONE_AVATAR_MAX_PX}px)`]: {
                                [`& .${AVATARS_CLASS} > :nth-child(n+2):not(.${SURPLUS_CLASS})`]: {
                                    display: "none",
                                },
                                [`& .${SURPLUS_CLASS}`]: { display: "flex" },
                            },
                            [`@container ${MS_ROW} (max-width: ${ROW_NO_SPRINT_MAX_PX}px)`]: {
                                [`& .${SPRINT_CLASS}`]: { display: "none" },
                            },
                            // One block: two keys with the same prelude would
                            // overwrite each other.
                            [`@container ${MS_ROW} (max-width: ${ROW_NO_AVATARS_MAX_PX}px)`]: {
                                [`& .${AVATARS_CLASS}`]: { display: "none" },
                                [`& .${PROGRESS_CLASS}`]: { display: "none" },
                            },
                        }}
                    >
                        <Stack
                            alignItems="center"
                            direction="row"
                            spacing={0.5}
                            // Clips the progress chip, never the title (which has a
                            // minimum width): the chip is the part that can go.
                            sx={{ minWidth: 0, overflow: "hidden" }}
                        >
                            <Typography
                                level="body-sm"
                                sx={{
                                    flex: 1,
                                    minWidth: TITLE_MIN_WIDTH,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)",
                                }}
                            >
                                {m.title}
                            </Typography>
                            {favorited && <FavoriteMark />}
                            <Chip
                                className={PROGRESS_CLASS}
                                size="sm"
                                sx={{ flexShrink: 0 }}
                                variant="soft"
                            >
                                {m.tasksClosed ?? 0}/{m.tasksTotal ?? 0}
                            </Chip>
                        </Stack>
                        {/* One line at any width (MIP-1012): wrapping put each
                            chip on its own line. `useFlexGap` so a chip the
                            container query hides leaves no gap behind. */}
                        <Stack
                            alignItems="center"
                            direction="row"
                            spacing={0.5}
                            sx={{ mt: 0.25, flexWrap: "nowrap", minWidth: 0, overflow: "hidden" }}
                            useFlexGap
                        >
                            <Chip
                                className={SPRINT_CLASS}
                                size="sm"
                                sx={{ minWidth: 0, flexShrink: 1 }}
                                title={sprintName}
                                variant="outlined"
                            >
                                {sprintName}
                            </Chip>
                            {(() => {
                                const tone = getMilestoneStatusChipColor(m.status);
                                return (
                                    <Chip
                                        size="sm"
                                        variant="solid"
                                        sx={{
                                            backgroundColor: tone.color,
                                            color: tone.textColor,
                                            fontWeight: 600,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {taskMetaLabel(m.status, t.tasks.filters)}
                                    </Chip>
                                );
                            })()}
                            <Box sx={{ flex: 1 }} />
                            <AvatarGroup
                                className={AVATARS_CLASS}
                                size="sm"
                                sx={{ "--Avatar-size": "18px", flexShrink: 0 }}
                            >
                                {m.assignees.slice(0, 4).map((a) => {
                                    const userIdKey = a.userId != null ? String(a.userId) : "";
                                    const profile = userIdKey
                                        ? useTEM.teamMemberProfiles[userIdKey]
                                        : undefined;
                                    // Use AvatarWithStatus when we can resolve
                                    // the team member profile (gives us online
                                    // pulse + click-to-profile); fall back to a
                                    // plain Avatar for legacy assignees that
                                    // aren't in the team profile map (e.g.
                                    // recently removed members).
                                    return profile ? (
                                        <AvatarWithStatus
                                            key={userIdKey}
                                            avatarSize={18}
                                            avatarUser={profile}
                                            isYou={String(myself.userId) === userIdKey}
                                            myself={myself}
                                            showPulseDot={false}
                                        />
                                    ) : (
                                        <Avatar
                                            key={userIdKey || `idx-${a.username}`}
                                            sx={{ fontSize: 10 }}
                                            src={
                                                a.profileImageUrl
                                                    ? `${media_url}/${a.profileImageUrl}`
                                                    : undefined
                                            }
                                        >
                                            {(a.username?.[0] || "?").toUpperCase()}
                                        </Avatar>
                                    );
                                })}
                                {/* Narrow rows show the first avatar plus this
                                    count of everyone else (hidden otherwise). */}
                                {m.assignees.length > 1 && (
                                    <Avatar
                                        className={SURPLUS_CLASS}
                                        sx={{ display: "none", fontSize: 10 }}
                                    >
                                        +{m.assignees.length - 1}
                                    </Avatar>
                                )}
                            </AvatarGroup>
                        </Stack>
                    </ListItemContent>
                </ListItemButton>
            </ListItem>
        );
    };

    return (
        <List
            sx={(theme) => ({
                gap: 0.25,
                containerType: "inline-size",
                containerName: MS_LIST,
                "--ms-indent-base": theme.spacing(5),
                "--ms-indent-step": theme.spacing(2),
                // Room a visible row menu keeps: none for a mouse (the menu is
                // hidden until hover), the button's width on touch.
                "--ms-menu-reserve": "0px",
                "--ms-menu-bg": theme.vars.palette.neutral.plainHoverBg,
                "--ms-menu-fade": `-10px 0 8px 0 ${theme.vars.palette.neutral.plainHoverBg}`,
                "@media (hover: none)": {
                    "--ms-menu-reserve": MENU_RESERVE_TOUCH,
                    "--ms-menu-bg": "transparent",
                    "--ms-menu-fade": "none",
                },
                [`@container ${MS_LIST} (max-width: ${LIST_COMPACT_MAX_PX}px)`]: {
                    "& > *": {
                        "--ms-indent-base": theme.spacing(3),
                        "--ms-indent-step": theme.spacing(1),
                        "--ms-menu-reserve": "0px",
                        "--ms-menu-bg": theme.vars.palette.neutral.plainHoverBg,
                        "--ms-menu-fade": `-10px 0 8px 0 ${theme.vars.palette.neutral.plainHoverBg}`,
                    },
                },
                [`@container ${MS_LIST} (max-width: ${LIST_TIGHT_MAX_PX}px)`]: {
                    "& > *": {
                        "--ms-indent-base": "16px",
                        "--ms-indent-step": "6px",
                        "--ms-btn-pl": "8px",
                        "--ms-btn-gap": "0px",
                        "--ms-li-pr": "0px",
                    },
                },
                [`@container ${MS_LIST} (max-width: ${LIST_NO_FOLDER_COUNT_MAX_PX}px)`]: {
                    [`& .${FOLDER_COUNT_CLASS}`]: { display: "none" },
                },
            })}
        >
            {folderGroups.map(({ folder, milestones: inFolder }) => (
                <MilestoneTreeFolder
                    key={`folder-${folder.folderId}`}
                    count={inFolder.length}
                    depth={0}
                    isDark={isDark}
                    label={folder.name}
                    actions={
                        <FolderMenu
                            folderName={folder.name}
                            onDelete={() =>
                                setFolderModal({
                                    mode: "delete",
                                    folderId: folder.folderId,
                                    name: folder.name,
                                })
                            }
                            onRename={() =>
                                setFolderModal({
                                    mode: "rename",
                                    folderId: folder.folderId,
                                    name: folder.name,
                                })
                            }
                        />
                    }
                    icon={
                        <FolderRoundedIcon
                            sx={{
                                fontSize: 15,
                                mr: 0.75,
                                color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)",
                            }}
                        />
                    }
                    defaultOpen
                >
                    {inFolder.map((m) => renderMilestoneRow(m, 1))}
                </MilestoneTreeFolder>
            ))}
            {folderGroups.length > 0 && unfiled.length > 0 && (
                <ListItem sx={{ pl: 0, pb: 0, pr: LI_PR }}>
                    <Typography
                        level="body-xs"
                        sx={{
                            ...indentSx(0),
                            pl: 1,
                            opacity: 0.55,
                            textTransform: "uppercase",
                        }}
                    >
                        {t.tasks.folders.unfiled}
                    </Typography>
                </ListItem>
            )}
            {unfiled.map((m) => renderMilestoneRow(m))}
            {pastMilestones.length > 0 && (
                <MilestoneTreeFolder
                    count={pastMilestones.length}
                    depth={0}
                    isDark={isDark}
                    label={t.tasks.sidebar.pastMilestones}
                    icon={
                        <HistoryRoundedIcon
                            sx={{
                                fontSize: 15,
                                mr: 0.75,
                                color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)",
                            }}
                        />
                    }
                >
                    {pastMilestonesByYear.map((yearGroup) => {
                        const yearCount = yearGroup.sprints.reduce(
                            (n, s) => n + s.milestones.length,
                            0
                        );
                        return (
                            <MilestoneTreeFolder
                                key={yearGroup.year}
                                count={yearCount}
                                depth={1}
                                isDark={isDark}
                                label={yearGroup.year}
                                icon={
                                    <CalendarMonthRoundedIcon
                                        sx={{
                                            fontSize: 15,
                                            mr: 0.75,
                                            color: isDark
                                                ? "rgba(255,255,255,0.45)"
                                                : "rgba(0,0,0,0.4)",
                                        }}
                                    />
                                }
                            >
                                {yearGroup.sprints.map((sprintGroup) => (
                                    <MilestoneTreeFolder
                                        key={sprintGroup.sprintId ?? "none"}
                                        count={sprintGroup.milestones.length}
                                        depth={2}
                                        isDark={isDark}
                                        label={pastSprintLabel(sprintGroup)}
                                        icon={
                                            <DirectionsRunRoundedIcon
                                                sx={{
                                                    fontSize: 15,
                                                    mr: 0.75,
                                                    color: isDark
                                                        ? "rgba(255,255,255,0.45)"
                                                        : "rgba(0,0,0,0.4)",
                                                }}
                                            />
                                        }
                                    >
                                        {sprintGroup.milestones.map((m) =>
                                            renderMilestoneRow(m, 3, false)
                                        )}
                                    </MilestoneTreeFolder>
                                ))}
                            </MilestoneTreeFolder>
                        );
                    })}
                </MilestoneTreeFolder>
            )}
            <AddMilestoneRow isDark={isDark} onClick={handleAddMilestone} />
            <AddFolderRow isDark={isDark} onClick={() => setFolderModal({ mode: "create" })} />
            <ModalMilestoneFolder
                state={folderModal}
                onClose={() => setFolderModal(null)}
                onDelete={(folderId) => useSM.removeFolder(folderId, currentProjectId)}
                onCreate={async (name) =>
                    (await useSM.createFolder(currentProjectId, name)) !== null
                }
                onRename={async (folderId, name) =>
                    (await useSM.renameFolder(folderId, currentProjectId, name)) !== null
                }
            />
        </List>
    );
});

// Generic collapsible folder used for every level of the "Past milestones"
// tree (Past milestones → year → sprint). Defaults collapsed — it's an
// archive, not something the user looks at every session. `depth` sets the
// indent (`indentSx`) so nested levels staircase inward.
const MilestoneTreeFolder = ({
    icon,
    label,
    count,
    depth,
    isDark,
    children,
    defaultOpen = false,
    actions,
}: {
    icon: ReactNode;
    label: string;
    count: number;
    depth: number;
    isDark: boolean;
    children: ReactNode;
    // Folders of live milestones open by default (the work is the point);
    // the Past-milestones archive stays collapsed.
    defaultOpen?: boolean;
    // Row actions (a "..." menu), laid out at the right edge by ListItem.
    actions?: ReactNode;
}) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <>
            <ListItem
                endAction={actions}
                sx={{ pl: 0, pr: LI_PR, ...rowMenuSx({ right: FOLDER_MENU_RIGHT }) }}
            >
                <ListItemButton
                    // Same as the milestone row: no room kept for the "..." menu
                    // except on touch.
                    sx={{
                        borderRadius: 8,
                        ...indentSx(depth),
                        py: 0.5,
                        pl: BTN_PL,
                        pr: 0.5,
                        gap: BTN_GAP,
                        mr: actions ? "var(--ms-menu-reserve)" : 0,
                    }}
                    onClick={() => setOpen((prev) => !prev)}
                >
                    {icon}
                    <ListItemContent>
                        <Typography
                            level="body-sm"
                            sx={{
                                minWidth: TITLE_MIN_WIDTH,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontWeight: 500,
                                // The same weight and colour as the sidebar's "Projects" and
                                // "Recents" headings, so a folder reads as a peer of those.
                                color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.8)",
                            }}
                        >
                            {label}
                        </Typography>
                    </ListItemContent>
                    <Chip className={FOLDER_COUNT_CLASS} size="sm" variant="soft">
                        {count}
                    </Chip>
                    <KeyboardArrowDownRoundedIcon
                        sx={{
                            fontSize: 16,
                            ml: 0.5,
                            color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)",
                            transition: "transform 0.2s ease",
                            transform: open ? "rotate(180deg)" : "none",
                        }}
                    />
                </ListItemButton>
            </ListItem>
            {open && children}
        </>
    );
};

const AddMilestoneRow = ({ onClick, isDark }: { onClick: () => void; isDark: boolean }) => {
    const { t } = useTranslation();
    return (
        <ListItem sx={{ pl: 0, pr: LI_PR }}>
            <ListItemButton
                sx={{ borderRadius: 8, ...indentSx(0), py: 0.5, pl: BTN_PL, gap: BTN_GAP }}
                onClick={onClick}
            >
                <AddIcon sx={{ fontSize: 16, mr: 0.5 }} />
                <Typography
                    level="body-sm"
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
                    }}
                >
                    {t.tasks.sidebar.addMilestone}
                </Typography>
            </ListItemButton>
        </ListItem>
    );
};

const AddFolderRow = ({ onClick, isDark }: { onClick: () => void; isDark: boolean }) => {
    const { t } = useTranslation();
    return (
        <ListItem sx={{ pl: 0, pr: LI_PR }}>
            <ListItemButton
                sx={{ borderRadius: 8, ...indentSx(0), py: 0.5, pl: BTN_PL, gap: BTN_GAP }}
                onClick={onClick}
            >
                <FolderRoundedIcon
                    sx={{
                        fontSize: 16,
                        mr: 0.5,
                        color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)",
                    }}
                />
                <Typography
                    level="body-sm"
                    sx={{ color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)" }}
                >
                    {t.tasks.folders.newFolder}
                </Typography>
            </ListItemButton>
        </ListItem>
    );
};
