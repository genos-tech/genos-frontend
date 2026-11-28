import { useCallback, useEffect, useRef, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import RemoveCircleOutlineRoundedIcon from "@mui/icons-material/RemoveCircleOutlineRounded";
import UpgradeRoundedIcon from "@mui/icons-material/UpgradeRounded";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
    Alert,
    Box,
    Button,
    Chip,
    Dropdown,
    MenuButton,
    Stack,
    Tab,
    TabList,
    Tabs,
    Typography,
} from "@mui/joy";

import { visuallyHidden } from "../../../components/ui/a11y/visuallyHidden";
import { AppTooltip } from "../../../components/ui/AppTooltip";
import { EmptyState } from "../../../components/ui/feedback/EmptyState";
import { ErrorState } from "../../../components/ui/feedback/ErrorState";
import { SkeletonRows } from "../../../components/ui/feedback/Skeleton";
import { toast } from "../../../components/ui/feedback/toastStore";
import { ConfirmDialog } from "../../../components/ui/modal/ConfirmDialog";
import { MenuRow, MenuSurface, MoreMenu } from "../../../components/ui/MoreMenu";
import { PlainButton } from "../../../components/ui/PlainButton";
import { useAuth } from "../../../context/authState";
import { fmt, useTranslation } from "../../../i18n";
import { relativeTimeLabel } from "../../spotlight/SpotlightContent";
import { ProjectTagChip } from "../../tasks/components/ProjectTagChip";
import { GENOS_MEMORY_CONFIRM_Z_INDEX } from "../memory/confirmLayer";
import { SkillEditor } from "./SkillEditor";
import { SkillHub } from "./SkillHub";
import { SkillReportDialog } from "./SkillReportDialog";
import {
    chipsOf,
    copySkill,
    createSkill,
    deleteSkill,
    fetchSkills,
    installSkill,
    isInstallableTeamSkill,
    isModerated,
    setSkillHidden,
    uninstallSkill,
    type SkillList,
    type SkillRow,
    type SkillTab,
} from "./skillsApi";
import type { SkillsHost } from "./skillsHost";
import { templateBody } from "./skillText";
import { SkillUpdateDiffDialog } from "./SkillUpdateDiffDialog";

type Props = {
    teamId: string;
    host: SkillsHost;
    /** The list to open on (MIP-2589: "Find more skills" opens the Hub). */
    initialTab?: "hub" | "team";
};

type View = { kind: "list" } | { kind: "edit"; id: string };
/** The tabs of the page: the member's own and the team's, the public skills they installed
 *  (MIP-2226), and the public Hub (MIP-2047). */
type PageTab = SkillTab | "hub";
type ListState =
    | { status: "loading" }
    | { status: "failed" }
    | { status: "ready"; data: SkillList };

/**
 * "Skills" in Settings > Genos: the member's own skills and their team's, a way to start a new
 * one (blank or from the template), and the editor for one.
 *
 * Two views, local state like the settings panel around it: the list, and one skill's editor
 * with a way back. A new skill is created at once with a title ("New skill") and the editor
 * opens on it, so the editor is the form and there is no half-made skill in a dialog.
 */
