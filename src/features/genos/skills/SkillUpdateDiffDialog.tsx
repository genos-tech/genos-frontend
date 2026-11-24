import { useCallback, useEffect, useMemo, useState } from "react";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Typography } from "@mui/joy";

import { visuallyHidden } from "../../../components/ui/a11y/visuallyHidden";
import { toast } from "../../../components/ui/feedback/toastStore";
import { ConfirmDialog } from "../../../components/ui/modal/ConfirmDialog";
import { useAuth } from "../../../context/authState";
import { fmt, useTranslation } from "../../../i18n";
import { g, type } from "../../../theme/tokens";
import { GENOS_MEMORY_CONFIRM_Z_INDEX } from "../memory/confirmLayer";
import { diffLineKind, type DiffLineKind } from "./skillDiffLines";
import {
    acceptSkillUpdate,
    fetchUpdateDiff,
    type UpdateChange,
    type UpdateDiff,
} from "./skillsApi";

type Props = {
    /** The installed skill whose update is offered, or null while the dialog is closed. */
    skill: { id: string; title: string } | null;
    onClose: () => void;
    /** After the update was accepted: the version now installed. */
    onUpdated?: (installedVersionNo: number) => void;
};

/** More lines than this are not drawn (the server cuts the diff itself; this is the page's own cap). */
const MAX_DIFF_LINES = 1500;

const LINE_STYLE: Record<DiffLineKind, { background: string; color: string }> = {
    add: { background: g.success.subtle, color: g.success.text },
    del: { background: g.danger.subtle, color: g.danger.text },
    meta: { background: "transparent", color: g.text.tertiary },
    ctx: { background: "transparent", color: g.text.primary },
};

/**
 * "Update available" for an installed public skill (MIP-2192): what the author's new version
 * changes, before it replaces the one the person runs. Shows the author's changelogs, the changed
 * details, and the text as a unified diff in a monospace block, added and removed lines coloured
 * with theme tokens AND marked `+` / `-`. A version that raises the skill from reading to proposing
 * changes is flagged first and prominently. "Update" installs exactly the version the diff ended at;
 * if the author published another one meanwhile the server says so and the diff reloads.
 *
 * All text is drawn as plain text, never parsed.
 */
