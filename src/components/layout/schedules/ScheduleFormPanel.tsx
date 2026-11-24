import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import {
    Alert,
    Box,
    Button,
    FormControl,
    FormHelperText,
    FormLabel,
    Input,
    Option,
    Radio,
    RadioGroup,
    Select,
    Sheet,
    Stack,
    Switch,
    Typography,
} from "@mui/joy";

import { CREDIT_PACKS_PATH, PLANS_PATH } from "../../../features/billing/billingPaths";
import { findDuplicate } from "../../../features/schedules/scheduleDuplicates";
import {
    asEffortLevel,
    chatHintKey,
    chosenEffort,
    costText,
    EFFORT_LEVELS,
    showsEffort,
} from "../../../features/schedules/scheduleEffort";
import {
    buildCreate,
    buildPatch,
    emptyForm,
    FieldProblem,
    formFromSchedule,
    FormProblems,
    FREQUENCIES,
    hasProblems,
    NAME_MAX,
    paramKind,
    ScheduleForm,
    validateForm,
    WEEKDAY_NUMBERS,
} from "../../../features/schedules/scheduleForm";
import { humanizeKey, weekdayName } from "../../../features/schedules/scheduleFormat";
import {
    enumLabelKey,
    isRequiredParam,
    knownParam,
    paramHintKey,
} from "../../../features/schedules/scheduleParams";
import { useIsMobile } from "../../../hooks/common/useIsMobile";
import { fmt, useTranslation } from "../../../i18n";
import { requestAppNavigate } from "../../../services/appNavigate";
import type {
    ChatTarget,
    EffortLevel,
    Schedule,
    ScheduleChange,
    ScheduleFields,
    ScheduleJob,
    ScheduleResult,
} from "../../../services/schedules";
import { g } from "../../../theme/tokens";
import { useJoinedProjects } from "./scheduleParamHooks";
import {
    ChatParamSelect,
    ChatTargetSelect,
    MilestoneParamSelect,
    ProjectParamSelect,
    SkillParamSelect,
} from "./ScheduleParamPickers";

type Props = {
    /** The schedule being edited; null to create one. */
    schedule: Schedule | null;
    jobs: ScheduleJob[];
    /** The chats a report can be posted in (MIP-1420). With none, the form offers no choice. */
    chatTargets?: ChatTarget[];
    /** No AI credits left (MIP-1967): the AI switch is drawn off and disabled, with the reason. */
    aiCreditsOut?: boolean;
    /** The member's schedules on screen, for the instant "you already have this" check. */
    existing?: Schedule[];
    timeZone: string;
    /** Resolves with the server's verdict; the panel shows its sentence. */
    onSubmit: (body: ScheduleFields | ScheduleChange) => Promise<ScheduleResult<object>>;
    onCancel: () => void;
};

const FREQUENCY_KEYS = {
    daily: "frequencyDaily",
    weekdays: "frequencyWeekdays",
    weekly: "frequencyWeekly",
    monthly: "frequencyMonthly",
    once: "frequencyOnce",
} as const;

/**
 * The create / edit form for one schedule (MIP-1150). It is built from the
 * catalog the API sends: the job list, and for the chosen job only the
 * parameters that job declares (an integer with a range is a number input, an
 * enum is a select, anything else is text). It names no job itself, so a job
 * added on the server shows up here with no change to this file.
 *
 * Time is typed as 24-hour `HH:MM` text rather than `<input type="time">`,
 * which shows 12-hour in some browser locales and the zone beside it must be
 * unambiguous.
 */
