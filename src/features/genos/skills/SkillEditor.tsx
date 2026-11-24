import { useCallback, useEffect, useRef, useState } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import RemoveCircleOutlineRoundedIcon from "@mui/icons-material/RemoveCircleOutlineRounded";
import { Alert, Box, Button, Chip, Sheet, Stack, Typography } from "@mui/joy";

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
import { SkillEditorsField } from "./SkillEditorsField";
import { SkillHubField, SkillHubStrip } from "./SkillHubField";
import { syncSkillNoteTitle } from "./skillNoteTitle";
import { SkillPublishDialog } from "./SkillPublishDialog";
import { SkillReportDialog } from "./SkillReportDialog";
import {
    copySkill,
    deleteSkill,
    fetchSkill,
    fetchSkillVersions,
    installSkill,
    isModerated,
    publishSkill,
    setSkillHidden,
    setSkillStar,
    uninstallSkill,
    updateSkill,
    type Failure,
    type SkillRow,
    type SkillVersion,
} from "./skillsApi";
import { SkillSharesField } from "./SkillSharesField";
import type { SkillsHost } from "./skillsHost";
import { slugify } from "./skillText";

type Props = {
    skillId: string;
    teamId: string;
    host: SkillsHost;
    /** The server's `GENOS_SKILLS_PUBLIC` switch: only then is "Publish to the Hub" offered. */
    publicEnabled?: boolean;
    /** Back to the list. `changed` = something was saved, copied or deleted: read the list again. */
    onBack: (changed: boolean) => void;
};

type ServerProblems = Partial<Record<"title" | "slug" | "description" | "tags", string>>;

/** Shared with people other than the owner, through a published version (not public). */
const isSharedWithPeople = (visibility: string): boolean =>
    visibility === "team" || visibility === "specific";

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
 * PUBLISHED version: neither Save nor the note's autosave publishes (MIP-2177), they only keep the
 * owner's draft. The "Publish changes" button makes the new version, and is enabled only while the
 * draft differs from the published one.
 */
