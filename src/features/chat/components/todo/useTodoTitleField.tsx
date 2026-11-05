import { ChangeEvent, KeyboardEvent, useCallback, useRef, useState } from "react";

import { useLinkifyPaste } from "./titleLinks";
import { TodoTitleMentionLayer, useTodoTitleMentions } from "./titleMentions";

type Args = {
    value: string;
    setValue: (next: string) => void;
    /** False for a field that isn't mounted/open right now (the title editor,
     *  the sub-item adder): no paste listener, no matching work, no menu. */
    enabled?: boolean;
    /**
     * The host's own keys (Enter to add, Escape to cancel...). Runs only when
     * the `@`/`#` picker did NOT take the key, so Enter completes a mention
     * instead of submitting a half-typed "@ali".
     */
    onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
};

/**
 * Everything a to-do TITLE field is, in one place (MIP-1047): paste a URL
 * over a selected word to link it, and the `@` / `#` picker with its live
 * highlight. The to-do list's four title fields and the scheduled-to-do form
 * all use this, so they cannot drift apart again.
 *
 * Spread `inputProps` on a Joy `<Input>`, put `layer` next to it inside a
 * `position: relative` row, and give that row `anchorRef`.
 */
export const useTodoTitleField = ({ value, setValue, enabled = true, onKeyDown }: Args) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const anchorRef = useRef<HTMLDivElement | null>(null);

    // Whether the <input> exists yet. A field inside a modal mounts in a later
    // commit than the hook's first effect (the portal fills in afterwards), and
    // the paste listener is attached by an effect that only re-runs when its
    // inputs change. Without this the listener was never attached there.
    const [mounted, setMounted] = useState(false);
    const setInputNode = useCallback((node: HTMLInputElement | null) => {
        inputRef.current = node;
        setMounted(node !== null);
    }, []);

    // Select a word, paste a URL → "[word](url)".
    useLinkifyPaste(inputRef, value, setValue, enabled && mounted);
    const mentions = useTodoTitleMentions({ inputRef, value, setValue, enabled });

    const inputProps = {
        slotProps: { input: { ref: setInputNode } },
        value,
        onClick: mentions.syncCaret,
        onKeyUp: mentions.syncCaret,
        onChange: (e: ChangeEvent<HTMLInputElement>) => {
            setValue(e.target.value);
            mentions.syncCaret();
        },
        onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
            // Picker first: it owns Enter / Arrows / Escape while it is open.
            if (mentions.handleKeyDown(e)) return;
            onKeyDown?.(e);
        },
    };

    const layer = enabled ? (
        <TodoTitleMentionLayer
            anchorRef={anchorRef}
            inputRef={inputRef}
            mentions={mentions}
            value={value}
        />
    ) : null;

    return { inputRef, anchorRef, inputProps, layer, mentions };
};