export const SkillUpdateDiffDialog = ({ skill, onClose, onUpdated }: Props) => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const r = t.settings.genosSkills.updateDiff;
    const f = t.settings.genosSkills.fields;
    const [diff, setDiff] = useState<UpdateDiff | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const skillId = skill?.id ?? null;

    const load = useCallback(
        async (isCurrent: () => boolean) => {
            if (!skillId) return;
            const res = await fetchUpdateDiff(accessToken, skillId);
            if (!isCurrent()) return;
            if (res.ok) {
                setDiff(res.data);
                setLoadError(null);
            } else {
                setDiff(null);
                setLoadError(r.loadFailed);
            }
        },
        [accessToken, skillId, r.loadFailed]
    );

    useEffect(() => {
        setDiff(null);
        setLoadError(null);
        setNotice(null);
        setError(null);
        if (!skillId) return;
        let current = true;
        void load(() => current);
        return () => {
            current = false;
        };
    }, [skillId, load]);

    const lines = useMemo(() => {
        if (!diff || diff.diff === "") return [];
        return diff.diff.replace(/\n$/, "").split("\n").slice(0, MAX_DIFF_LINES);
    }, [diff]);
    const cutByPage = diff ? diff.diff.split("\n").length > MAX_DIFF_LINES + 1 : false;

    const accept = async () => {
        if (!skill || !diff || diff.upToDate) return false;
        setError(null);
        setNotice(null);
        const res = await acceptSkillUpdate(accessToken, skill.id, diff.toVersionNo);
        if (res.ok) {
            toast.success(fmt(r.updated, { n: res.data.installedVersionNo }));
            onUpdated?.(res.data.installedVersionNo);
            onClose();
            return true;
        }
        if (res.code === "update_moved") {
            // The author published another version while this was open: show what it changes now.
            setNotice(r.moved);
            await load(() => true);
            return false;
        }
        setError(r.updateFailed);
        return false;
    };

    const valueText = (change: UpdateChange, value: string): string => {
        if (value === "") return change.field === "effort" ? f.effortAuto : r.none;
        if (change.field === "toolLevel") return value === "act" ? f.toolAct : f.toolRead;
        if (change.field === "effort") {
            if (value === "low") return f.effortLow;
            if (value === "medium") return f.effortMedium;
            if (value === "high") return f.effortHigh;
        }
        return value;
    };

    const fieldLabel: Record<UpdateChange["field"], string> = {
        title: f.title,
        description: f.description,
        tags: f.tags,
        argumentHint: f.argumentHint,
        effort: f.effort,
        language: r.language,
        slug: f.slug,
        toolLevel: f.toolLevel,
    };

    return (
        <ConfirmDialog
            confirmDisabled={diff === null || diff.upToDate}
            confirmLabel={diff ? fmt(r.update, { n: diff.toVersionNo }) : r.updateGeneric}
            entityName={skill?.title}
            error={error}
            open={skill !== null}
            size="lg"
            title={r.title}
            zIndex={GENOS_MEMORY_CONFIRM_Z_INDEX}
            cancelLabel={
                diff ? (diff.upToDate ? r.close : fmt(r.keep, { n: diff.fromVersionNo })) : r.close
            }
            description={
                diff && !diff.upToDate
                    ? fmt(r.versions, { from: diff.fromVersionNo, to: diff.toVersionNo })
                    : undefined
            }
            onClose={onClose}
            onConfirm={accept}
        >
            {diff === null && (
                <Typography
                    level="body-sm"
                    role={loadError ? "alert" : "status"}
                    sx={{ color: loadError ? g.danger.text : g.text.secondary }}
                >
                    {loadError ?? r.loading}
                </Typography>
            )}
            {notice && (
                <Alert color="neutral" role="status" size="sm" sx={{ mb: 1.5 }}>
                    {notice}
                </Alert>
            )}
            {diff?.upToDate && (
                <Typography level="body-sm" role="status" sx={{ color: g.text.secondary }}>
                    {r.upToDate}
                </Typography>
            )}
            {diff && !diff.upToDate && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
                    {diff.toolLevelRaised && (
                        <Alert
                            color="warning"
                            role="alert"
                            size="md"
                            startDecorator={<WarningAmberIcon />}
                            sx={{ overflowWrap: "anywhere", alignItems: "flex-start" }}
                            variant="soft"
                        >
                            <Box>
                                <Typography level="title-sm">{r.toolRaisedTitle}</Typography>
                                <Typography level="body-sm">{r.toolRaised}</Typography>
                            </Box>
                        </Alert>
                    )}
                    {diff.needsConfirmation && (
                        <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                            {r.needsConfirmation}
                        </Typography>
                    )}
                    {diff.changelogs.length > 0 && (
                        <Box>
                            <Typography
                                id="skill-update-changelogs"
                                level="title-sm"
                                sx={{ mb: 0.5 }}
                            >
                                {r.changelogsLabel}
                            </Typography>
                            <Box component="ul" sx={{ m: 0, ps: 2.5, ...type("body-sm") }}>
                                {diff.changelogs.map((entry) => (
                                    <li key={entry.versionNo} style={{ overflowWrap: "anywhere" }}>
                                        <Box component="span" sx={{ color: g.text.secondary }}>
                                            {fmt(r.versionShort, { n: entry.versionNo })}:
                                        </Box>{" "}
                                        {entry.changelog || r.noChangelog}
                                    </li>
                                ))}
                            </Box>
                        </Box>
                    )}
                    {diff.changes.length > 0 && (
                        <Box>
                            <Typography
                                id="skill-update-changes"
                                level="title-sm"
                                sx={{ mb: 0.5 }}
                            >
                                {r.changesLabel}
                            </Typography>
                            <Box
                                component="ul"
                                sx={{ m: 0, p: 0, listStyle: "none", ...type("body-sm") }}
                            >
                                {diff.changes.map((change) => (
                                    <Box
                                        key={change.field}
                                        component="li"
                                        sx={{ py: 0.5, overflowWrap: "anywhere" }}
                                    >
                                        <Box component="span" sx={{ color: g.text.secondary }}>
                                            {fieldLabel[change.field]}:
                                        </Box>{" "}
                                        <Box component="del" sx={{ color: g.danger.text }}>
                                            {valueText(change, change.from)}
                                        </Box>{" "}
                                        <span aria-hidden="true">→</span>
                                        <span style={visuallyHidden}> {r.becomes} </span>{" "}
                                        <Box
                                            component="ins"
                                            sx={{ color: g.success.text, textDecoration: "none" }}
                                        >
                                            {valueText(change, change.to)}
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    )}
                    <Box>
                        <Typography id="skill-update-diff" level="title-sm" sx={{ mb: 0.5 }}>
                            {r.diffLabel}
                        </Typography>
                        {lines.length === 0 ? (
                            <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                                {r.diffEmpty}
                            </Typography>
                        ) : (
                            <Box
                                aria-labelledby="skill-update-diff"
                                component="pre"
                                dir="ltr"
                                role="region"
                                tabIndex={0}
                                sx={{
                                    ...type("body-sm"),
                                    m: 0,
                                    py: 0.5,
                                    maxHeight: { xs: 240, sm: 320 },
                                    overflow: "auto",
                                    overscrollBehavior: "contain",
                                    fontFamily: g.font.mono,
                                    border: `1px solid ${g.border.subtle}`,
                                    borderRadius: g.radius.md,
                                    background: g.surface.default,
                                    "&:focus-visible": {
                                        outline: `2px solid ${g.focus}`,
                                        outlineOffset: 2,
                                    },
                                }}
                            >
                                {/* One wrapper as wide as the longest line, so every line's tint
                                    reaches the end when the block is scrolled sideways. */}
                                <Box sx={{ minWidth: "100%", width: "max-content" }}>
                                    {lines.map((line, index) => (
                                        <Box
                                            key={index}
                                            component="div"
                                            data-diff={diffLineKind(line)}
                                            sx={{
                                                px: 1.25,
                                                whiteSpace: "pre",
                                                ...LINE_STYLE[diffLineKind(line)],
                                            }}
                                        >
                                            {line === "" ? " " : line}
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        )}
                        {(diff.truncated || cutByPage) && (
                            <Typography level="body-xs" sx={{ mt: 0.5, color: g.text.secondary }}>
                                {r.truncated}
                            </Typography>
                        )}
                    </Box>
                </Box>
            )}
        </ConfirmDialog>
    );
};
