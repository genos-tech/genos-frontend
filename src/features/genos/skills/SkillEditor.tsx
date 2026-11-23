import { useCallback, useEffect, useRef, useState } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import { Alert, Box, Button, Sheet, Stack, Typography } from "@mui/joy";

import { EmptyState } from "../../../components/ui/feedback/EmptyState";
import { ErrorState } from "../../../components/ui/feedback/ErrorState";
import { SkeletonRows } from "../../../components/ui/feedback/Skeleton";
import { toast } from "../../../components/ui/feedback/toastStore";
import { ConfirmDialog } from "../../../components/ui/modal/ConfirmDialog";
import { useAuth } from "../../../context/authState";
import { fmt, useTranslation } from "../../../i18n";
import { GENOS_MEMORY_CONFIRM_Z_INDEX } from "../memory/confirmLayer";
import { SkillBodyEditor, type SkillBodyEditorHandle } from "./SkillBodyEditor";
import { SkillDetailsForm } from "./SkillDetailsForm";
import {
    draftChanges,
    draftFrom,
    hasProblems,
    isDirty,
    validateDraft,
    type SkillDraft,
} from "./skillDraft";
import { syncSkillNoteTitle } from "./skillNoteTitle";
import { SkillReportDialog } from "./SkillReportDialog";
import {
    copySkill,
    deleteSkill,
    fetchSkill,
    fetchSkillVersions,
    isModerated,
    publishSkill,
    updateSkill,
    type Failure,
    type SkillRow,
    type SkillVersion,
} from "./skillsApi";
import type { SkillsHost } from "./skillsHost";
import { slugify } from "./skillText";

type Props = {
    skillId: string;
    teamId: string;
    host: SkillsHost;
    /** Back to the list. `changed` = something was saved, copied or deleted: read the list again. */
    onBack: (changed: boolean) => void;
};

type ServerProblems = Partial<Record<"title" | "slug" | "description" | "tags", string>>;

/** Which field a server sentence is about, from the words it uses. Anything else is general. */
const fieldOf = (message: string): keyof ServerProblems | null => {
    const m = message.toLowerCase();
    if (/\b(name|slug)\b/.test(m)) return "slug";
    if (m.includes("title")) return "title";
    if (m.includes("description")) return "description";
    if (m.includes("tag")) return "tags";
    return null;
};

/** The name follows the title only on a skill that was just made and not yet titled by its
 *  author: a name people already type is never rewritten by a title edit (the server refuses to
 *  "fix" names for the same reason). */
const followsTitle = (skill: SkillRow, defaultTitle: string): boolean =>
    skill.title === defaultTitle && skill.publishedVersionNo === 0;

/**
 * One skill: its details, its instructions (the note editor) and, for a team skill, its
 * versions. One column at every width: the Settings dialog is too narrow for the editor to
 * share a row with the form.
 *
 * The instructions are a note, so they save themselves. The details are a form with a Save
 * button, so a half-typed name never reaches the server. A TEAM skill's readers see the last
 * PUBLISHED version, and the editor's own autosave does not publish: the Publish button does.
 */
