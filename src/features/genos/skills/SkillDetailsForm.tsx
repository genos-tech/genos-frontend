import { useState, type KeyboardEvent, type ReactNode } from "react";
import {
    Box,
    Button,
    Chip,
    ChipDelete,
    FormControl,
    FormHelperText,
    FormLabel,
    Input,
    Option,
    Select,
    Textarea,
    ToggleButtonGroup,
    Typography,
} from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { draftFrom, type DraftProblems, type SkillDraft } from "./skillDraft";
import { SkillIconField } from "./SkillIconField";
import { SKILL_LIMITS, type SkillEffort, type SkillRow } from "./skillsApi";
import { normalizeTag, tagProblem } from "./skillText";
import { useEffortLevels } from "./useEffortLevels";

type Props = {
    skill: SkillRow;
    draft: SkillDraft;
    problems: DraftProblems;
    /** A sentence from the server that belongs to one field (a name already taken, say). */
    serverProblems: Partial<Record<"title" | "slug" | "description" | "tags", string>>;
    disabled: boolean;
    /** An editor (not the owner) writes the details too, but the name and who can use the skill
     *  stay the owner's: those two fields are shown, locked, with the reason (MIP-2043). */
    ownerOnly?: boolean;
    /** The "Editors" field, drawn under who can use the skill. */
    editorsField?: ReactNode;
    /** The Hub's "Publish to the Hub" field (MIP-2047), drawn under who can use the skill. */
    hubField?: ReactNode;
    onChange: (next: Partial<SkillDraft>) => void;
};

const FIELD_GAP = 2;

/**
 * The details of a skill: title, the name typed after "/", description, tags, icon, input hint,
 * what it may do, effort and who can use it. Controlled: the editor owns the draft and decides
 * when to save, so a half-typed form never reaches the server.
 */
