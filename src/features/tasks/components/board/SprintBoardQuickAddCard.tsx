import { useEffect, useRef, useState } from "react";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Box, Button, IconButton, Input, Option, Select, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useQuickAddRequiredFieldsPreference } from "../../../../hooks/common/useQuickAddRequiredFieldsPreference";
import { fmt, useTranslation } from "../../../../i18n";
import { LimitReachedError } from "../../../../services/limitErrors";
import { TagListProps } from "../../../../types/tasks";
import { QuickAddDraft } from "../../utils/quickAddDraft";
import {
    applyRuleDefaults,
    getQuickAddBlockingFields,
    TaskFieldRules,
} from "../../utils/taskFieldRules";
import { priorities, taskMetaLabel } from "../../utils/taskMeta";
import { ProjectTagChip } from "../ProjectTagChip";

type SprintBoardQuickAddCardProps = {
    projectId: number | null;
    // The focused project's tags: options for the picker, and the "tags
    // required is inactive with zero tags" liveness check.
    projectTags: TagListProps[];
    // Owner-configured field rules for the project (null when none / not
    // loaded; the gate then fails open). Defaults always seed the card;
    // required fields block only when the user opts in (Settings → Tasks),
    // exactly as in the table's quick-add row.
    fieldRules: TaskFieldRules | null;
    teamMemberIds: string[];
    creatorUserId: string;
    // The board owns the create call and the optimistic insert. A rejection
    // lands here as an inline error and the typed title is kept.
    onSubmit: (draft: QuickAddDraft) => Promise<void>;
    onClose: () => void;
};

// Joy's Select/Autocomplete popups render in portals, outside this card's
// DOM, so a click in one is an interaction WITH the card.
const POPUP_SELECTOR = '[role="listbox"], [role="option"], .MuiPopper-root, .MuiModal-root';
// Pressing a board card may be the start of a drag. Closing the card then
// would pull every card in the column up under the pointer before the drag
// has lifted, so a press on a card never counts as a click outside.
const DRAGGABLE_SELECTOR = "[data-rfd-draggable-id]";