export const SkillEditor = ({ skillId, teamId, host, onBack }: Props) => {
    const { t, locale } = useTranslation();
    const m = t.settings.genosSkills;
    const e = m.editor;
    const defaultTitle = m.newDefaultTitle;
    const { accessToken } = useAuth();

    const [skill, setSkill] = useState<SkillRow | null>(null);
    const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">("loading");
    const [draft, setDraft] = useState<SkillDraft | null>(null);
    const [slugFollows, setSlugFollows] = useState(false);
    const [problemsShown, setProblemsShown] = useState(false);
    const [serverProblems, setServerProblems] = useState<ServerProblems>({});
    const [notice, setNotice] = useState<string | null>(null);
    const [reporting, setReporting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [versions, setVersions] = useState<SkillVersion[] | null>(null);
    const [versionsFailed, setVersionsFailed] = useState(false);
    const [changed, setChanged] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [bodyEdited, setBodyEdited] = useState(false);
    const bodyRef = useRef<SkillBodyEditorHandle>(null);

    const load = useCallback(async () => {
        setLoadState("loading");
        const res = await fetchSkill(accessToken, skillId);
        if (!res.ok) {
            setLoadState("failed");
            return;
        }
        setSkill(res.data);
        setDraft(draftFrom(res.data));
        setSlugFollows(followsTitle(res.data, defaultTitle));
        setLoadState("ready");
    }, [accessToken, skillId, defaultTitle]);

    useEffect(() => {
        // Loading is a fetch whose answer sets the state; the first render has nothing to draw.
        void load();
    }, [load]);

    const published = skill?.visibility === "team" || (skill?.publishedVersionNo ?? 0) > 0;
    const loadVersions = useCallback(async () => {
        const res = await fetchSkillVersions(accessToken, skillId);
        setVersionsFailed(!res.ok);
        setVersions(res.ok ? res.data : []);
    }, [accessToken, skillId]);
    useEffect(() => {
        // Only a skill that has readers has versions worth listing.
        if (skill && published) void loadVersions();
    }, [skill, published, loadVersions]);

    if (loadState === "loading") {
        return <SkeletonRows count={4} label={m.list.loading} />;
    }
    if (loadState === "failed" || !skill || !draft) {
        return (
            <Stack spacing={1.5}>
                <BackButton label={e.back} onClick={() => onBack(changed)} />
                <ErrorState size="sm" title={e.loadFailed} onRetry={() => void load()} />
            </Stack>
        );
    }

    const editable = skill.canEdit && skill.noteId !== null;
    const dirty = isDirty(draft, skill);
    const problems = validateDraft(draft);

    const setField = (next: Partial<SkillDraft>) => {
        setNotice(null);
        setServerProblems({});
        setDraft((prev) => {
            if (!prev) return prev;
            const merged = { ...prev, ...next };
            if ("slug" in next) setSlugFollows(false);
            else if ("title" in next && slugFollows) {
                const auto = slugify(merged.title);
                if (auto !== "") merged.slug = auto;
            }
            return merged;
        });
    };

    const showFailure = (res: Failure, fallback: string) => {
        if (res.reason === "limit") {
            setNotice(fmt(m.problems.limit, { limit: res.limit ?? 0, used: res.used ?? 0 }));
            return;
        }
        if (res.reason === "conflict") {
            setServerProblems({ slug: m.problems.slugTaken });
            return;
        }
        const field = res.message ? fieldOf(res.message) : null;
        if (field) setServerProblems({ [field]: res.message });
        else setNotice(res.message || fallback);
    };

    /** Resolves true when the details are saved (or there was nothing to save). */
    const save = async (): Promise<boolean> => {
        if (!editable || saving || publishing) return false;
        if (hasProblems(problems)) {
            setProblemsShown(true);
            return false;
        }
        const changes = draftChanges(draft, skill);
        if (Object.keys(changes).length === 0) return true;
        setSaving(true);
        setNotice(null);
        setServerProblems({});
        // A TEAM skill cuts a version from the saved text whenever its details change (the API's
        // rule), so the editor's pending autosave must land first or that version misses it.
        await bodyRef.current?.flush();
        const res = await updateSkill(accessToken, skill.id, changes);
        setSaving(false);
        if (!res.ok) {
            showFailure(res, e.saveFailed);
            return false;
        }
        setSkill(res.data);
        setDraft(draftFrom(res.data));
        setSlugFollows(false);
        setProblemsShown(false);
        setChanged(true);
        // For a team skill that save sent the current text to the readers too.
        if (res.data.visibility === "team") {
            setBodyEdited(false);
            void loadVersions();
        }
        if (skill.noteId !== null) syncSkillNoteTitle(skill.noteId, res.data.title);
        toast.success(e.saved);
        return true;
    };

    const publish = async () => {
        if (!editable || publishing || saving) return;
        // The server cuts the version from the SAVED details: save what is on screen first.
        if (dirty && !(await save())) return;
        setPublishing(true);
        setNotice(null);
        await bodyRef.current?.flush();
        const res = await publishSkill(accessToken, skill.id);
        setPublishing(false);
        if (res.ok) {
            setChanged(true);
            setBodyEdited(false);
            toast.success(fmt(e.published, { n: res.data.versionNo }));
            void loadVersions();
            void fetchSkill(accessToken, skill.id).then((r) => r.ok && setSkill(r.data));
        } else if (res.reason === "conflict") {
            toast.neutral(e.upToDate);
            void fetchSkill(accessToken, skill.id).then((r) => r.ok && setSkill(r.data));
        } else {
            setNotice(res.message || e.publishFailed);
        }
    };

    const copy = async () => {
        const res = await copySkill(accessToken, skill.id, teamId);
        if (res.ok) {
            toast.success(m.list.copied);
            onBack(true);
        } else if (res.reason === "limit") {
            toast.error(fmt(m.problems.limit, { limit: res.limit ?? 0, used: res.used ?? 0 }));
        } else {
            toast.error(res.message || m.list.copyFailed);
        }
    };

    const remove = async () => {
        const res = await deleteSkill(accessToken, skill.id);
        if (!res.ok) {
            setDeleteError(res.message || m.delete.failed);
            return false;
        }
        setConfirmDelete(false);
        onBack(true);
        return true;
    };

    const back = async () => {
        if (dirty) {
            setConfirmLeave(true);
            return;
        }
        // The note saves a moment after the last keystroke: send it before the editor goes away.
        await bodyRef.current?.flush();
        onBack(changed);
    };

    const savedTeam = skill.visibility === "team";

    return (
        <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 1,
                    minWidth: 0,
                }}
            >
                <BackButton label={e.back} onClick={() => void back()} />
                <Box sx={{ flex: 1, minWidth: 0 }} />
                {editable ? (
                    <>
                        {savedTeam && (
                            <Button
                                disabled={saving}
                                loading={publishing}
                                size="sm"
                                variant={dirty ? "outlined" : "solid"}
                                onClick={() => void publish()}
                            >
                                {bodyEdited || skill.publishedVersionNo > 0
                                    ? e.publishChanges
                                    : e.publish}
                            </Button>
                        )}
                        <Button
                            disabled={!dirty || publishing}
                            loading={saving}
                            size="sm"
                            variant={dirty ? "solid" : "outlined"}
                            onClick={() => void save()}
                        >
                            {e.save}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            size="sm"
                            startDecorator={<FlagOutlinedIcon />}
                            variant="plain"
                            onClick={() => setReporting(true)}
                        >
                            {m.report.action}
                        </Button>
                        <Button
                            size="sm"
                            startDecorator={<ContentCopyRoundedIcon />}
                            variant="solid"
                            onClick={() => void copy()}
                        >
                            {m.list.copy}
                        </Button>
                    </>
                )}
            </Box>

            {notice && (
                <Alert color="danger" role="alert" size="sm" variant="soft">
                    {notice}
                </Alert>
            )}
            {skill.mine && isModerated(skill.status) && (
                <Alert color="warning" role="status" size="sm" variant="soft">
                    <Box>
                        <Typography level="title-sm">
                            {m.moderation.title[skill.status as keyof typeof m.moderation.title]}
                        </Typography>
                        {skill.moderationReason && (
                            <Typography level="body-sm">
                                {fmt(m.moderation.reason, { reason: skill.moderationReason })}
                            </Typography>
                        )}
                    </Box>
                </Alert>
            )}
            {!editable && (
                <Alert color="neutral" size="sm" variant="soft">
                    {e.readOnly}
                </Alert>
            )}
            {dirty && editable && (
                <Typography level="body-xs" role="status" sx={{ color: "text.tertiary" }}>
                    {e.unsavedBody}
                </Typography>
            )}

            <Sheet
                sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: "lg", minWidth: 0 }}
                variant="outlined"
            >
                <Typography level="title-md" sx={{ mb: 1.5 }}>
                    {e.details}
                </Typography>
                <SkillDetailsForm
                    disabled={!editable}
                    draft={draft}
                    problems={problemsShown ? problems : {}}
                    serverProblems={serverProblems}
                    skill={skill}
                    onChange={setField}
                />
            </Sheet>

            <Box sx={{ minWidth: 0 }}>
                <Typography level="title-md">{e.bodyHeading}</Typography>
                <Typography level="body-xs" sx={{ mb: 1, color: "text.tertiary" }}>
                    {e.bodyHint}
                </Typography>
                <Sheet
                    aria-label={e.bodyAria}
                    role="group"
                    variant="outlined"
                    sx={{
                        borderRadius: "lg",
                        minWidth: 0,
                        overflow: "hidden",
                        p: { xs: 0.5, sm: 1 },
                    }}
                >
                    {skill.noteId !== null && editable ? (
                        <SkillBodyEditor
                            handleRef={bodyRef}
                            myself={host.myself}
                            noteId={skill.noteId}
                            setMyself={host.setMyself}
                            socket={host.socket}
                            teamId={skill.teamId}
                            title={skill.title}
                            useCM={host.useCM}
                            useTEM={host.useTEM}
                            useUISM={host.useUISM}
                            onEdited={() => setBodyEdited(true)}
                        />
                    ) : (
                        <Typography
                            level="body-sm"
                            sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", p: 1 }}
                        >
                            {skill.bodyMarkdown}
                        </Typography>
                    )}
                </Sheet>
            </Box>

            {published && (
                <Sheet
                    sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: "lg", minWidth: 0 }}
                    variant="outlined"
                >
                    <Typography level="title-md" sx={{ mb: 1 }}>
                        {m.versions.heading}
                    </Typography>
                    {versions === null ? (
                        <SkeletonRows count={2} label={m.versions.loading} />
                    ) : versionsFailed ? (
                        <Typography level="body-sm" sx={{ color: "danger.plainColor" }}>
                            {m.versions.failed}
                        </Typography>
                    ) : versions.length === 0 ? (
                        <EmptyState size="sm" title={m.versions.empty} />
                    ) : (
                        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                            {versions.map((v) => (
                                <Box
                                    key={v.versionNo}
                                    component="li"
                                    sx={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        columnGap: 1.5,
                                        py: 0.75,
                                        borderTop: "1px solid",
                                        borderColor: "divider",
                                        "&:first-of-type": { borderTop: "none" },
                                    }}
                                >
                                    <Typography level="body-sm" sx={{ fontWeight: 500 }}>
                                        {fmt(m.versions.row, { n: v.versionNo })}
                                    </Typography>
                                    <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                                        {v.createdAt
                                            ? new Date(v.createdAt).toLocaleString(locale, {
                                                  dateStyle: "medium",
                                                  timeStyle: "short",
                                              })
                                            : ""}
                                    </Typography>
                                    {v.changelog && (
                                        <Typography
                                            level="body-xs"
                                            sx={{ flexBasis: "100%", overflowWrap: "anywhere" }}
                                        >
                                            {v.changelog}
                                        </Typography>
                                    )}
                                </Box>
                            ))}
                        </Box>
                    )}
                </Sheet>
            )}

            {editable && (
                <Box>
                    <Button
                        color="danger"
                        size="sm"
                        startDecorator={<DeleteOutlineRoundedIcon />}
                        variant="outlined"
                        onClick={() => {
                            setDeleteError(null);
                            setConfirmDelete(true);
                        }}
                    >
                        {m.delete.button}
                    </Button>
                </Box>
            )}

            <ConfirmDialog
                cancelLabel={t.common.actions.cancel}
                confirmLabel={m.delete.confirm}
                description={m.delete.body}
                entityName={skill.title}
                error={deleteError}
                open={confirmDelete}
                title={m.delete.title}
                zIndex={GENOS_MEMORY_CONFIRM_Z_INDEX}
                destructive
                onClose={() => setConfirmDelete(false)}
                onConfirm={remove}
            />
            <SkillReportDialog
                skill={reporting ? { id: skill.id, title: skill.title } : null}
                onClose={() => setReporting(false)}
            />
            <ConfirmDialog
                cancelLabel={t.common.actions.cancel}
                confirmLabel={e.discardConfirm}
                description={e.discardBody}
                open={confirmLeave}
                title={e.discardTitle}
                zIndex={GENOS_MEMORY_CONFIRM_Z_INDEX}
                destructive
                onClose={() => setConfirmLeave(false)}
                onConfirm={() => {
                    setConfirmLeave(false);
                    onBack(changed);
                }}
            />
        </Stack>
    );
};

const BackButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <Button
        size="sm"
        startDecorator={<ArrowBackRoundedIcon />}
        sx={{ alignSelf: "flex-start" }}
        variant="plain"
        onClick={onClick}
    >
        {label}
    </Button>
);
