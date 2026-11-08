import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { Box } from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";

import { g, type, type TypeLevel } from "../../../theme/tokens";
import { isImeComposing } from "../../../utils/ime";
import { plainButtonSx } from "../plainButtonStyles";

/**
 * The one inline title editor (MIP-1129). A task title, a note header, a todo
 * row, a graph node and the tag / label managers each hand-rolled "type, press
 * Enter, leave the field" and each got a different subset of it right.
 *
 * Contract (pinned by `InlineTitleEdit.test.tsx`):
 *   - Start: click or Enter / Space on the display button (`activate="click"`),
 *     double-click or Enter (`activate="doubleClick"`, for a title on a card
 *     whose single click means something else), or `editing` from the host (a
 *     "Rename" menu item). `variant="field"` has no display state: the input is
 *     always there, styled as plain text until focused (the task and note
 *     headers, which have always been inputs).
 *   - Enter commits. Escape cancels and does not reach the dialog around it.
 *     Blur commits. ONE commit point: Enter blurs the input and the blur handler
 *     decides, so Enter-then-unmount-then-blur cannot commit twice and Escape
 *     cannot be followed by a ghost commit.
 *   - An input-method composition never commits or cancels: Enter that confirms
 *     a Japanese candidate is not a commit (`isImeComposing`).
 *   - What is committed is the trimmed text. An empty title is refused and an
 *     unchanged one is not reported: both revert silently.
 *   - `maxLength` is enforced by the input; `dir="auto"` keeps the reading order
 *     of the text (Arabic starts at the right, a name with "(DY)" does not flip).
 *
 * `onCommit(next)` is called once with the trimmed text. `onDraftChange` is for
 * the few hosts that mirror the draft live (a note's pending title); it is told
 * the original text again when the edit is cancelled or refused.
 */

export type InlineTitleEditProps = {
    /** The saved title. Changes from outside are shown unless the user is typing. */
    value: string;
    onCommit: (next: string) => void;
    onDraftChange?: (draft: string) => void;
    /** Called when the edit ended without a commit (Escape, empty, unchanged). */
    onCancel?: () => void;
    /** Names the field and the display button (the title itself is the button's text). */
    ariaLabel: string;
    placeholder?: string;
    maxLength?: number;
    variant?: "display" | "field";
    activate?: "click" | "doubleClick";
    /** Controlled editing (display variant). */
    editing?: boolean;
    onEditingChange?: (editing: boolean) => void;
    readOnly?: boolean;
    /** Typography level of the text and the input. */
    level?: TypeLevel;
    /** Custom display content (clickable links cannot live in a button: pass text styling here instead). */
    renderValue?: (value: string) => ReactNode;
    /** Leading content inside the field (an icon). */
    startDecorator?: ReactNode;
    autoFocus?: boolean;
    inputRef?: Ref<HTMLInputElement>;
    testId?: string;
    /** On the outermost element (React Flow's `nodrag nopan` on a graph node). */
    className?: string;
    sx?: SxProps;
    /** Extra style for the input only. */
    inputSx?: SxProps;
};