export const ScheduleFormPanel = ({
    schedule,
    jobs,
    chatTargets = [],
    aiCreditsOut = false,
    existing = [],
    timeZone,
    onSubmit,
    onCancel,
}: Props) => {
    const { t, locale } = useTranslation();
    const s = t.settings.schedules;
    const effortWords: Record<EffortLevel, string> = {
        low: t.settings.llmModel.effortLow,
        medium: t.settings.llmModel.effortMedium,
        high: t.settings.llmModel.effortHigh,
    };
    const effortLabelId = useId();

    const [form, setForm] = useState<ScheduleForm>(() => {
        if (schedule) return formFromSchedule(schedule, jobs);
        const blank = emptyForm(jobs);
        return { ...blank, name: jobs[0]?.title ?? "" };
    });
    const isMobile = useIsMobile();
    const formRef = useRef<HTMLFormElement>(null);
    const [touched, setTouched] = useState(false);
    // Bumped on every refused submit, so focus goes to the first wrong field.
    const [refused, setRefused] = useState(0);
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);

    const job = jobs.find((j) => j.job === form.job);
    // Editing a schedule whose job was removed: renaming or re-timing it is
    // still fine as long as the job field is left alone.
    const keepsUnknownJob = !!schedule && !job && form.job === schedule.job;
    // What the picker lists: a required project outside it cannot be saved. An empty list is
    // "not loaded yet, or in no project": the form cannot tell, so it refuses nothing then.
    const joinedProjects = useJoinedProjects();
    const pickableProjects = useMemo(
        () =>
            joinedProjects.length > 0
                ? new Set(joinedProjects.map((p) => String(p.projectId)))
                : undefined,
        [joinedProjects]
    );
    const problems: FormProblems = useMemo(
        () => validateForm(form, job, keepsUnknownJob, pickableProjects),
        [form, job, keepsUnknownJob, pickableProjects]
    );
    const show = touched && hasProblems(problems);
    // The form as it opened, to tell "the member changed something" from "the form is
    // simply what it opened as" (the default new form is often a copy of Morning plan).
    const [initialForm] = useState(form);
    const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);
    // The API refuses a duplicate with a sentence of its own (shown below if it
    // gets that far); this is the same question asked of the list on screen, so the
    // answer comes while typing. Only for a form that is otherwise valid, and for an
    // edit only when the change CREATES the duplicate: two schedules that already
    // look alike must stay editable (pause, push, time) without the first one flagged.
    const duplicateNow = useMemo(() => {
        if (hasProblems(problems)) return null;
        const found = findDuplicate(buildCreate(form, job), existing, schedule?.id);
        if (!found || !schedule) return found;
        const before = findDuplicate(
            buildCreate(
                formFromSchedule(schedule, jobs),
                jobs.find((j) => j.job === schedule.job)
            ),
            existing,
            schedule.id
        );
        return before?.kind === found.kind && before.schedule.id === found.schedule.id
            ? null
            : found;
    }, [problems, form, job, jobs, existing, schedule]);
    // Shown (and blocking) once the member has changed the form or tried to save it.
    const duplicate = dirty || touched ? duplicateNow : null;

    // Any edit makes the API's last refusal stale, so it goes: what it said was about the
    // form as it was sent, and left up it would sit beside the instant checks as a second,
    // older opinion.
    const set = <K extends keyof ScheduleForm>(key: K, value: ScheduleForm[K]) => {
        setFailure(null);
        setForm((cur) => ({ ...cur, [key]: value }));
    };

    const pickJob = (next: string) => {
        setFailure(null);
        setForm((cur) => {
            const prev = jobs.find((j) => j.job === cur.job);
            const nextJob = jobs.find((j) => j.job === next);
            // A name still showing the previous report's title follows the pick.
            const follows = cur.name.trim() === "" || cur.name === prev?.title;
            return {
                ...cur,
                job: next,
                params: {},
                // A level chosen for the old report says nothing about the new one.
                aiEffort: "",
                name: follows ? (nextJob?.title ?? cur.name) : cur.name,
            };
        });
    };

    // Where the report goes (MIP-1420): the Inbox, or a chat. The chat a schedule already posts in
    // stays selectable even when it is no longer offered (archived, left), so the form never shows
    // a blank for what is saved; the server decides on save.
    const strayChatId =
        schedule?.deliverChannel && !chatTargets.some((c) => c.id === schedule.deliverChannel?.id)
            ? schedule.deliverChannel.id
            : undefined;
    const deliverOptions: ChatTarget[] = useMemo(() => {
        const saved = schedule?.deliverChannel;
        if (!saved || chatTargets.some((c) => c.id === saved.id)) return chatTargets;
        return [{ ...saved, projectId: null }, ...chatTargets];
    }, [chatTargets, schedule]);
    const chosenChat = deliverOptions.find((c) => c.id === form.deliverChannelId);
    const chatLabel = (c: ChatTarget) => {
        const name = c.title || s.unavailable;
        return c.kind === "project" ? fmt(s.deliverProjectChat, { name }) : name;
    };

    const toggleDay = (day: number) =>
        set(
            "weekdays",
            form.weekdays.includes(day)
                ? form.weekdays.filter((d) => d !== day)
                : [...form.weekdays, day].sort((a, b) => a - b)
        );

    useEffect(() => {
        if (refused === 0) return;
        const first = formRef.current?.querySelector<HTMLElement>(
            ".Mui-error input, .Mui-error [role='combobox'], [data-invalid-group]"
        );
        first?.focus();
    }, [refused]);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setTouched(true);
        if (hasProblems(problems)) {
            setRefused((n) => n + 1);
            return;
        }
        // An unchanged form that is a copy: say so here instead of asking the API.
        if (duplicateNow || busy) return;
        setBusy(true);
        setFailure(null);
        const res = await onSubmit(
            schedule ? buildPatch(schedule, form, job) : buildCreate(form, job)
        );
        setBusy(false);
        if (!res.ok) setFailure(res.error ?? (res.gone ? s.gone : s.saveFailed));
    };

    // AI effort (MIP-1212). `chosen` is what the radio shows; the estimate is for the level a run
    // would use, which differs from it only when the plan holds a saved choice lower.
    const defaultLevel = asEffortLevel(job?.effortDefault);
    const chosen = chosenEffort(job, form.aiEffort);
    const held =
        schedule &&
        chosen &&
        chosen === chosenEffort(job, schedule.aiEffort ?? "") &&
        asEffortLevel(schedule.aiEffortEffective) &&
        schedule.aiEffortEffective !== chosen
            ? schedule.aiEffortEffective
            : null;
    const estimate = chosen ? costText(job?.effortCost, held ?? chosen) : null;
    const costNote = !estimate
        ? null
        : estimate.kind === "tiny"
          ? s.effortCostTiny
          : estimate.kind === "about"
            ? fmt(s.effortCostAbout, { credits: estimate.credits })
            : fmt(s.effortCostRange, { from: estimate.from, to: estimate.to });

    return (
        <Sheet
            ref={formRef}
            component="form"
            data-testid="schedule-form"
            sx={{ borderRadius: 8, p: 1.5, minWidth: 0, borderColor: g.border.default }}
            variant="outlined"
            noValidate
            onSubmit={(e: FormEvent) => void submit(e)}
        >
            <Stack spacing={1.5} sx={{ minWidth: 0 }}>
                <Typography level="title-sm">{schedule ? s.formEdit : s.formNew}</Typography>

                <FormControl
                    error={(show && !!problems.name) || duplicate?.kind === "name"}
                    sx={{ minWidth: 0 }}
                >
                    <FormLabel>{s.name}</FormLabel>
                    <Input
                        autoFocus={!isMobile}
                        placeholder={s.namePlaceholder}
                        // Opened by the member's own click; on a phone the keyboard would
                        // cover the form, so only a fine pointer gets the focus.
                        value={form.name}
                        slotProps={{
                            input: { autoComplete: "off", maxLength: NAME_MAX + 20, name: "name" },
                        }}
                        onChange={(e) => set("name", e.target.value)}
                    />
                    {show && problems.name && (
                        <FormHelperText>
                            {problems.name === "required"
                                ? s.errorNameRequired
                                : fmt(s.errorNameTooLong, { max: NAME_MAX })}
                        </FormHelperText>
                    )}
                    {duplicate?.kind === "name" && (
                        <FormHelperText>
                            {fmt(s.duplicateName, { name: duplicate.schedule.name })}
                        </FormHelperText>
                    )}
                </FormControl>

                <FormControl error={show && !!problems.job} sx={{ minWidth: 0 }}>
                    <FormLabel>{s.job}</FormLabel>
                    <Select
                        placeholder={s.jobPlaceholder}
                        sx={{ minWidth: 0 }}
                        value={job ? form.job : null}
                        onChange={(_, v) => v && pickJob(v)}
                    >
                        {jobs.map((j) => (
                            <Option key={j.job} value={j.job}>
                                {j.title}
                            </Option>
                        ))}
                    </Select>
                    {job?.description && (
                        <FormHelperText sx={{ color: g.text.secondary }}>
                            {job.description}
                        </FormHelperText>
                    )}
                    {show && problems.job && <FormHelperText>{s.errorJob}</FormHelperText>}
                </FormControl>

                {job && Object.keys(job.params).length > 0 && (
                    <Stack data-testid="schedule-params" spacing={1.25} sx={{ minWidth: 0 }}>
                        <Typography level="title-sm">{s.options}</Typography>
                        {Object.entries(job.params).map(([key, spec]) => {
                            const kind = paramKind(spec);
                            const known = knownParam(key);
                            // The server's own bookkeeping (the version a skill schedule is
                            // pinned to): carried in the form and sent, never drawn.
                            if (known?.hidden) return null;
                            const problem = show ? problems.params[key] : undefined;
                            const required = isRequiredParam(spec);
                            const range =
                                spec.minimum !== undefined && spec.maximum !== undefined
                                    ? fmt(s.paramRangeNote, {
                                          min: spec.minimum,
                                          max: spec.maximum,
                                      })
                                    : "";
                            // A label or hint the server sends wins; then the plain one for the
                            // built-in jobs; then the one made from the key.
                            const label =
                                spec.title || (known ? s[known.label] : humanizeKey(key));
                            const hint =
                                (known?.preferOwnHint ? null : spec.description) ||
                                (known
                                    ? fmt(s[paramHintKey(known, required)], { range })
                                    : kind === "integer" && range
                                      ? fmt(s.paramRange, {
                                            min: spec.minimum ?? "",
                                            max: spec.maximum ?? "",
                                        })
                                      : null);
                            const problemText = (p: FieldProblem): string => {
                                if (p === "unavailable") return s.errorProjectUnavailable;
                                if (p === "required") {
                                    return known?.picker === "milestone"
                                        ? s.errorMilestone
                                        : known?.picker === "project"
                                          ? s.errorProject
                                          : known?.picker === "skill"
                                            ? s.errorSkill
                                            : s.errorRequired;
                                }
                                if (
                                    p === "range" &&
                                    spec.minimum !== undefined &&
                                    spec.maximum !== undefined
                                ) {
                                    return fmt(s.errorParamRange, {
                                        min: spec.minimum,
                                        max: spec.maximum,
                                    });
                                }
                                return s.errorParam;
                            };
                            const setParam = (v: string) =>
                                set("params", {
                                    ...form.params,
                                    [key]: v,
                                    // Another skill is another version: the server pins the new
                                    // one when the schedule is saved.
                                    ...(known?.picker === "skill" ? { version_no: "" } : {}),
                                });
                            if (kind === "boolean") {
                                // Not set means the job's own default, which the catalog does not
                                // state: the form knows it for the parameters it has words for.
                                const raw = form.params[key] ?? "";
                                // No credits: the AI switch cannot be used, so it reads off.
                                const creditsOut = aiCreditsOut && known?.aiSwitch === true;
                                const on = creditsOut
                                    ? false
                                    : raw === ""
                                      ? (known?.boolean?.defaultOn ?? false)
                                      : raw === "true";
                                if (known?.aiSwitch === true) {
                                    // Two modes, not a switch: a plain job, or the same job by
                                    // Genos AI. Plain is the default; the effort control below
                                    // exists only in AI mode.
                                    return (
                                        <FormControl
                                            key={key}
                                            data-testid="schedule-mode"
                                            sx={{ minWidth: 0 }}
                                        >
                                            <FormLabel>{label}</FormLabel>
                                            <Select
                                                sx={{ minWidth: 0 }}
                                                value={on ? "ai" : "plain"}
                                                onChange={(_, v) => {
                                                    if (v) setParam(v === "ai" ? "true" : "false");
                                                }}
                                            >
                                                <Option value="plain">
                                                    {s.scheduleModePlain}
                                                </Option>
                                                <Option disabled={creditsOut} value="ai">
                                                    {s.scheduleModeAi}
                                                </Option>
                                            </Select>
                                            <FormHelperText sx={{ color: g.text.secondary }}>
                                                {creditsOut
                                                    ? s.scheduleModeOutOfCredits
                                                    : on
                                                      ? s.scheduleModeAiHint
                                                      : s.scheduleModePlainHint}
                                            </FormHelperText>
                                            {creditsOut && (
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        flexWrap: "wrap",
                                                        gap: 1,
                                                        mt: 0.75,
                                                    }}
                                                >
                                                    <Button
                                                        size="sm"
                                                        variant="solid"
                                                        onClick={() =>
                                                            requestAppNavigate(CREDIT_PACKS_PATH)
                                                        }
                                                    >
                                                        {s.aiOutOfCreditsBuy}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outlined"
                                                        onClick={() =>
                                                            requestAppNavigate(PLANS_PATH)
                                                        }
                                                    >
                                                        {s.aiOutOfCreditsUpgrade}
                                                    </Button>
                                                </Box>
                                            )}
                                        </FormControl>
                                    );
                                }
                                return (
                                    <FormControl key={key} sx={{ minWidth: 0 }}>
                                        <Box
                                            sx={{ display: "flex", gap: 1, alignItems: "center" }}
                                        >
                                            <Switch
                                                checked={on}
                                                size="sm"
                                                onChange={(e) =>
                                                    setParam(e.target.checked ? "true" : "false")
                                                }
                                            />
                                            <FormLabel sx={{ m: 0 }}>{label}</FormLabel>
                                        </Box>
                                        {hint && (
                                            <FormHelperText sx={{ color: g.text.secondary }}>
                                                {hint}
                                            </FormHelperText>
                                        )}
                                    </FormControl>
                                );
                            }
                            return (
                                <FormControl
                                    key={key}
                                    error={!!problem}
                                    required={required}
                                    sx={{ minWidth: 0 }}
                                >
                                    <FormLabel>{label}</FormLabel>
                                    {known?.picker === "project" ? (
                                        <ProjectParamSelect
                                            required={required}
                                            value={form.params[key] ?? ""}
                                            onChange={setParam}
                                        />
                                    ) : known?.picker === "milestone" ? (
                                        <MilestoneParamSelect
                                            value={form.params[key] ?? ""}
                                            onChange={setParam}
                                        />
                                    ) : known?.picker === "chat" ? (
                                        <ChatParamSelect
                                            value={form.params[key] ?? ""}
                                            onChange={setParam}
                                        />
                                    ) : known?.picker === "skill" ? (
                                        <SkillParamSelect
                                            value={form.params[key] ?? ""}
                                            onChange={setParam}
                                        />
                                    ) : kind === "enum" ? (
                                        <Select
                                            placeholder={s.paramDefault}
                                            sx={{ minWidth: 0 }}
                                            value={form.params[key] || null}
                                            onChange={(_, v) => setParam(v ?? "")}
                                        >
                                            {(spec.enum ?? []).map((v) => {
                                                const text = enumLabelKey(String(v));
                                                return (
                                                    <Option key={String(v)} value={String(v)}>
                                                        {text ? s[text] : humanizeKey(String(v))}
                                                    </Option>
                                                );
                                            })}
                                        </Select>
                                    ) : (
                                        <Input
                                            placeholder={s.paramDefault}
                                            value={form.params[key] ?? ""}
                                            slotProps={{
                                                input:
                                                    kind === "integer"
                                                        ? {
                                                              type: "number",
                                                              inputMode: "numeric",
                                                              min: spec.minimum,
                                                              max: spec.maximum,
                                                              step: 1,
                                                          }
                                                        : {
                                                              autoComplete: "off",
                                                              spellCheck: false,
                                                          },
                                            }}
                                            onChange={(e) => setParam(e.target.value)}
                                        />
                                    )}
                                    {hint && (
                                        <FormHelperText sx={{ color: g.text.secondary }}>
                                            {hint}
                                        </FormHelperText>
                                    )}
                                    {problem && (
                                        <FormHelperText>{problemText(problem)}</FormHelperText>
                                    )}
                                </FormControl>
                            );
                        })}
                    </Stack>
                )}

                {showsEffort(job, form.params) && !aiCreditsOut && (
                    <FormControl data-testid="schedule-effort" sx={{ minWidth: 0 }}>
                        <FormLabel id={effortLabelId}>{s.effortLabel}</FormLabel>
                        <RadioGroup
                            aria-labelledby={effortLabelId}
                            orientation="horizontal"
                            sx={{ flexWrap: "wrap", gap: 1.5 }}
                            value={chosen ?? ""}
                            onChange={(e) => {
                                const level = asEffortLevel(e.target.value);
                                // The job's own level is "no choice", so the schedule keeps
                                // following the job's default if that changes.
                                if (level) set("aiEffort", level === defaultLevel ? "" : level);
                            }}
                        >
                            {EFFORT_LEVELS.map((level) => (
                                <Radio
                                    key={level}
                                    size="sm"
                                    // A finger needs 44 px; the label is the hit area.
                                    sx={{ alignItems: "center", minHeight: { xs: 44, md: 28 } }}
                                    value={level}
                                    label={
                                        level === defaultLevel
                                            ? fmt(s.effortDefaultMark, {
                                                  level: effortWords[level],
                                              })
                                            : effortWords[level]
                                    }
                                />
                            ))}
                        </RadioGroup>
                        {costNote && (
                            <FormHelperText aria-live="polite" sx={{ color: g.text.secondary }}>
                                {costNote}
                            </FormHelperText>
                        )}
                        <FormHelperText sx={{ color: g.text.secondary }}>
                            {/* "The estimate is for a report of about 10 tasks" is about the
                                report sentences: a job with no estimate (a skill run) has none. */}
                            {job?.effortCost ? s.effortHint : s.effortHintNoEstimate}
                        </FormHelperText>
                        {held && (
                            <FormHelperText data-testid="schedule-effort-held">
                                {fmt(s.effortHeld, { level: effortWords[held] })}
                            </FormHelperText>
                        )}
                    </FormControl>
                )}

                {deliverOptions.length > 0 && (
                    <FormControl data-testid="schedule-deliver" sx={{ minWidth: 0 }}>
                        <FormLabel>{s.deliverLabel}</FormLabel>
                        <ChatTargetSelect
                            chats={deliverOptions}
                            label={chatLabel}
                            stray={strayChatId}
                            value={form.deliverChannelId}
                            onChange={(id) => set("deliverChannelId", id)}
                        />
                        {chosenChat && (
                            <FormHelperText sx={{ color: g.text.secondary }}>
                                {s[chatHintKey(job, form.params)]}
                            </FormHelperText>
                        )}
                    </FormControl>
                )}

                <Typography level="title-sm">{s.when}</Typography>

                <FormControl sx={{ minWidth: 0 }}>
                    <FormLabel>{s.frequency}</FormLabel>
                    <Select
                        sx={{ minWidth: 0 }}
                        value={form.frequency}
                        onChange={(_, v) => v && set("frequency", v)}
                    >
                        {FREQUENCIES.map((f) => (
                            <Option key={f} value={f}>
                                {s[FREQUENCY_KEYS[f]]}
                            </Option>
                        ))}
                    </Select>
                </FormControl>

                {form.frequency === "weekly" && (
                    <FormControl error={show && !!problems.weekdays} sx={{ minWidth: 0 }}>
                        <FormLabel id="schedule-weekdays-label">{s.weekdays}</FormLabel>
                        <Box
                            aria-labelledby="schedule-weekdays-label"
                            role="group"
                            sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, minWidth: 0 }}
                        >
                            {WEEKDAY_NUMBERS.map((d) => {
                                const on = form.weekdays.includes(d);
                                return (
                                    <Button
                                        key={d}
                                        aria-label={weekdayName(d, locale, "long")}
                                        aria-pressed={on}
                                        color={on ? "primary" : "neutral"}
                                        size="sm"
                                        sx={{ minWidth: 44, px: 1 }}
                                        // Seven chips wrap (the row is flexWrap), they never push the dialog wider.
                                        variant={on ? "solid" : "outlined"}
                                        data-invalid-group={
                                            d === WEEKDAY_NUMBERS[0] && show && problems.weekdays
                                                ? ""
                                                : undefined
                                        }
                                        onClick={() => toggleDay(d)}
                                    >
                                        {weekdayName(d, locale, "short")}
                                    </Button>
                                );
                            })}
                        </Box>
                        {show && problems.weekdays && (
                            <FormHelperText>{s.errorWeekdays}</FormHelperText>
                        )}
                    </FormControl>
                )}

                {form.frequency === "monthly" && (
                    <FormControl error={show && !!problems.monthDay} sx={{ minWidth: 0 }}>
                        <FormLabel>{s.monthDay}</FormLabel>
                        <Input
                            sx={{ maxWidth: 140 }}
                            value={form.monthDay}
                            slotProps={{
                                input: { type: "number", inputMode: "numeric", min: 1, max: 31 },
                            }}
                            onChange={(e) => set("monthDay", e.target.value)}
                        />
                        <FormHelperText sx={{ color: g.text.secondary }}>
                            {s.monthDayHint}
                        </FormHelperText>
                        {show && problems.monthDay && (
                            <FormHelperText>{s.errorMonthDay}</FormHelperText>
                        )}
                    </FormControl>
                )}

                {form.frequency === "once" && (
                    <FormControl error={show && !!problems.runDate} sx={{ minWidth: 0 }}>
                        <FormLabel>{s.runDate}</FormLabel>
                        <Input
                            slotProps={{ input: { type: "date" } }}
                            sx={{ maxWidth: 200 }}
                            value={form.runDate}
                            onChange={(e) => set("runDate", e.target.value)}
                        />
                        {show && problems.runDate && (
                            <FormHelperText>{s.errorRunDate}</FormHelperText>
                        )}
                    </FormControl>
                )}

                <FormControl error={show && !!problems.timeOfDay} sx={{ minWidth: 0 }}>
                    <FormLabel>{s.timeOfDay}</FormLabel>
                    <Input
                        placeholder="09:00"
                        sx={{ maxWidth: 140 }}
                        value={form.timeOfDay}
                        slotProps={{
                            input: {
                                inputMode: "numeric",
                                maxLength: 5,
                                autoComplete: "off",
                                name: "timeOfDay",
                                spellCheck: false,
                                // Times are digits and a colon in every language.
                                dir: "ltr",
                            },
                        }}
                        onChange={(e) => set("timeOfDay", e.target.value)}
                    />
                    {timeZone && (
                        <FormHelperText sx={{ color: g.text.secondary }}>
                            {fmt(s.timeZone, { zone: timeZone })}
                        </FormHelperText>
                    )}
                    {show && problems.timeOfDay && (
                        <FormHelperText>
                            {problems.timeOfDay === "required" ? s.errorRequired : s.errorTime}
                        </FormHelperText>
                    )}
                </FormControl>

                {/* A report in a chat sends no push: it is a message the chat's members read. */}
                {!form.deliverChannelId && (
                    <FormControl orientation="horizontal" sx={{ gap: 1, alignItems: "center" }}>
                        <Switch
                            checked={form.deliverPush}
                            size="sm"
                            onChange={(e) => set("deliverPush", e.target.checked)}
                        />
                        <FormLabel sx={{ m: 0 }}>{s.push}</FormLabel>
                    </FormControl>
                )}

                {duplicate?.kind === "same" && (
                    <Alert color="warning" role="status" size="sm">
                        {fmt(s.duplicateSame, { name: duplicate.schedule.name })}
                    </Alert>
                )}

                {failure && (
                    <Alert color="danger" role="alert" size="sm">
                        {failure}
                    </Alert>
                )}

                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }} useFlexGap>
                    <Button disabled={!!duplicate} loading={busy} size="sm" type="submit">
                        {schedule ? s.save : s.create}
                    </Button>
                    <Button
                        color="neutral"
                        disabled={busy}
                        size="sm"
                        variant="outlined"
                        onClick={onCancel}
                    >
                        {s.cancel}
                    </Button>
                </Stack>
            </Stack>
        </Sheet>
    );
};