export const SkillsPage = ({ teamId, host, initialTab }: Props) => {
    const { t, locale } = useTranslation();
    const m = t.settings.genosSkills;
    const { accessToken } = useAuth();
    const [view, setView] = useState<View>({ kind: "list" });
    const [tab, setTab] = useState<PageTab>(initialTab ?? "mine");
    // The server's `GENOS_SKILLS_PUBLIC` switch, as the list last said it: the Hub tab exists only
    // while it is on. It is kept apart from the list because the Hub tab shows no list of ours.
    const [publicEnabled, setPublicEnabled] = useState(false);
    const [list, setList] = useState<ListState>({ status: "loading" });
    const [limitHit, setLimitHit] = useState<{ limit: number; used: number } | null>(null);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<SkillRow | null>(null);
    const [reporting, setReporting] = useState<SkillRow | null>(null);
    // The installed skill whose update diff is open (MIP-2226).
    const [updating, setUpdating] = useState<SkillRow | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Only the newest request may set the list: a slow answer for the tab left behind must not
    // be drawn under the tab now open.
    const latest = useRef(0);
    const load = useCallback(
        async (which: SkillTab, quiet = false) => {
            const mine = ++latest.current;
            // A quiet refresh keeps the rows on screen (no skeleton), so a focused control inside
            // a row is not unmounted under a keyboard user.
            if (!quiet) setList({ status: "loading" });
            const res = await fetchSkills(accessToken, teamId, which);
            if (mine !== latest.current) return;
            if (res.ok) setPublicEnabled(res.data.publicEnabled);
            setList((prev) =>
                res.ok
                    ? { status: "ready", data: res.data }
                    : quiet && prev.status === "ready"
                      ? prev
                      : { status: "failed" }
            );
        },
        [accessToken, teamId]
    );

    // After an accepted update the marker is gone, so focus goes to that row's open button
    // instead of the page top (MIP-2226).
    const focusAfterUpdate = useRef<string | null>(null);
    useEffect(() => {
        const id = focusAfterUpdate.current;
        if (!id || list.status !== "ready") return;
        focusAfterUpdate.current = null;
        document.querySelector<HTMLElement>(`[data-skill-open="${CSS.escape(id)}"]`)?.focus();
    }, [list]);

    // The Hub tab loads its own pages; the list behind it stays the member's own.
    const listTab: SkillTab = tab === "hub" ? "mine" : tab;
    useEffect(() => {
        if (view.kind !== "list") return;
        // The list is a fetch whose answer sets the state; the first render has nothing to draw.
        void load(listTab);
    }, [load, listTab, view.kind]);

    const create = async (fromTemplate: boolean) => {
        if (creating) return;
        setCreating(true);
        const title = m.newDefaultTitle;
        const tpl = m.template;
        const res = await createSkill(accessToken, teamId, {
            title,
            visibility: "private",
            toolLevel: "read",
            bodyMarkdown: fromTemplate
                ? templateBody(title, {
                      youGet: tpl.youGet,
                      input: tpl.input,
                      inputHint: tpl.inputHint,
                      steps: tpl.steps,
                      stepsHint: tpl.stepsHint,
                      output: tpl.output,
                      outputHint: tpl.outputHint,
                      never: tpl.never,
                      neverHint: tpl.neverHint,
                  })
                : "",
        });
        setCreating(false);
        if (res.ok) {
            setLimitHit(null);
            setView({ kind: "edit", id: res.data.id });
        } else if (res.reason === "limit") {
            setLimitHit({ limit: res.limit ?? 0, used: res.used ?? 0 });
        } else {
            toast.error(res.message || m.newFailed);
        }
    };

    const copy = async (skill: SkillRow) => {
        const res = await copySkill(accessToken, skill.id, teamId);
        if (res.ok) {
            toast.success(m.list.copied);
            setTab("mine");
        } else if (res.reason === "limit") {
            setLimitHit({ limit: res.limit ?? 0, used: res.used ?? 0 });
            setTab("mine");
        } else {
            toast.error(res.message || m.list.copyFailed);
        }
    };

    const toggleHidden = async (skill: SkillRow) => {
        const hide = !skill.hiddenByTeam;
        const res = await setSkillHidden(accessToken, skill.id, hide);
        if (res.ok) {
            toast.success(hide ? m.team.hiddenToast : m.team.shownToast);
        } else {
            toast.error(res.message || m.team.hideFailed);
        }
        void load(listTab);
    };

    // Install from Team skills (MIP-2589): only an installed skill can be picked or run.
    const install = async (skill: SkillRow) => {
        const res = await installSkill(accessToken, skill.id);
        if (res.ok) {
            toast.success(m.hub.installedToast);
            focusAfterUpdate.current = skill.id;
            void load(listTab, true);
        } else {
            toast.error(res.message || m.hub.installFailed);
        }
    };

    // From the Installed tab (MIP-2293): the row leaves the list once the server has removed it.
    // On Team skills the row stays and offers Install again.
    const uninstall = async (skill: SkillRow) => {
        const res = await uninstallSkill(accessToken, skill.id);
        if (res.ok) {
            toast.success(m.hub.uninstalledToast);
            void load(listTab, true);
        } else {
            toast.error(res.message || m.hub.uninstallFailed);
        }
    };

    const remove = async () => {
        if (!deleting) return false;
        const res = await deleteSkill(accessToken, deleting.id);
        if (!res.ok) {
            setDeleteError(res.message || m.delete.failed);
            return false;
        }
        setDeleting(null);
        void load(listTab);
        return true;
    };

    if (view.kind === "edit") {
        return (
            <SkillEditor
                host={host}
                publicEnabled={publicEnabled}
                skillId={view.id}
                teamId={teamId}
                onBack={() => setView({ kind: "list" })}
            />
        );
    }

    const onHub = tab === "hub" && publicEnabled;
    const data = list.status === "ready" ? list.data : null;
    const full = data !== null && data.limit !== null && data.used >= data.limit;
    const limitNote =
        limitHit ??
        (full && data && data.limit !== null ? { limit: data.limit, used: data.used } : null);

    return (
        <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Box sx={{ minWidth: 0 }}>
                <Typography level="title-lg" sx={{ overflowWrap: "anywhere" }}>
                    {m.title}
                </Typography>
                <Typography level="body-sm" sx={{ mt: 0.5 }}>
                    {m.intro}
                </Typography>
            </Box>

            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    minWidth: 0,
                }}
            >
                <Tabs
                    aria-label={m.tabs.label}
                    size="sm"
                    sx={{ bgcolor: "transparent", minWidth: 0, maxWidth: "100%" }}
                    value={tab}
                    onChange={(_e, value) => setTab(value as PageTab)}
                >
                    {/* Four tabs stay on one line whatever the language: a label never wraps, and
                        a strip wider than the screen scrolls sideways (MIP-2226). */}
                    <TabList
                        sx={{
                            gap: 0.5,
                            flexWrap: "nowrap",
                            overflowX: "auto",
                            "& [role=tab]": { flexShrink: 0, whiteSpace: "nowrap", px: 0.875 },
                        }}
                        disableUnderline
                    >
                        <Tab value="mine" variant={tab === "mine" ? "soft" : "plain"}>
                            {m.tabs.mine}
                        </Tab>
                        <Tab value="team" variant={tab === "team" ? "soft" : "plain"}>
                            {m.tabs.team}
                        </Tab>
                        {(publicEnabled || tab === "installed") && (
                            <Tab
                                value="installed"
                                variant={tab === "installed" ? "soft" : "plain"}
                            >
                                {m.tabs.installed}
                            </Tab>
                        )}
                        {publicEnabled && (
                            <Tab value="hub" variant={tab === "hub" ? "soft" : "plain"}>
                                {m.tabs.hub}
                            </Tab>
                        )}
                    </TabList>
                </Tabs>
                <Dropdown>
                    <MenuButton
                        disabled={creating || full}
                        size="sm"
                        slots={{ root: Button }}
                        slotProps={{
                            root: {
                                variant: "solid",
                                size: "sm",
                                loading: creating,
                                startDecorator: <AddRoundedIcon />,
                            },
                        }}
                    >
                        {m.newSkill}
                    </MenuButton>
                    <MenuSurface placement="bottom-end" sx={{ minWidth: 200 }}>
                        <MenuRow icon={<ArticleOutlinedIcon />} onClick={() => void create(true)}>
                            {m.newTemplate}
                        </MenuRow>
                        <MenuRow
                            icon={<InsertDriveFileOutlinedIcon />}
                            onClick={() => void create(false)}
                        >
                            {m.newBlank}
                        </MenuRow>
                    </MenuSurface>
                </Dropdown>
            </Box>

            {onHub && (
                <SkillHub
                    onCopy={(skill) => void copy(skill)}
                    onOpen={(skill) => setView({ kind: "edit", id: skill.id })}
                    onReport={(skill) => setReporting(skill)}
                />
            )}

            {!onHub && limitNote && (
                <Alert color="warning" size="sm" variant="soft">
                    {fmt(m.list.limitReached, limitNote)}
                </Alert>
            )}

            {onHub ? null : list.status === "loading" ? (
                <SkeletonRows count={3} label={m.list.loading} />
            ) : list.status === "failed" ? (
                <ErrorState
                    data-error="genos-skills"
                    size="sm"
                    title={m.list.loadFailed}
                    onRetry={() => void load(listTab)}
                />
            ) : list.data.skills.length === 0 ? (
                <EmptyState
                    data-empty="genos-skills"
                    size="sm"
                    action={
                        tab === "mine" && !full
                            ? {
                                  label: m.newTemplate,
                                  onClick: () => void create(true),
                                  icon: <ArticleOutlinedIcon />,
                              }
                            : undefined
                    }
                    body={
                        tab === "mine"
                            ? m.list.emptyMineBody
                            : tab === "installed"
                              ? m.list.emptyInstalledBody
                              : m.list.emptyTeamBody
                    }
                    title={
                        tab === "mine"
                            ? m.list.emptyMineTitle
                            : tab === "installed"
                              ? m.list.emptyInstalledTitle
                              : m.list.emptyTeamTitle
                    }
                />
            ) : (
                <Box
                    component="ul"
                    sx={{
                        listStyle: "none",
                        m: 0,
                        p: 0,
                        minWidth: 0,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: "lg",
                    }}
                >
                    {list.data.skills.map((skill) => (
                        <SkillListItem
                            key={skill.id}
                            installedTab={tab === "installed"}
                            skill={skill}
                            teamTab={tab === "team"}
                            when={
                                skill.updatedAt
                                    ? relativeTimeLabel(skill.updatedAt, t.spotlight, locale)
                                    : ""
                            }
                            onCopy={() => void copy(skill)}
                            onInstall={() => void install(skill)}
                            onOpen={() => setView({ kind: "edit", id: skill.id })}
                            onReport={() => setReporting(skill)}
                            onToggleHidden={() => void toggleHidden(skill)}
                            onUninstall={() => void uninstall(skill)}
                            onUpdate={() => setUpdating(skill)}
                            onDelete={() => {
                                setDeleteError(null);
                                setDeleting(skill);
                            }}
                        />
                    ))}
                </Box>
            )}
            {!onHub && data && data.limit !== null && tab === "mine" && (
                <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                    {fmt(m.list.usage, { used: data.used, limit: data.limit })}
                </Typography>
            )}

            <SkillReportDialog
                skill={reporting ? { id: reporting.id, title: reporting.title } : null}
                onClose={() => setReporting(null)}
            />
            <SkillUpdateDiffDialog
                skill={updating ? { id: updating.id, title: updating.title } : null}
                onClose={() => setUpdating(null)}
                onUpdated={() => {
                    focusAfterUpdate.current = updating?.id ?? null;
                    void load(listTab, true);
                }}
            />
            <ConfirmDialog
                cancelLabel={t.common.actions.cancel}
                confirmLabel={m.delete.confirm}
                description={m.delete.body}
                entityName={deleting?.title}
                error={deleteError}
                open={deleting !== null}
                title={m.delete.title}
                zIndex={GENOS_MEMORY_CONFIRM_Z_INDEX}
                destructive
                onClose={() => setDeleting(null)}
                onConfirm={remove}
            />
        </Stack>
    );
};