// The draft card at the top of the board's Open column. Not a dnd Draggable
// and not inside the Droppable, so it takes no drag index and stays in view
// however far the column is scrolled. Enter or the Create button creates,
// Esc discards, and a click outside discards only while the title is empty
// (a typed title is unsaved work; a stray click must not destroy it).
export const SprintBoardQuickAddCard = ({
    projectId,
    projectTags,
    fieldRules,
    teamMemberIds,
    creatorUserId,
    onSubmit,
    onClose,
}: SprintBoardQuickAddCardProps) => {
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { enforce: enforceRequiredFields } = useQuickAddRequiredFieldsPreference();

    // Seed from the project's configured defaults once (the card is
    // transient: it remounts per open).
    const [seed] = useState(() =>
        applyRuleDefaults(
            {
                projectId,
                dueDate: null,
                status: null,
                priority: null,
                effortLevel: null,
                tags: [],
                assigneeId: null,
                reporterId: null,
            },
            fieldRules ?? {},
            { creatorUserId, teamMemberIds, projectTags }
        )
    );
    const [title, setTitle] = useState("");
    const [priority, setPriority] = useState<string | null>(seed.priority);
    const [tagNames, setTagNames] = useState<string[]>(seed.tags.map((tag) => tag.tagName));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const rootRef = useRef<HTMLDivElement | null>(null);
    // Read from the document-level mousedown listener, which is registered
    // once: refs keep it from rebinding per keystroke.
    const titleRef = useRef("");
    const isSubmittingRef = useRef(false);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        const onDocMouseDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target || rootRef.current?.contains(target)) return;
            if (target.closest(POPUP_SELECTOR) || target.closest(DRAGGABLE_SELECTOR)) return;
            if (isSubmittingRef.current || titleRef.current.trim() !== "") return;
            onCloseRef.current();
        };
        document.addEventListener("mousedown", onDocMouseDown);
        return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, []);

    const submit = async () => {
        const trimmed = title.trim();
        // In-flight guard: a second Enter while the POST is out must not
        // create a duplicate.
        if (trimmed === "" || isSubmittingRef.current) return;
        const tags = projectTags.filter((tag) => tagNames.includes(tag.tagName));
        const missing = getQuickAddBlockingFields(
            {
                projectId,
                dueDate: seed.dueDate,
                status: seed.status,
                priority,
                effortLevel: seed.effortLevel,
                tags,
                assigneeId: seed.assigneeId,
                reporterId: creatorUserId,
            },
            fieldRules ?? {},
            { kind: "task", projectTags },
            { enforceRequiredFields }
        );
        if (missing.length > 0) {
            setError(
                fmt(t.tasks.table.quickAddMissingRequired, {
                    fields: missing.map((field) => t.tasks.fields[field]).join(", "),
                })
            );
            return;
        }
        isSubmittingRef.current = true;
        setIsSubmitting(true);
        setError(null);
        try {
            await onSubmit({
                title: trimmed,
                assigneeId: seed.assigneeId,
                status: seed.status ?? "Open",
                priority,
                effortLevel: seed.effortLevel,
                dueDate: seed.dueDate,
                tags,
            });
            onClose();
        } catch (err) {
            // A plan-limit rejection explains itself; anything else gets the
            // generic copy. Either way the draft stays.
            setError(
                err instanceof LimitReachedError && err.message
                    ? err.message
                    : t.tasks.table.quickAddError
            );
        } finally {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    const dim = isDark ? "#888" : "#777";

    return (
        <Box
            ref={rootRef}
            data-testid="board-quick-add-card"
            sx={{
                flexShrink: 0,
                m: 1,
                mb: 0,
                p: "10px 12px",
                borderRadius: "6px",
                backgroundColor: isDark ? "#1a1a24" : "#ffffff",
                border: isDark
                    ? "1px solid rgba(var(--gp-brandalt-400-rgb), 0.4)"
                    : "1px solid rgba(var(--gp-brand-700-rgb), 0.3)",
                boxShadow: isDark
                    ? "0 4px 12px rgba(0, 0, 0, 0.3)"
                    : "0 4px 12px rgba(0, 0, 0, 0.1)",
            }}
        >
            <Input
                disabled={isSubmitting}
                placeholder={t.tasks.board.quickAddPlaceholder}
                size="sm"
                slotProps={{ input: { "aria-label": t.tasks.board.quickAddPlaceholder } }}
                sx={{ "--Input-focusedThickness": "0px", px: 0, fontWeight: 500 }}
                value={title}
                variant="plain"
                autoFocus
                onChange={(e) => {
                    setTitle(e.target.value);
                    titleRef.current = e.target.value;
                    if (error) setError(null);
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        void submit();
                    } else if (e.key === "Escape") {
                        e.preventDefault();
                        onClose();
                    }
                }}
            />
            <Box sx={{ display: "flex", gap: 0.75, mt: 0.75, flexWrap: "wrap" }}>
                <Select
                    disabled={isSubmitting}
                    placeholder={t.tasks.board.quickAddPriority}
                    size="sm"
                    slotProps={{ button: { "aria-label": t.tasks.board.quickAddPriority } }}
                    sx={{ minWidth: 96, flex: "0 1 auto" }}
                    value={priority}
                    variant="outlined"
                    onChange={(_, value) => setPriority(value ?? null)}
                >
                    {priorities.map((opt) => (
                        <Option key={opt.priority} value={opt.priority}>
                            {taskMetaLabel(opt.priority, t.tasks.filters)}
                        </Option>
                    ))}
                </Select>
                {projectTags.length > 0 && (
                    <Select
                        disabled={isSubmitting}
                        placeholder={t.tasks.board.quickAddTags}
                        size="sm"
                        slotProps={{ button: { "aria-label": t.tasks.board.quickAddTags } }}
                        sx={{ minWidth: 96, flex: "0 1 auto", maxWidth: "100%" }}
                        value={tagNames}
                        variant="outlined"
                        renderValue={(selected) => (
                            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                                {selected.map((option) => {
                                    const tag = projectTags.find(
                                        (x) => x.tagName === option.value
                                    );
                                    return (
                                        <ProjectTagChip
                                            key={String(option.value)}
                                            isDark={isDark}
                                            label={String(option.value)}
                                            tagColor={tag?.tagColor ?? "#888"}
                                        />
                                    );
                                })}
                            </Box>
                        )}
                        multiple
                        onChange={(_, value) => setTagNames(value)}
                    >
                        {projectTags.map((tag) => (
                            <Option key={tag.tagName} value={tag.tagName}>
                                <ProjectTagChip
                                    isDark={isDark}
                                    label={tag.tagName}
                                    tagColor={tag.tagColor}
                                />
                            </Option>
                        ))}
                    </Select>
                )}
            </Box>
            {error && (
                <Typography level="body-xs" role="alert" sx={{ mt: 0.75, color: "danger.500" }}>
                    {error}
                </Typography>
            )}
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5, mt: 0.75 }}>
                <IconButton
                    aria-label={t.tasks.board.quickAddCancel}
                    disabled={isSubmitting}
                    size="sm"
                    sx={{ color: dim }}
                    variant="plain"
                    onClick={onClose}
                >
                    <CloseRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <Button
                    disabled={isSubmitting || title.trim() === ""}
                    loading={isSubmitting}
                    size="sm"
                    startDecorator={<CheckRoundedIcon sx={{ fontSize: 16 }} />}
                    variant="soft"
                    onClick={() => void submit()}
                >
                    {t.tasks.board.quickAddCreate}
                </Button>
            </Box>
        </Box>
    );
};