export const InlineTitleEdit = ({
    value,
    onCommit,
    onDraftChange,
    onCancel,
    ariaLabel,
    placeholder,
    maxLength,
    variant = "display",
    activate = "click",
    editing: editingProp,
    onEditingChange,
    readOnly,
    level = "title-md",
    renderValue,
    startDecorator,
    autoFocus,
    inputRef,
    testId,
    className,
    sx,
    inputSx,
}: InlineTitleEditProps) => {
    const field = variant === "field";
    const [editingState, setEditingState] = useState(false);
    const editing = field ? true : (editingProp ?? editingState);
    const setEditing = (next: boolean) => {
        if (editingProp === undefined) setEditingState(next);
        onEditingChange?.(next);
    };

    const [draft, setDraft] = useState(value);
    // Set by Escape: the blur that follows must not commit.
    const cancelledRef = useRef(false);
    const ownRef = useRef<HTMLInputElement | null>(null);
    const setRefs = (node: HTMLInputElement | null) => {
        ownRef.current = node;
        if (typeof inputRef === "function") inputRef(node);
        else if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = node;
    };

    // The text the edit started from: what Escape and a refused title go back to. It is
    // NOT always `value`: a host that mirrors the draft live (a note's pending title)
    // changes `value` as the user types.
    const baseRef = useRef(value);
    useEffect(() => {
        if (document.activeElement !== ownRef.current) baseRef.current = value;
    }, [value]);

    // Show the saved value whenever the user is not typing (a rename from another
    // surface, a save that normalised the text).
    useEffect(() => {
        if (!editing) setDraft(value);
    }, [value, editing]);

    // A field's draft follows the value while it is not focused.
    useEffect(() => {
        if (field && document.activeElement !== ownRef.current) setDraft(value);
    }, [field, value]);

    // The display variant mounts its input on demand: focus it with the text selected.
    useEffect(() => {
        if (!field && editing) {
            cancelledRef.current = false;
            baseRef.current = value;
            setDraft(value);
            const node = ownRef.current;
            node?.focus();
            node?.select();
        }
        // Only on entering edit mode: later `value` changes must not reselect.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing, field]);

    const finish = (draftNow: string) => {
        const base = baseRef.current;
        const next = draftNow.trim();
        const changed = next !== "" && next !== base;
        if (!changed) {
            if (draftNow !== base) {
                setDraft(base);
                onDraftChange?.(base);
            }
            onCancel?.();
            return;
        }
        if (next !== draftNow) {
            setDraft(next);
            onDraftChange?.(next);
        }
        onCommit(next);
    };

    const onBlur = () => {
        const cancelled = cancelledRef.current;
        cancelledRef.current = false;
        if (!field) setEditing(false);
        if (cancelled) {
            setDraft(baseRef.current);
            return;
        }
        finish(ownRef.current?.value ?? draft);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (isImeComposing(event)) return;
        if (event.key === "Enter") {
            event.preventDefault();
            ownRef.current?.blur();
        } else if (event.key === "Escape") {
            // The edit only: the dialog or graph around it keeps its own Escape.
            event.stopPropagation();
            cancelledRef.current = true;
            setDraft(baseRef.current);
            if (draft !== baseRef.current) onDraftChange?.(baseRef.current);
            onCancel?.();
            ownRef.current?.blur();
        }
    };

    const typography = { ...type(level), fontFamily: "inherit" };

    if (editing && !readOnly) {
        return (
            <Box
                className={className}
                sx={[
                    {
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        minWidth: 0,
                        width: "100%",
                    },
                    ...(Array.isArray(sx) ? sx : [sx]),
                ]}
            >
                {startDecorator}
                <Box
                    ref={setRefs}
                    aria-label={ariaLabel}
                    autoFocus={autoFocus}
                    component="input"
                    data-testid={testId}
                    dir="auto"
                    maxLength={maxLength}
                    placeholder={placeholder}
                    type="text"
                    value={draft}
                    sx={[
                        {
                            ...typography,
                            flex: 1,
                            minWidth: 0,
                            boxSizing: "border-box",
                            padding: "2px 4px",
                            margin: "-2px -4px",
                            color: g.text.primary,
                            background: "transparent",
                            border: 0,
                            borderRadius: g.radius.xs,
                            outline: "none",
                            textOverflow: "ellipsis",
                            "&::placeholder": { color: g.text.tertiary, opacity: 1 },
                            "&:hover": field ? { background: g.hover } : undefined,
                            "&:focus": {
                                background: g.hover,
                                boxShadow: `inset 0 0 0 1px ${g.focus}`,
                            },
                        },
                        ...(Array.isArray(inputSx) ? inputSx : [inputSx]),
                    ]}
                    onBlur={onBlur}
                    onKeyDown={onKeyDown}
                    onChange={(event: { target: HTMLInputElement }) => {
                        setDraft(event.target.value);
                        onDraftChange?.(event.target.value);
                    }}
                    onFocus={() => {
                        cancelledRef.current = false;
                        baseRef.current = value;
                    }}
                />
            </Box>
        );
    }

    const shown = renderValue ? renderValue(value) : value || placeholder;
    return (
        <Box
            aria-label={`${ariaLabel}: ${value}`.trim()}
            className={className}
            component="button"
            data-testid={testId}
            dir="auto"
            disabled={readOnly}
            type="button"
            sx={[
                plainButtonSx,
                {
                    ...typography,
                    color: value ? g.text.primary : g.text.tertiary,
                    textAlign: "start",
                    minWidth: 0,
                    maxWidth: "100%",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.75,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    cursor: readOnly ? "default" : "text",
                },
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            onClick={activate === "click" && !readOnly ? () => setEditing(true) : undefined}
            onDoubleClick={
                activate === "doubleClick" && !readOnly ? () => setEditing(true) : undefined
            }
            onKeyDown={
                activate === "doubleClick" && !readOnly
                    ? (event: KeyboardEvent<HTMLElement>) => {
                          // A native button's Enter / Space produce a click, which this
                          // variant ignores: start the edit from the key itself.
                          if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setEditing(true);
                          }
                      }
                    : undefined
            }
        >
            {startDecorator}
            {shown}
        </Box>
    );
};
