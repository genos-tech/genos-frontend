/**
 * The Automation tab of the project's "Statuses and automation" dialog (MIP-2499): the list of
 * rules, the editor, the dry run a rule goes through before it is saved or turned on, and the
 * recent runs. The views swap in place; the dialog draws what this returns.
 *
 * Every save and every turn-on passes the preview. Any change but turning a rule off makes the
 * person who saves it the one it runs as.
 */
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { Box, Button, IconButton } from "@mui/joy";

import { ErrorState } from "../../../components/ui/feedback/ErrorState";
import { SkeletonRows } from "../../../components/ui/feedback/Skeleton";
import { ConfirmDialog } from "../../../components/ui/modal/ConfirmDialog";
import { useAuth } from "../../../context/authState";
import { fmt, useTranslation } from "../../../i18n";
import { focusRing, g, type } from "../../../theme/tokens";
import { definitionOf, draftOf, emptyDraft, missingParts, RuleDraft } from "./draft";
import { coarsePointer, ruleProblemOf, unnamedDestination } from "./helpers";
import { AutomationContextData, LookupsContext, useRuleLookups } from "./lookups";
import { EditorErrors, RuleEditor } from "./RuleEditor";
import { RuleList } from "./RuleList";
import { PreviewState, RulePreview } from "./RulePreview";
import { RuleRuns } from "./RuleRuns";
import {
    createRule,
    deleteRule,
    dryRunRule,
    loadRules,
    orderRules,
    Refusal,
    updateRule,
} from "./service";
import type { AutomationRule, RuleList as RuleListData } from "./types";
import { useLater } from "./useLater";
import { reasonText, sentenceCase, useAutomationWords, wordsFor } from "./words";

/** Where the preview was asked for. A switch turns the saved rule on; the others save. */
const NO_DATA: AutomationContextData = {
    projects: [],
    members: [],
    myself: { userId: "" } as AutomationContextData["myself"],
    profiles: {},
    chats: [],
};

type PreviewFrom = "editor" | "menu" | "switch";

type View =
    | { kind: "list" }
    | { kind: "editor"; ruleId: number | null }
    | { kind: "preview"; ruleId: number | null; from: PreviewFrom }
    | { kind: "runs"; ruleId: number };

/** The server's `field` → the part of the editor its message belongs to. */
const PARTS: Record<string, string> = {
    name: "name",
    applies_to: "trigger",
    trigger_type: "trigger",
    trigger_value: "trigger",
    conditions: "conditions",
    destination_project_id: "move",
    set_status: "status",
    set_custom_status_id: "status",
    set_assignee_id: "assignee",
    add_tag: "tag",
};

const snapshot = (draft: RuleDraft) =>
    JSON.stringify([definitionOf(draft, draft.name), [...draft.actions].sort()]);

const footerSx = {
    display: "flex",
    flexDirection: { xs: "column", sm: "row" },
    flexWrap: "wrap",
    alignItems: { xs: "stretch", sm: "center" },
    justifyContent: "flex-end",
    width: "100%",
    gap: 1,
    "& button": { "@media (pointer: coarse)": { minHeight: 44 } },
} as const;