export const SkillEditor = ({ skillId, teamId, host, publicEnabled = false, onBack }: Props) => {
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
    const [installing, setInstalling] = useState(false);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [versions, setVersions] = useState<SkillVersion[] | null>(null);
    const [versionsFailed, setVersionsFailed] = useState(false);
    const [changed, setChanged] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [confirmPrivate, setConfirmPrivate] = useState(false);
    const [hiding, setHiding] = useState(false);
    const [publishingToHub, setPublishingToHub] = useState(false);
    const [confirmUnpublish, setConfirmUnpublish] = useState(false);
    const [unpublishError, setUnpublishError] = useState<string | null>(null);
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

    const published =
        (skill?.visibility ?? "private") !== "private" || (skill?.publishedVersionNo ?? 0) > 0;
    const loadVersions = useCallback(async () => {
        const res = await fetchSkillVersions(accessToken, skillId);
        setVersionsFailed(!res.ok);
        setVersions(res.ok ? res.data : []);
    }, [accessToken, skillId]);
    const loaded = skill !== null;
    useEffect(() => {
        // Only a skill that has readers has versions worth listing. A save keeps a draft and
        // cuts no version, so a changed skill row is no reason to read the list again: publishing
        // and sharing do it themselves.
        if (loaded && published) void loadVersions();
    }, [loaded, published, loadVersions]);

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

    // Manage tags renamed or deleted a tag: the server already rewrote the owner's saved tags (and
    // so a shared skill now differs from its published version). The draft is rewritten the same
    // way, without losing what else was typed, and the saved row is read again so "unpublished
    // changes" and the chips are the server's, not a guess.
    const rewriteTag = (name: string, next: string | null) => {
        const swap = (tags: string[]) => [
            ...new Set(tags.flatMap((x) => (x !== name ? [x] : next !== null ? [next] : []))),
        ];
        setChanged(true); // the list reads the new names again when the person goes back
        setDraft((prev) => (prev ? { ...prev, tags: swap(prev.tags) } : prev));
        void fetchSkill(accessToken, skillId).then((res) => {
            if (res.ok) setSkill(res.data);
        });
    };

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
        if (res.code === "name_taken") {
            // The server says where the name clashes (yours, the team's, the public ones).
            setServerProblems({ slug: res.message || m.problems.slugTaken });
            return;
        }
        const field = res.message ? fieldOf(res.message) : null;
        if (field) setServerProblems({ [field]: res.message });
        else setNotice(res.message || fallback);
    };

    /** Resolves true when the details are saved (or there was nothing to save). `sureAboutPrivate`
     *  = the person already confirmed taking a team skill back from the team. */
    const save = async (sureAboutPrivate = false): Promise<boolean> => {
        if (!editable || saving || publishing) return false;
        if (hasProblems(problems)) {
            setProblemsShown(true);
            return false;
        }
        const changes = draftChanges(draft, skill);
        if (Object.keys(changes).length === 0) return true;
        if (
            !sureAboutPrivate &&
            (skill.visibility === "team" || skill.visibility === "specific") &&
            changes.visibility === "private"
        ) {
            // The readers stop reading and running it at once: say so before it happens.
            setConfirmPrivate(true);
            return false;
        }
        setSaving(true);
        setNotice(null);
        setServerProblems({});
        // The draft's text and details belong together: land the editor's pending autosave first
        // so what "Unpublished changes" reports and what Publish sends is what is on screen.
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
        if (skill.noteId !== null) syncSkillNoteTitle(skill.noteId, res.data.title);
        if (skill.visibility === "private" && isSharedWithPeople(res.data.visibility)) {
            // Choosing "My team" or "Specific people" is the explicit share: the server published
            // the current text.
            setBodyEdited(false);
            toast.success(fmt(e.published, { n: res.data.publishedVersionNo }));
            // A skill that was shared before still has its versions on screen: add the new one.
            // (One that was never shared loads them when it becomes shared.)
            if (published) void loadVersions();
        } else {
            // A team skill's save keeps the edit private; a private skill has nobody to hide it from.
            toast.success(isSharedWithPeople(res.data.visibility) ? e.savedDraft : e.saved);
        }
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
            setBodyEdited(false); // a typed-then-undone edit is not a change
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

    const star = async () => {
        const next = !skill.starred;
        const apply = (starred: boolean) =>
            setSkill((prev) => (prev ? { ...prev, starred } : prev));
        apply(next);
        const res = await setSkillStar(accessToken, skill.id, next);
        if (!res.ok) {
            apply(!next);
            toast.error(res.message || m.hub.starFailed);
            return;
        }
        // The public total moves only for an account that counts: read it back.
        void fetchSkill(accessToken, skill.id).then((r) => r.ok && setSkill(r.data));
    };

    /** Install this public skill, or take the install away (MIP-2293). The page shows the new
     *  state only once the server has said yes. */
    const toggleInstall = async () => {
        if (installing) return;
        setInstalling(true);
        const wasInstalled = skill.installedVersionNo != null;
        const res = wasInstalled
            ? await uninstallSkill(accessToken, skill.id)
            : await installSkill(accessToken, skill.id);
        setInstalling(false);
        if (!res.ok) {
            toast.error(
                res.message || (wasInstalled ? m.hub.uninstallFailed : m.hub.installFailed)
            );
            return;
        }
        const pinned = !wasInstalled && res.data ? res.data.installedVersionNo : null;
        setSkill((prev) =>
            prev ? { ...prev, installedVersionNo: pinned, updateAvailable: false } : prev
        );
        setChanged(true);
        toast.success(wasInstalled ? m.hub.uninstalledToast : m.hub.installedToast);
    };

    /** Stop listing the skill in the Hub: private again, at once. Copies others made stay theirs. */
    const unpublish = async () => {
        setUnpublishError(null);
        const res = await updateSkill(accessToken, skill.id, { visibility: "private" });
        if (!res.ok) {
            setUnpublishError(res.message || m.hub.unpublishFailed);
            return false;
        }
        setConfirmUnpublish(false);
        setSkill(res.data);
        setDraft(draftFrom(res.data));
        setChanged(true);
        toast.success(m.hub.unpublished);
        return true;
    };

    const toggleHidden = async () => {
        if (hiding) return;
        const hide = !skill.hiddenByTeam;
        setHiding(true);
        const res = await setSkillHidden(accessToken, skill.id, hide);
        setHiding(false);
        if (!res.ok) {
            toast.error(res.message || m.team.hideFailed);
            return;
        }
        setChanged(true);
        setSkill((prev) =>
            prev
                ? {
                      ...prev,
                      status: res.data.status,
                      hiddenByTeam: res.data.hiddenByTeam,
                      canHide: res.data.canHide,
                  }
                : prev
        );
        toast.success(hide ? m.team.hiddenToast : m.team.shownToast);
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

    // Shared with the team or public: readers get a published version, not the live draft.
    const savedTeam = skill.visibility !== "private";
    // What readers do not have yet: the server's comparison of the saved draft, plus what was
    // typed here since (the note's autosave and the unsaved details).
    // Switching the skill back to private is not something to publish: it ends the sharing.
    const unpublished =
        savedTeam &&
        (skill.visibility === "public" || isSharedWithPeople(draft.visibility)) &&
        (skill.hasUnpublishedChanges || bodyEdited || dirty);

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
                                disabled={saving || !unpublished}
                                loading={publishing}
                                size="sm"
                                variant={unpublished && !dirty ? "solid" : "outlined"}
                                onClick={() => void publish()}
                            >
                                {skill.publishedVersionNo > 0 ? e.publishChanges : e.publish}
                            </Button>
                        )}
                        <Button
                            disabled={!dirty || publishing}
                            loading={saving}
                            size="sm"
                            variant={dirty ? "solid" : "outlined"}
                            onClick={() => void save()}
                        >
                            {savedTeam ? e.saveDraft : e.save}
                        </Button>
                    </>
                ) : (
                    <>
                        {skill.canHide && (
                            <Button
                                loading={hiding}
                                size="sm"
                                variant="outlined"
                                onClick={() => void toggleHidden()}
                            >
                                {skill.hiddenByTeam ? m.team.show : m.team.hide}
                            </Button>
                        )}
                        <Button
                            size="sm"
                            startDecorator={<FlagOutlinedIcon />}
                            variant="plain"
                            onClick={() => setReporting(true)}
                        >
                            {m.report.action}
                        </Button>
                        {skill.visibility === "public" &&
                            skill.status === "active" &&
                            !skill.mine && (
                                <Button
                                    loading={installing}
                                    size="sm"
                                    variant="outlined"
                                    startDecorator={
                                        skill.installedVersionNo != null ? (
                                            <RemoveCircleOutlineRoundedIcon />
                                        ) : (
                                            <DownloadRoundedIcon />
                                        )
                                    }
                                    onClick={() => void toggleInstall()}
                                >
                                    {skill.installedVersionNo != null
                                        ? m.hub.uninstall
                                        : m.hub.install}
                                </Button>
                            )}
                        {!skill.hiddenByTeam &&
                            skill.visibility !== "private" &&
                            (skill.mine || skill.visibility !== "specific") && (
                                <Button
                                    size="sm"
                                    startDecorator={<ContentCopyRoundedIcon />}
                                    variant="solid"
                                    onClick={() => void copy()}
                                >
                                    {m.list.copy}
                                </Button>
                            )}
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
            {!editable && !skill.hiddenByTeam && (
                <Alert color="neutral" size="sm" variant="soft">
                    {e.readOnly}
                </Alert>
            )}
            {editable && skill.role === "editor" && (
                <Alert color="neutral" size="sm" variant="soft">
                    {m.team.editorNote}
                </Alert>
            )}
            {skill.hiddenByTeam && (
                <Alert color="warning" size="sm" variant="soft">
                    {skill.canHide ? m.team.hiddenByYou : m.team.hiddenByOwner}
                </Alert>
            )}
            {skill.visibility === "public" && skill.status === "active" && (
                <SkillHubStrip skill={skill} onStar={() => void star()} />
            )}
            {skill.sourceHarmful && (
                <Alert color="warning" size="sm" variant="soft">
                    {m.sourceHarmful.warning}
                </Alert>
            )}
            {skill.forkedFrom && (
                <Typography
                    level="body-xs"
                    sx={{ color: "text.tertiary", overflowWrap: "anywhere" }}
                >
                    {!skill.forkedFrom.available
                        ? m.team.copiedFromGone
                        : skill.forkedFrom.author
                          ? fmt(m.hub.copiedFromAuthor, {
                                title: skill.forkedFrom.title,
                                handle: skill.forkedFrom.author.handle,
                                n: skill.forkedFrom.versionNo,
                            })
                          : skill.forkedFrom.ownerName
                            ? fmt(m.team.copiedFrom, {
                                  title: skill.forkedFrom.title,
                                  name: skill.forkedFrom.ownerName,
                                  n: skill.forkedFrom.versionNo,
                              })
                            : fmt(m.team.copiedFromNoName, {
                                  title: skill.forkedFrom.title,
                                  n: skill.forkedFrom.versionNo,
                              })}
                </Typography>
            )}
            {editable && savedTeam && (
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 1,
                        minWidth: 0,
                    }}
                >
                    {unpublished && (
                        <Chip color="warning" size="sm" variant="soft">
                            {e.unpublishedChanges}
                        </Chip>
                    )}
                    <Typography level="body-xs" sx={{ color: "text.tertiary", minWidth: 0 }}>
                        {fmt(e.saveHint, { n: skill.publishedVersionNo })}
                    </Typography>
                </Box>
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
                    ownerOnly={editable && !skill.canManage}
                    problems={problemsShown ? problems : {}}
                    serverProblems={serverProblems}
                    skill={skill}
                    editorsField={
                        editable ? (
                            <SkillEditorsField
                                myId={host.myself.userId}
                                skill={skill}
                                teamMembers={host.useTEM.teamMembers ?? []}
                                onChange={(editors, left) => {
                                    if (left) {
                                        onBack(true);
                                        return;
                                    }
                                    setSkill((prev) => (prev ? { ...prev, editors } : prev));
                                }}
                            />
                        ) : undefined
                    }
                    hubField={
                        publicEnabled && editable && skill.canManage ? (
                            <SkillHubField
                                busy={saving || publishing}
                                skill={skill}
                                onPublish={() => setPublishingToHub(true)}
                                onUnpublish={() => {
                                    setUnpublishError(null);
                                    setConfirmUnpublish(true);
                                }}
                            />
                        ) : undefined
                    }
                    sharesField={
                        editable && skill.canManage ? (
                            <SkillSharesField
                                allChats={host.useCM.allChats ?? []}
                                disabled={saving || publishing}
                                myId={host.myself.userId}
                                shares={draft.shares}
                                teamMembers={host.useTEM.teamMembers ?? []}
                                problem={
                                    problemsShown && problems.shares ? m.shares.problemEmpty : null
                                }
                                onChange={(shares) => setField({ shares })}
                            />
                        ) : undefined
                    }
                    onChange={setField}
                    onTagCatalogRewrite={rewriteTag}
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
                        p: 0,
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
                            sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", p: 2 }}
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
                                        alignItems: "baseline",
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

            {skill.canManage && (
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
            <SkillPublishDialog
                skill={publishingToHub ? skill : null}
                onClose={() => setPublishingToHub(false)}
                onPublished={(next) => {
                    setPublishingToHub(false);
                    setSkill(next);
                    setDraft(draftFrom(next));
                    setChanged(true);
                    setBodyEdited(false);
                    void loadVersions();
                }}
            />
            <ConfirmDialog
                cancelLabel={t.common.actions.cancel}
                confirmLabel={m.hub.field.unpublishConfirm}
                description={m.hub.field.unpublishBody}
                entityName={skill.title}
                error={unpublishError}
                open={confirmUnpublish}
                title={m.hub.field.unpublishTitle}
                zIndex={GENOS_MEMORY_CONFIRM_Z_INDEX}
                onClose={() => setConfirmUnpublish(false)}
                onConfirm={unpublish}
            />
            <ConfirmDialog
                cancelLabel={t.common.actions.cancel}
                confirmLabel={m.team.makePrivateConfirm}
                description={m.team.makePrivateBody}
                entityName={skill.title}
                open={confirmPrivate}
                title={m.team.makePrivateTitle}
                zIndex={GENOS_MEMORY_CONFIRM_Z_INDEX}
                onClose={() => setConfirmPrivate(false)}
                onConfirm={async () => {
                    setConfirmPrivate(false);
                    await save(true);
                }}
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