export const SkillDetailsForm = ({
    skill,
    draft,
    problems,
    serverProblems,
    disabled,
    ownerOnly = false,
    editorsField,
    hubField,
    onChange,
}: Props) => {
    const { t, locale } = useTranslation();
    const f = t.settings.genosSkills.fields;
    const p = t.settings.genosSkills.problems;
    const [tagInput, setTagInput] = useState("");
    const [tagError, setTagError] = useState<string | null>(null);
    // A problem is shown for a field once the person has been in it, or when a save asked.
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const touch = (name: string) => setTouched((prev) => ({ ...prev, [name]: true }));

    const slugText = (() => {
        if (!problems.slug) return null;
        // Left empty is not a mistake until the person leaves the field.
        if (problems.slug === "empty") return p.slugEmpty;
        if (problems.slug === "length") {
            return fmt(p.slugLength, { min: SKILL_LIMITS.slugMin, max: SKILL_LIMITS.slugMax });
        }
        if (problems.slug === "reserved") return fmt(p.slugReserved, { slug: draft.slug.trim() });
        return p.slugChars;
    })();
    const slugShown =
        touched.slug || serverProblems.slug ? (serverProblems.slug ?? slugText) : null;
    const titleShown =
        touched.title && problems.title ? p.titleEmpty : (serverProblems.title ?? null);

    const addTag = (raw: string) => {
        const tag = normalizeTag(raw);
        if (tag === "") return;
        const problem = tagProblem(tag, draft.tags);
        if (problem === "chars") {
            setTagError(fmt(p.tagChars, { max: SKILL_LIMITS.tagMax }));
            return;
        }
        if (problem === "tooMany") {
            setTagError(fmt(p.tagsMax, { max: SKILL_LIMITS.tagsMax }));
            return;
        }
        setTagError(null);
        setTagInput("");
        if (!draft.tags.includes(tag)) onChange({ tags: [...draft.tags, tag] });
    };
    const onTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(tagInput);
        } else if (e.key === "Backspace" && tagInput === "" && draft.tags.length > 0) {
            onChange({ tags: draft.tags.slice(0, -1) });
        }
    };
    // The effort choice, with what each level costs next to the others once the server has said
    // (MIP-2198). Until then, or while the agent is not on effort levels, it is the plain names.
    const levels = useEffortLevels();
    const effortLevels = (["low", "medium", "high"] as const).map((level) => {
        const label = { low: f.effortLow, medium: f.effortMedium, high: f.effortHigh }[level];
        const row = levels?.[level];
        let text: string = label;
        if (row?.locked) text = fmt(f.effortLocked, { label });
        else if (row?.relativeCost != null) {
            text =
                row.relativeCost <= 1
                    ? fmt(f.effortCostBase, { label })
                    : fmt(f.effortCost, { label, n: Number(row.relativeCost.toFixed(1)) });
        }
        return { level, text, locked: row?.locked === true };
    });
    const date = (iso: string | null) =>
        iso ? new Date(iso).toLocaleDateString(locale, { dateStyle: "medium" }) : "";
    const saved = draftFrom(skill);

    return (
        <Box sx={{ display: "grid", gap: FIELD_GAP, minWidth: 0 }}>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "minmax(0, 1fr) 84px", sm: "minmax(0, 1fr) 96px" },
                    gap: 1.5,
                    alignItems: "start",
                }}
            >
                <FormControl error={!!titleShown} required>
                    <FormLabel>{f.title}</FormLabel>
                    <Input
                        disabled={disabled}
                        slotProps={{ input: { maxLength: SKILL_LIMITS.titleMax } }}
                        value={draft.title}
                        onBlur={() => touch("title")}
                        onChange={(e) => onChange({ title: e.target.value })}
                    />
                    {titleShown && <FormHelperText>{titleShown}</FormHelperText>}
                </FormControl>
                <SkillIconField
                    disabled={disabled}
                    value={draft.icon}
                    onChange={(icon) => onChange({ icon })}
                />
            </Box>

            <FormControl error={!!slugShown} required>
                <FormLabel>{f.slug}</FormLabel>
                <Input
                    disabled={disabled || ownerOnly}
                    startDecorator={<Typography level="body-sm">/</Typography>}
                    value={draft.slug}
                    slotProps={{
                        input: { maxLength: SKILL_LIMITS.slugMax, autoCapitalize: "none" },
                    }}
                    onBlur={() => touch("slug")}
                    onChange={(e) => onChange({ slug: e.target.value })}
                />
                <FormHelperText>
                    {ownerOnly
                        ? t.settings.genosSkills.team.ownerOnly
                        : (slugShown ??
                          (draft.slug.trim() !== ""
                              ? fmt(f.slugPreview, {
                                    command: `/${draft.slug.trim().toLowerCase()}`,
                                })
                              : f.slugHelp))}
                </FormHelperText>
            </FormControl>

            <FormControl error={!!serverProblems.description}>
                <FormLabel>{f.description}</FormLabel>
                <Textarea
                    disabled={disabled}
                    minRows={2}
                    slotProps={{ textarea: { maxLength: SKILL_LIMITS.descriptionMax } }}
                    value={draft.description}
                    onChange={(e) => onChange({ description: e.target.value })}
                />
                <FormHelperText sx={{ justifyContent: "space-between", gap: 1 }}>
                    <span>{serverProblems.description ?? f.descriptionHelp}</span>
                    <span aria-hidden>
                        {fmt(f.counter, {
                            count: draft.description.length,
                            max: SKILL_LIMITS.descriptionMax,
                        })}
                    </span>
                </FormHelperText>
            </FormControl>

            <FormControl error={!!tagError || !!serverProblems.tags || !!problems.tags}>
                <FormLabel>{f.tags}</FormLabel>
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 0.5,
                        mb: draft.tags.length ? 0.75 : 0,
                    }}
                >
                    {draft.tags.map((tag) => (
                        <Chip
                            key={tag}
                            size="sm"
                            variant="soft"
                            endDecorator={
                                disabled ? undefined : (
                                    <ChipDelete
                                        aria-label={fmt(f.removeTag, { tag })}
                                        onDelete={() =>
                                            onChange({ tags: draft.tags.filter((x) => x !== tag) })
                                        }
                                    />
                                )
                            }
                        >
                            {tag}
                        </Chip>
                    ))}
                </Box>
                {!disabled && (
                    <Input
                        placeholder={f.tagsPlaceholder}
                        slotProps={{ input: { maxLength: SKILL_LIMITS.tagMax + 1 } }}
                        value={tagInput}
                        endDecorator={
                            <Button
                                disabled={tagInput.trim() === ""}
                                size="sm"
                                variant="plain"
                                onClick={() => addTag(tagInput)}
                            >
                                {t.common.actions.add}
                            </Button>
                        }
                        onBlur={() => addTag(tagInput)}
                        onKeyDown={onTagKeyDown}
                        onChange={(e) => {
                            setTagInput(e.target.value);
                            setTagError(null);
                        }}
                    />
                )}
                <FormHelperText>
                    {tagError ??
                        serverProblems.tags ??
                        fmt(f.tagsHelp, { max: SKILL_LIMITS.tagsMax })}
                </FormHelperText>
            </FormControl>

            <FormControl>
                <FormLabel>{f.argumentHint}</FormLabel>
                <Input
                    disabled={disabled}
                    placeholder="[project] [week]"
                    slotProps={{ input: { maxLength: SKILL_LIMITS.argumentHintMax } }}
                    value={draft.argumentHint}
                    onChange={(e) => onChange({ argumentHint: e.target.value })}
                />
                <FormHelperText>{f.argumentHintHelp}</FormHelperText>
            </FormControl>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
                    gap: FIELD_GAP,
                }}
            >
                <FormControl>
                    <FormLabel id="skill-tool-level">{f.toolLevel}</FormLabel>
                    <ToggleButtonGroup
                        aria-labelledby="skill-tool-level"
                        disabled={disabled}
                        size="sm"
                        sx={{ flexWrap: "wrap", minWidth: 0 }}
                        value={draft.toolLevel}
                        onChange={(_e, value) => value && onChange({ toolLevel: value })}
                    >
                        <Button value="read">{f.toolRead}</Button>
                        <Button value="act">{f.toolAct}</Button>
                    </ToggleButtonGroup>
                </FormControl>
                <FormControl>
                    <FormLabel id="skill-effort">{f.effort}</FormLabel>
                    <Select
                        disabled={disabled}
                        slotProps={{ button: { "aria-labelledby": "skill-effort" } }}
                        value={draft.effort}
                        onChange={(_e, value) =>
                            onChange({ effort: (value ?? "") as SkillEffort })
                        }
                    >
                        <Option value="">{f.effortAuto}</Option>
                        {effortLevels.map(({ level, text, locked }) => (
                            <Option
                                key={level}
                                disabled={locked && draft.effort !== level}
                                value={level}
                            >
                                {text}
                            </Option>
                        ))}
                    </Select>
                    {levels && (
                        <FormHelperText>
                            {draft.effort === "" ? f.effortAutoHelp : f.effortHelp}
                        </FormHelperText>
                    )}
                </FormControl>
            </Box>

            {/* A public skill says so in the Hub row below (and in its byline): the Private/Team
                switch would only show two unselected buttons. */}
            {skill.visibility !== "public" && (
                <FormControl>
                    <FormLabel id="skill-visibility">{f.visibility}</FormLabel>
                    <ToggleButtonGroup
                        aria-labelledby="skill-visibility"
                        disabled={disabled || ownerOnly}
                        size="sm"
                        sx={{ flexWrap: "wrap", minWidth: 0, alignSelf: "flex-start" }}
                        value={draft.visibility}
                        onChange={(_e, value) => value && onChange({ visibility: value })}
                    >
                        <Button value="private">{f.visibilityPrivate}</Button>
                        <Button value="team">{f.visibilityTeam}</Button>
                    </ToggleButtonGroup>
                    {ownerOnly ? (
                        <FormHelperText>{t.settings.genosSkills.team.ownerOnly}</FormHelperText>
                    ) : (
                        draft.visibility === "team" && (
                            <FormHelperText>{f.visibilityTeamHelp}</FormHelperText>
                        )
                    )}
                </FormControl>
            )}

            {hubField}

            {editorsField}

            <Box
                component="dl"
                sx={{
                    display: "grid",
                    gridTemplateColumns: "max-content minmax(0, 1fr)",
                    columnGap: 1.5,
                    rowGap: 0.25,
                    m: 0,
                    typography: "body-xs",
                    color: "text.tertiary",
                }}
            >
                <Box component="dt">{f.owner}</Box>
                <Box component="dd" sx={{ m: 0, overflowWrap: "anywhere" }}>
                    {skill.mine
                        ? f.you
                        : skill.ownerName ||
                          (skill.author
                              ? fmt(t.settings.genosSkills.hub.byHandle, {
                                    handle: skill.author.handle,
                                })
                              : "—")}
                </Box>
                <Box component="dt">{f.created}</Box>
                <Box component="dd" sx={{ m: 0 }}>
                    {date(skill.createdAt)}
                </Box>
                <Box component="dt">{f.updated}</Box>
                <Box component="dd" sx={{ m: 0 }}>
                    {date(skill.updatedAt)}
                </Box>
                {saved.visibility === "team" && skill.publishedAt && (
                    <>
                        <Box component="dt">{f.published}</Box>
                        <Box component="dd" sx={{ m: 0 }}>
                            {date(skill.publishedAt)}
                        </Box>
                    </>
                )}
            </Box>
        </Box>
    );
};