export const useAutomationPane = ({
    projectId,
    data,
    active,
    popupZ,
    onLeave,
}: {
    projectId: number;
    /** Null where the caller has no rules to show. */
    data: AutomationContextData | undefined;
    active: boolean;
    popupZ: number;
    /** Close the dialog (going to the plans page). */
    onLeave: () => void;
}) => {
    const words = useAutomationWords();
    const { t } = useTranslation();
    const later = useLater();
    const { accessToken } = useAuth();
    const enabled = active && data != null;
    const lookups = useRuleLookups(projectId, data ?? NO_DATA, popupZ, enabled);

    const [list, setList] = useState<RuleListData | "failed" | null>(null);
    const [view, setView] = useState<View>({ kind: "list" });
    const [draft, setDraft] = useState<RuleDraft>(emptyDraft);
    const [errors, setErrors] = useState<EditorErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [preview, setPreview] = useState<PreviewState>({ status: "loading" });
    const [saving, setSaving] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState<AutomationRule | null>(null);
    const [leaving, setLeaving] = useState<(() => void) | null>(null);
    const [announcement, setAnnouncement] = useState("");
    const announceTimer = useRef(0);
    /** Emptied first, or the same words twice in a row are read once. */
    const announce = useCallback(
        (text: string) => {
            window.clearTimeout(announceTimer.current);
            setAnnouncement("");
            announceTimer.current = later(() => setAnnouncement(text), 50);
        },
        [later]
    );
    const opened = useRef("");
    const asked = useRef(0);

    const rules = list && list !== "failed" ? list.rules : [];
    const ruleOf = (id: number | null) => rules.find((r) => r.ruleId === id);

    const load = useCallback(async () => {
        const res = await loadRules(projectId, accessToken);
        if (res.ok) setList(res.data);
        else setList((previous) => (previous && previous !== "failed" ? previous : "failed"));
    }, [projectId, accessToken]);

    // Read once the dialog is up (the tab's badge needs it), and again each time it opens.
    useEffect(() => {
        if (!enabled) {
            setView({ kind: "list" });
            setList(null);
            setDeleting(null);
            setLeaving(null);
            return;
        }
        void load();
    }, [enabled, load]);

    /** Give the focus somewhere to be once the view or the row has changed. */
    const focusLater = (slot: string, fallback = "new-rule") =>
        later(() => {
            const find = (s: string) => document.querySelector<HTMLElement>(`[data-slot="${s}"]`);
            (find(slot) ?? find(fallback))?.focus();
        }, 100);

    const toList = (slot = "new-rule") => {
        setView({ kind: "list" });
        focusLater(slot);
    };

    const openRule = (rule: AutomationRule | null) => {
        const next = rule ? draftOf(rule) : emptyDraft();
        opened.current = snapshot(next);
        setDraft(next);
        setErrors({});
        setFormError(null);
        return next;
    };

    const openEditor = (rule: AutomationRule | null) => {
        openRule(rule);
        setView({ kind: "editor", ruleId: rule?.ruleId ?? null });
        // A touch screen would put the keyboard over the sentence.
        focusLater(coarsePointer() ? "back" : "name", "back");
    };

    /** Put a refusal where it belongs in the editor. */
    const showRefusal = (refusal: Refusal, ruleId: number | null) => {
        const text = refusal.code
            ? sentenceCase(reasonText(words, refusal.code))
            : words.saveFailed;
        const part = PARTS[refusal.field];
        setErrors(part ? { [part]: text } : {});
        setFormError(part ? null : text);
        setView({ kind: "editor", ruleId });
    };

    const runPreview = async (next: RuleDraft, ruleId: number | null, from: PreviewFrom) => {
        const mine = ++asked.current;
        setView({ kind: "preview", ruleId, from });
        setPreview({ status: "loading" });
        // The definition, not the saved rule's id: it is judged for the person looking, who is
        // who it would run as once saved.
        const res = await dryRunRule(projectId, definitionOf(next, next.name || "…"), accessToken);
        if (mine !== asked.current) return;
        if (res.ok) setPreview({ status: "ok", result: res.data });
        else if (res.code === "plan_required") {
            void load();
            toList();
        } else if (res.code === "throttled" || res.code === "") {
            setPreview({ status: "failed", limited: res.code === "throttled" });
        } else showRefusal(res, ruleId);
    };

    const check = () => {
        const found: EditorErrors = {};
        if (!draft.name.trim()) found.name = words.errName;
        for (const part of missingParts(draft)) {
            found[part] = part === "actions" ? words.errNoAction : words.errSlot;
        }
        setErrors(found);
        setFormError(null);
        if (!Object.keys(found).length && view.kind === "editor") {
            void runPreview(draft, view.ruleId, "editor");
            return;
        }
        later(
            () =>
                document
                    .querySelector<HTMLElement>(
                        '[data-testid="project-automation"] [aria-invalid="true"]'
                    )
                    ?.focus(),
            50
        );
    };

    const save = async (turnOn: boolean) => {
        if (view.kind !== "preview") return;
        const { ruleId, from } = view;
        setSaving(turnOn ? "on" : "off");
        const res =
            from === "switch" && ruleId != null
                ? await updateRule(projectId, ruleId, { enabled: true }, accessToken)
                : ruleId != null
                  ? await updateRule(
                        projectId,
                        ruleId,
                        { ...definitionOf(draft, draft.name), enabled: turnOn },
                        accessToken
                    )
                  : await createRule(
                        projectId,
                        { ...definitionOf(draft, draft.name), enabled: turnOn },
                        accessToken
                    );
        if (!res.ok) {
            setSaving(null);
            if (res.code === "plan_required") {
                await load();
                toList();
            } else showRefusal(res, ruleId);
            return;
        }
        await load();
        setSaving(null);
        announce(from === "switch" ? words.turnedOnMsg : turnOn ? words.savedOn : words.saved);
        opened.current = snapshot(draft);
        toList(`rule-${res.data.ruleId}`);
    };

    const switchRule = async (rule: AutomationRule, on: boolean) => {
        if (on) {
            // Its destination has to be chosen again first.
            if (unnamedDestination(rule)) {
                openEditor(rule);
                return;
            }
            // Never at once: what it would do is shown first.
            void runPreview(openRule(rule), rule.ruleId, "switch");
            return;
        }
        setBusyId(rule.ruleId);
        const res = await updateRule(projectId, rule.ruleId, { enabled: false }, accessToken);
        await load();
        setBusyId(null);
        announce(res.ok ? words.turnedOffMsg : words.saveFailed);
        focusLater(`switch-${rule.ruleId}`);
    };

    const move = async (rule: AutomationRule, step: -1 | 1) => {
        const from = rules.findIndex((r) => r.ruleId === rule.ruleId);
        const to = from + step;
        if (to < 0 || to >= rules.length || busyId != null) return;
        const order = rules.map((r) => r.ruleId);
        [order[from], order[to]] = [order[to], order[from]];
        setBusyId(rule.ruleId);
        const res = await orderRules(projectId, order, accessToken);
        if (res.ok) {
            setList(res.data);
            announce(fmt(words.moved, { name: rule.name, position: to + 1, total: rules.length }));
        } else {
            announce(words.saveFailed);
            await load();
        }
        setBusyId(null);
        later(
            () =>
                document
                    .querySelector<HTMLElement>(`[data-rule-menu="${rule.ruleId}"] button`)
                    ?.focus(),
            100
        );
    };

    const confirmDelete = async () => {
        if (!deleting) return;
        const at = rules.findIndex((r) => r.ruleId === deleting.ruleId);
        const neighbour = rules[at + 1] ?? rules[at - 1];
        const res = await deleteRule(projectId, deleting.ruleId, accessToken);
        if (!res.ok) throw new Error(words.saveFailed);
        setList(res.data);
        setDeleting(null);
        announce(words.deleted);
        focusLater(neighbour ? `rule-${neighbour.ruleId}` : "new-rule");
    };

    const editing = view.kind === "editor" || view.kind === "preview";
    const dirty = useMemo(() => editing && snapshot(draft) !== opened.current, [editing, draft]);

    /** Run `proceed`, asking first when an edit would be lost. */
    const guard = (proceed: () => void) => {
        if (dirty) setLeaving(() => proceed);
        else proceed();
    };

    const back = () => {
        asked.current += 1;
        if (view.kind === "preview" && view.from === "editor") {
            setView({ kind: "editor", ruleId: view.ruleId });
            focusLater("preview-matches");
            return;
        }
        const ruleId = view.kind === "list" ? null : view.ruleId;
        const slot =
            ruleId == null
                ? "new-rule"
                : view.kind === "preview" && view.from === "switch"
                  ? `switch-${ruleId}`
                  : `rule-${ruleId}`;
        if (view.kind === "editor") guard(() => toList(slot));
        else toList(slot);
    };

    const title =
        view.kind === "editor"
            ? view.ruleId == null
                ? words.newTitle
                : words.editTitle
            : view.kind === "preview"
              ? words.previewTitle
              : words.recentRuns;

    const backRow =
        view.kind === "list" ? null : (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minHeight: 44 }}>
                <IconButton
                    color="neutral"
                    data-slot="back"
                    size="sm"
                    variant="plain"
                    aria-label={
                        view.kind === "preview" && view.from === "editor"
                            ? words.backToEditor
                            : words.back
                    }
                    sx={{
                        "@media (pointer: coarse)": { minWidth: 44, minHeight: 44 },
                        "&:focus-visible": focusRing,
                        '[dir="rtl"] & svg': { transform: "scaleX(-1)" },
                    }}
                    onClick={back}
                >
                    <ArrowBackRoundedIcon />
                </IconButton>
                <Box component="h3" sx={{ ...type("title-sm"), m: 0 }}>
                    {title}
                </Box>
            </Box>
        );

    const content = (): ReactNode => {
        if (list === null) return <SkeletonRows count={3} label={words.loading} />;
        if (list === "failed") {
            return (
                <ErrorState
                    size="sm"
                    title={words.loadFailed}
                    onRetry={() => {
                        setList(null);
                        void load();
                    }}
                />
            );
        }
        if (view.kind === "editor") {
            return (
                <RuleEditor
                    draft={draft}
                    errors={errors}
                    formError={formError}
                    onAnnounce={announce}
                    onChange={(next) => {
                        setDraft(next);
                        // What was wrong is judged again at the next press.
                        if (Object.keys(errors).length) setErrors({});
                    }}
                />
            );
        }
        if (view.kind === "preview") {
            return (
                <RulePreview
                    draft={draft}
                    state={preview}
                    onAnnounce={announce}
                    onRetry={() => void runPreview(draft, view.ruleId, view.from)}
                />
            );
        }
        if (view.kind === "runs") {
            const rule = ruleOf(view.ruleId);
            return rule ? <RuleRuns rule={rule} /> : null;
        }
        return (
            <RuleList
                busyId={busyId}
                planAllows={list.planAllows}
                rules={list.rules}
                onDelete={setDeleting}
                onEdit={openEditor}
                onLeave={onLeave}
                onMove={(rule, step) => void move(rule, step)}
                onNew={() => openEditor(null)}
                onRuns={(rule) => setView({ kind: "runs", ruleId: rule.ruleId })}
                onSwitch={(rule, on) => void switchRule(rule, on)}
                onPreview={(rule) => {
                    if (unnamedDestination(rule)) return;
                    void runPreview(openRule(rule), rule.ruleId, "menu");
                }}
            />
        );
    };

    const actions = (): ReactNode => {
        if (view.kind === "editor") {
            return (
                <Box sx={footerSx}>
                    <Button data-slot="preview-matches" onClick={check}>
                        {words.preview}
                    </Button>
                </Box>
            );
        }
        if (view.kind !== "preview") return undefined;
        const ready = preview.status === "ok";
        const cantRun = preview.status === "ok" && ruleProblemOf(preview.result) != null;
        const wasOn = ruleOf(view.ruleId)?.enabled === true;
        const moves = draft.actions.includes("move");
        const note = (
            <Box
                sx={{
                    ...type("body-xs"),
                    color: g.text.secondary,
                    flex: { sm: "1 1 12rem" },
                }}
            >
                {moves ? words.runsAsYouMove : words.runsAsYou}
            </Box>
        );
        if (view.from === "switch") {
            return (
                <Box sx={footerSx}>
                    {note}
                    <Button
                        disabled={!ready || cantRun}
                        loading={saving === "on"}
                        onClick={() => void save(true)}
                    >
                        {words.turnOn}
                    </Button>
                </Box>
            );
        }
        return (
            <Box sx={footerSx}>
                {note}
                <Button
                    color="neutral"
                    disabled={!ready || saving != null}
                    loading={saving === "off"}
                    variant="outlined"
                    onClick={() => void save(false)}
                >
                    {wasOn ? words.saveTurnOff : words.saveKeepOff}
                </Button>
                <Button
                    disabled={!ready || cantRun || saving != null}
                    loading={saving === "on"}
                    onClick={() => void save(true)}
                >
                    {wasOn ? words.save : words.saveTurnOn}
                </Button>
            </Box>
        );
    };

    const dialogs = (
        <>
            <ConfirmDialog
                cancelLabel={t.common.actions.cancel}
                confirmLabel={words.delete}
                description={wordsFor(words, deleting?.appliesTo).deleteBody}
                hostZIndex={popupZ - 10}
                open={deleting != null}
                title={deleting ? fmt(words.deleteTitle, { name: deleting.name }) : ""}
                destructive
                onClose={() => setDeleting(null)}
                onConfirm={confirmDelete}
            />
            <ConfirmDialog
                cancelLabel={words.keepEditing}
                confirmLabel={words.discard}
                description={words.discardBody}
                hostZIndex={popupZ - 10}
                open={leaving != null}
                title={words.discardTitle}
                onClose={() => setLeaving(null)}
                onConfirm={() => {
                    const proceed = leaving;
                    setLeaving(null);
                    opened.current = snapshot(draft);
                    proceed?.();
                }}
            />
        </>
    );

    return {
        /** A view past the list: the tabs give way to a back button. */
        subView: view.kind !== "list",
        backRow,
        body: (
            <LookupsContext.Provider value={lookups}>
                <Box aria-busy={saving != null || busyId != null} data-testid="project-automation">
                    {content()}
                </Box>
            </LookupsContext.Provider>
        ),
        actions: view.kind === "list" || view.kind === "runs" ? undefined : actions(),
        dialogs,
        announcement,
        /** How many rules the engine turned off. */
        needsFix: rules.filter((r) => !r.enabled && r.disabledReason).length,
        guard,
    };
};
