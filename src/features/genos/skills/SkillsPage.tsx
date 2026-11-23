import { useCallback, useEffect, useRef, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
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
import { GENOS_MEMORY_CONFIRM_Z_INDEX } from "../memory/confirmLayer";
import { SkillEditor } from "./SkillEditor";
import { SkillReportDialog } from "./SkillReportDialog";
import {
    copySkill,
    createSkill,
    deleteSkill,
    fetchSkills,
    setSkillHidden,
    isModerated,
    type SkillList,
    type SkillRow,
    type SkillTab,
} from "./skillsApi";
import type { SkillsHost } from "./skillsHost";
import { templateBody } from "./skillText";

type Props = {
    teamId: string;
    host: SkillsHost;
};

type View = { kind: "list" } | { kind: "edit"; id: string };
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
export const SkillsPage = ({ teamId, host }: Props) => {
    const { t, locale } = useTranslation();
    const m = t.settings.genosSkills;
    const { accessToken } = useAuth();
    const [view, setView] = useState<View>({ kind: "list" });
    const [tab, setTab] = useState<SkillTab>("mine");
    const [list, setList] = useState<ListState>({ status: "loading" });
    const [limitHit, setLimitHit] = useState<{ limit: number; used: number } | null>(null);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<SkillRow | null>(null);
    const [reporting, setReporting] = useState<SkillRow | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Only the newest request may set the list: a slow answer for the tab left behind must not
    // be drawn under the tab now open.
    const latest = useRef(0);
    const load = useCallback(
        async (which: SkillTab) => {
            const mine = ++latest.current;
            setList({ status: "loading" });
            const res = await fetchSkills(accessToken, teamId, which);
            if (mine !== latest.current) return;
            setList(res.ok ? { status: "ready", data: res.data } : { status: "failed" });
        },
        [accessToken, teamId]
    );

    useEffect(() => {
        if (view.kind !== "list") return;
        // The list is a fetch whose answer sets the state; the first render has nothing to draw.
        void load(tab);
    }, [load, tab, view.kind]);

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
        void load(tab);
    };

    const remove = async () => {
        if (!deleting) return false;
        const res = await deleteSkill(accessToken, deleting.id);
        if (!res.ok) {
            setDeleteError(res.message || m.delete.failed);
            return false;
        }
        setDeleting(null);
        void load(tab);
        return true;
    };

    if (view.kind === "edit") {
        return (
            <SkillEditor
                host={host}
                skillId={view.id}
                teamId={teamId}
                onBack={() => setView({ kind: "list" })}
            />
        );
    }

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
                    sx={{ bgcolor: "transparent", minWidth: 0 }}
                    value={tab}
                    onChange={(_e, value) => setTab(value as SkillTab)}
                >
                    <TabList sx={{ gap: 0.5 }} disableUnderline>
                        <Tab value="mine" variant={tab === "mine" ? "soft" : "plain"}>
                            {m.tabs.mine}
                        </Tab>
                        <Tab value="team" variant={tab === "team" ? "soft" : "plain"}>
                            {m.tabs.team}
                        </Tab>
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

            {limitNote && (
                <Alert color="warning" size="sm" variant="soft">
                    {fmt(m.list.limitReached, limitNote)}
                </Alert>
            )}

            {list.status === "loading" ? (
                <SkeletonRows count={3} label={m.list.loading} />
            ) : list.status === "failed" ? (
                <ErrorState
                    data-error="genos-skills"
                    size="sm"
                    title={m.list.loadFailed}
                    onRetry={() => void load(tab)}
                />
            ) : list.data.skills.length === 0 ? (
                <EmptyState
                    body={tab === "mine" ? m.list.emptyMineBody : m.list.emptyTeamBody}
                    data-empty="genos-skills"
                    size="sm"
                    title={tab === "mine" ? m.list.emptyMineTitle : m.list.emptyTeamTitle}
                    action={
                        tab === "mine" && !full
                            ? {
                                  label: m.newTemplate,
                                  onClick: () => void create(true),
                                  icon: <ArticleOutlinedIcon />,
                              }
                            : undefined
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
                            skill={skill}
                            when={
                                skill.updatedAt
                                    ? relativeTimeLabel(skill.updatedAt, t.spotlight, locale)
                                    : ""
                            }
                            onCopy={() => void copy(skill)}
                            onOpen={() => setView({ kind: "edit", id: skill.id })}
                            onToggleHidden={() => void toggleHidden(skill)}
                            onReport={() => setReporting(skill)}
                            onDelete={() => {
                                setDeleteError(null);
                                setDeleting(skill);
                            }}
                        />
                    ))}
                </Box>
            )}
            {data && data.limit !== null && tab === "mine" && (
                <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                    {fmt(m.list.usage, { used: data.used, limit: data.limit })}
                </Typography>
            )}

            <SkillReportDialog
                skill={reporting ? { id: reporting.id, title: reporting.title } : null}
                onClose={() => setReporting(null)}
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
    when: string;
    onOpen: () => void;
    onCopy: () => void;
    onToggleHidden: () => void;
    onReport: () => void;
    onDelete: () => void;
};

const SkillListItem = ({
    skill,
    when,
    onOpen,
    onCopy,
    onToggleHidden,
    onReport,
    onDelete,
}: ItemProps) => {
    const { t } = useTranslation();
    const l = t.settings.genosSkills.list;
    const tm = t.settings.genosSkills.team;
    const name = skill.title || t.settings.genosSkills.untitled;
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
            visible: !skill.mine && skill.visibility !== "private" && !skill.hiddenByTeam,
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
            <PlainButton
                aria-label={name}
                sx={{
                    flex: 1,
                    minWidth: 0,
                    display: "block",
                    textAlign: "start",
                    p: 1.5,
                    borderRadius: "lg",
                }}
                onClick={onOpen}
            >
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}>
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
                        {skill.visibility === "team" ? l.team : l.private}
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
                    {skill.mine && isModerated(skill.status) && (
                        <Chip color="warning" size="sm" variant="soft">
                            {l.moderated[skill.status as keyof typeof l.moderated]}
                        </Chip>
                    )}
                    {skill.mine && skill.visibility === "team" && (
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
                        {skill.tags.map((tag) => (
                            <Chip key={tag} size="sm" variant="outlined">
                                {tag}
                            </Chip>
                        ))}
                    </Box>
                )}
                <Typography level="body-xs" sx={{ mt: 0.75, color: "text.tertiary" }}>
                    {[
                        !skill.mine && skill.ownerName ? fmt(l.by, { name: skill.ownerName }) : "",
                        when ? fmt(l.updated, { when }) : "",
                    ]
                        .filter(Boolean)
                        .join(" · ")}
                </Typography>
            </PlainButton>
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