type ItemProps = {
    skill: SkillRow;
    /** The Installed tab: the row names the author and gets the version line (MIP-2226). */
    installedTab: boolean;
    /** The Team skills tab: the row can be installed from here (MIP-2589). */
    teamTab: boolean;
    when: string;
    onOpen: () => void;
    onCopy: () => void;
    onToggleHidden: () => void;
    onReport: () => void;
    onDelete: () => void;
    onUpdate: () => void;
    onUninstall: () => void;
    onInstall: () => void;
};

/** The one-line footer of an installed row. Both states are `FOOTER_HEIGHT` tall, so a row with
 *  the "Update available" marker and one without have the same geometry. */
const FOOTER_HEIGHT = 36;

const SkillListItem = ({
    skill,
    installedTab,
    teamTab,
    when,
    onOpen,
    onCopy,
    onToggleHidden,
    onReport,
    onDelete,
    onUpdate,
    onUninstall,
    onInstall,
}: ItemProps) => {
    const { t } = useTranslation();
    const l = t.settings.genosSkills.list;
    const tm = t.settings.genosSkills.team;
    const h = t.settings.genosSkills.hub;
    const name = skill.title || t.settings.genosSkills.untitled;
    // An outside author is named by the public handle only, never the account (MIP-2047).
    const byline = skill.isOfficial
        ? h.official
        : skill.author
          ? fmt(h.byHandle, { handle: skill.author.handle })
          : "";
    // The version this member installed, on the two tabs that act on installs.
    const installed = installedTab || teamTab ? (skill.installedVersionNo ?? null) : null;
    const canInstall = teamTab && installed === null && isInstallableTeamSkill(skill);
    // Team rows that are installed or can be keep one footer height, so installing moves nothing.
    const hasFooter = installed !== null || canInstall;
    const items = [
        {
            id: "open",
            label: skill.canEdit ? l.edit : l.view,
            icon: skill.canEdit ? <EditOutlinedIcon /> : <VisibilityOutlinedIcon />,
            onClick: onOpen,
        },
        {
            id: "copy",
            kind: "copyLink" as const,
            label: l.copy,
            icon: <ContentCopyRoundedIcon />,
            onClick: onCopy,
            // A private skill is the owner's to copy (an editor was invited to work on it), and a
            // skill the team owner hid is not the team's to copy.
            visible:
                !skill.mine &&
                skill.visibility !== "private" &&
                skill.visibility !== "specific" &&
                !skill.hiddenByTeam,
        },
        {
            id: "uninstall",
            label: h.uninstall,
            icon: <RemoveCircleOutlineRoundedIcon />,
            onClick: onUninstall,
            visible: installed !== null,
        },
        {
            id: "hide",
            label: skill.hiddenByTeam ? tm.show : tm.hide,
            icon: skill.hiddenByTeam ? <VisibilityOutlinedIcon /> : <VisibilityOffOutlinedIcon />,
            onClick: onToggleHidden,
            visible: skill.canHide,
        },
        {
            id: "report",
            label: l.report,
            icon: <FlagOutlinedIcon />,
            onClick: onReport,
            visible: !skill.mine,
        },
        {
            id: "delete",
            kind: "delete" as const,
            label: l.delete,
            icon: <DeleteOutlineRoundedIcon />,
            onClick: onDelete,
            danger: true,
            visible: skill.mine,
        },
    ];
    return (
        <Box
            component="li"
            sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 0.5,
                minWidth: 0,
                borderTop: "1px solid",
                borderColor: "divider",
                "&:first-of-type": { borderTop: "none" },
            }}
        >
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <PlainButton
                    aria-label={name}
                    data-skill-open={skill.id}
                    sx={{
                        width: "100%",
                        minWidth: 0,
                        display: "block",
                        textAlign: "start",
                        p: 1.5,
                        borderRadius: "lg",
                        // A row with a footer under it keeps its text clear of the footer.
                        ...(hasFooter && { pb: 0.5 }),
                    }}
                    onClick={onOpen}
                >
                    <Box
                        sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}
                    >
                        {skill.icon && <span aria-hidden>{skill.icon}</span>}
                        <Typography level="title-sm" sx={{ overflowWrap: "anywhere" }}>
                            {name}
                        </Typography>
                        <Typography
                            level="body-xs"
                            sx={{ color: "text.tertiary", fontFamily: "monospace" }}
                        >
                            /{skill.slug}
                        </Typography>
                        <Chip size="sm" variant="soft">
                            {skill.visibility === "team"
                                ? l.team
                                : skill.visibility === "specific"
                                  ? l.specific
                                  : skill.visibility === "public"
                                    ? h.field.public
                                    : l.private}
                        </Chip>
                        {skill.role === "editor" && (
                            <Chip size="sm" variant="outlined">
                                {tm.roleEditor}
                            </Chip>
                        )}
                        {skill.hiddenByTeam && (
                            <Chip color="warning" size="sm" variant="soft">
                                {tm.hiddenChip}
                            </Chip>
                        )}
                        {skill.sourceHarmful && (
                            <AppTooltip title={t.settings.genosSkills.sourceHarmful.warning}>
                                <Chip color="warning" size="sm" variant="soft">
                                    {t.settings.genosSkills.sourceHarmful.chip}
                                </Chip>
                            </AppTooltip>
                        )}
                        {skill.mine && isModerated(skill.status) && (
                            <Chip color="warning" size="sm" variant="soft">
                                {l.moderated[skill.status as keyof typeof l.moderated]}
                            </Chip>
                        )}
                        {skill.mine &&
                            (skill.visibility === "team" || skill.visibility === "specific") && (
                                <Chip
                                    color={skill.publishedVersionNo > 0 ? "neutral" : "warning"}
                                    size="sm"
                                    variant="outlined"
                                >
                                    {skill.publishedVersionNo > 0
                                        ? fmt(l.version, { n: skill.publishedVersionNo })
                                        : l.notPublished}
                                </Chip>
                            )}
                    </Box>
                    {skill.description && (
                        <Typography
                            level="body-sm"
                            sx={{
                                mt: 0.5,
                                overflowWrap: "anywhere",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                            }}
                        >
                            {skill.description}
                        </Typography>
                    )}
                    {skill.tags.length > 0 && (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.75 }}>
                            {chipsOf(skill).map((chip) => (
                                <ProjectTagChip
                                    key={chip.name}
                                    label={chip.name}
                                    tagColor={chip.color}
                                />
                            ))}
                        </Box>
                    )}
                    <Typography level="body-xs" sx={{ mt: 0.75, color: "text.tertiary" }}>
                        {[
                            !skill.mine && skill.ownerName
                                ? fmt(l.by, { name: skill.ownerName })
                                : "",
                            installedTab ? byline : "",
                            when ? fmt(l.updated, { when }) : "",
                        ]
                            .filter(Boolean)
                            .join(" · ")}
                    </Typography>
                </PlainButton>
                {canInstall && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: FOOTER_HEIGHT,
                            px: 1.5,
                        }}
                    >
                        <Button
                            size="sm"
                            startDecorator={<DownloadRoundedIcon />}
                            variant="outlined"
                            sx={{
                                minHeight: 0,
                                height: FOOTER_HEIGHT - 8,
                                "@media (pointer: coarse)": { height: FOOTER_HEIGHT },
                            }}
                            onClick={onInstall}
                        >
                            {h.install}
                            <Box component="span" sx={visuallyHidden}>
                                {` · ${name}`}
                            </Box>
                        </Button>
                    </Box>
                )}
                {installed !== null && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            minWidth: 0,
                            height: FOOTER_HEIGHT,
                            px: 1.5,
                        }}
                    >
                        {skill.updateAvailable && (
                            <Button
                                color="primary"
                                size="sm"
                                startDecorator={<UpgradeRoundedIcon />}
                                variant="soft"
                                sx={{
                                    flexShrink: 0,
                                    minHeight: 0,
                                    height: FOOTER_HEIGHT - 8,
                                    // A finger gets the whole footer height; the row does not grow.
                                    "@media (pointer: coarse)": { height: FOOTER_HEIGHT },
                                }}
                                onClick={onUpdate}
                            >
                                {t.settings.genosSkills.updateDiff.title}
                                <Box component="span" sx={visuallyHidden}>
                                    {` · ${name}`}
                                </Box>
                            </Button>
                        )}
                        {teamTab && (
                            <Chip color="success" size="sm" sx={{ flexShrink: 0 }} variant="soft">
                                {h.installed}
                            </Chip>
                        )}
                        <Typography
                            level="body-xs"
                            sx={{
                                color: "text.tertiary",
                                minWidth: 0,
                                // At most two short lines inside the fixed footer: a long locale
                                // wraps next to the marker instead of cutting the versions off.
                                lineHeight: 1.3,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                            }}
                        >
                            {skill.updateAvailable
                                ? fmt(l.installedBehind, {
                                      from: installed,
                                      to: skill.publishedVersionNo,
                                  })
                                : fmt(l.installedUpToDate, { n: installed })}
                        </Typography>
                    </Box>
                )}
            </Box>
            <Box sx={{ p: 1, flexShrink: 0 }}>
                <MoreMenu
                    ariaLabel={fmt(l.actionsAria, { name })}
                    items={items}
                    placement="bottom-end"
                    triggerSize={32}
                />
            </Box>
        </Box>
    );
};
