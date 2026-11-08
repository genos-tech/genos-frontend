/**
 * The shared InlineTitleEdit (MIP-1129): click/Enter to edit, Enter commits once,
 * Escape cancels (and stays inside the field), blur commits, an input-method
 * composition never commits, an empty or unchanged title is not reported.
 */
import { useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InlineTitleEdit } from "../components/ui/fields/InlineTitleEdit";

afterEach(cleanup);

type Props = Partial<React.ComponentProps<typeof InlineTitleEdit>>;

const Host = ({
    initial = "Plan the launch",
    onCommit,
    onOuterKey,
    ...rest
}: Props & { initial?: string; onOuterKey?: (k: string) => void }) => {
    const [value, setValue] = useState(initial);
    return (
        <CssVarsProvider>
            <div onKeyDown={(e) => onOuterKey?.(e.key)}>
                <InlineTitleEdit
                    ariaLabel="Task title"
                    value={value}
                    onCommit={(next) => {
                        setValue(next);
                        onCommit?.(next);
                    }}
                    {...rest}
                />
            </div>
        </CssVarsProvider>
    );
};

const startEdit = () => {
    fireEvent.click(screen.getByRole("button", { name: /Task title/ }));
    return screen.getByRole("textbox", { name: "Task title" }) as HTMLInputElement;
};
// A user types into a focused input; jsdom's `change` does not focus it.
const type = (el: HTMLInputElement, value: string) => {
    el.focus();
    fireEvent.change(el, { target: { value } });
};

describe("InlineTitleEdit (display variant)", () => {
    it("shows the title as a real button named after the field and the title", () => {
        render(<Host />);
        const button = screen.getByRole("button", { name: "Task title: Plan the launch" });
        expect(button.tagName).toBe("BUTTON");
        expect(button.textContent).toBe("Plan the launch");
        expect(button.getAttribute("dir")).toBe("auto");
    });

    it("a click starts the edit with the text selected", () => {
        render(<Host />);
        const el = startEdit();
        expect(el.value).toBe("Plan the launch");
        expect(document.activeElement).toBe(el);
        expect(el.selectionStart).toBe(0);
        expect(el.selectionEnd).toBe("Plan the launch".length);
    });

    it("Enter commits ONCE, with the trimmed text, and shows the new title", () => {
        const onCommit = vi.fn();
        render(<Host onCommit={onCommit} />);
        const el = startEdit();
        type(el, "  Ship the launch  ");
        fireEvent.keyDown(el, { key: "Enter" });
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(onCommit).toHaveBeenCalledWith("Ship the launch");
        expect(screen.getByRole("button", { name: "Task title: Ship the launch" })).toBeTruthy();
    });

    it("Enter then the blur it causes is not a second commit", () => {
        const onCommit = vi.fn();
        render(<Host onCommit={onCommit} />);
        const el = startEdit();
        type(el, "New");
        fireEvent.keyDown(el, { key: "Enter" });
        fireEvent.blur(el);
        expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it("blur commits", () => {
        const onCommit = vi.fn();
        render(<Host onCommit={onCommit} />);
        const el = startEdit();
        type(el, "From blur");
        fireEvent.blur(el);
        expect(onCommit).toHaveBeenCalledWith("From blur");
    });

    it("Escape cancels, restores the old title, and the blur after it commits nothing", () => {
        const onCommit = vi.fn();
        const onCancel = vi.fn();
        const outer = vi.fn();
        render(<Host onCancel={onCancel} onCommit={onCommit} onOuterKey={outer} />);
        const el = startEdit();
        type(el, "Typed then abandoned");
        fireEvent.keyDown(el, { key: "Escape" });
        fireEvent.blur(el);
        expect(onCommit).not.toHaveBeenCalled();
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button", { name: "Task title: Plan the launch" })).toBeTruthy();
        // The dialog around the field keeps its Escape.
        expect(outer).not.toHaveBeenCalled();
    });

    it("Enter that confirms an IME candidate is not a commit", () => {
        const onCommit = vi.fn();
        render(<Host onCommit={onCommit} />);
        const el = startEdit();
        type(el, "にほんご");
        fireEvent.keyDown(el, { key: "Enter", isComposing: true });
        fireEvent.keyDown(el, { key: "Enter", keyCode: 229 });
        expect(onCommit).not.toHaveBeenCalled();
        expect(screen.getByRole("textbox", { name: "Task title" })).toBeTruthy();
        // After the composition ends, Enter commits.
        fireEvent.keyDown(el, { key: "Enter" });
        expect(onCommit).toHaveBeenCalledWith("にほんご");
    });

    it("Escape during an IME composition does not cancel the edit", () => {
        render(<Host />);
        const el = startEdit();
        type(el, "にほ");
        fireEvent.keyDown(el, { key: "Escape", isComposing: true });
        expect(screen.getByRole("textbox", { name: "Task title" })).toBeTruthy();
    });

    it("an empty (or whitespace) title is refused: reverts, commits nothing", () => {
        const onCommit = vi.fn();
        render(<Host onCommit={onCommit} />);
        let el = startEdit();
        type(el, "   ");
        fireEvent.keyDown(el, { key: "Enter" });
        expect(onCommit).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Task title: Plan the launch" })).toBeTruthy();
        el = startEdit();
        type(el, "");
        fireEvent.blur(el);
        expect(onCommit).not.toHaveBeenCalled();
    });

    it("an unchanged title is not reported", () => {
        const onCommit = vi.fn();
        render(<Host onCommit={onCommit} />);
        const el = startEdit();
        type(el, "Plan the launch  ");
        fireEvent.keyDown(el, { key: "Enter" });
        expect(onCommit).not.toHaveBeenCalled();
    });

    it("maxLength reaches the input", () => {
        render(<Host maxLength={20} />);
        expect(startEdit().maxLength).toBe(20);
    });

    it("the input reads its direction from the text", () => {
        render(<Host />);
        expect(startEdit().getAttribute("dir")).toBe("auto");
    });

    it("readOnly never starts an edit", () => {
        render(<Host readOnly />);
        const button = screen.getByRole("button", { name: /Task title/ });
        expect((button as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(button);
        expect(screen.queryByRole("textbox")).toBeNull();
    });

    it("a rename from outside shows while the user is not typing, not while they are", () => {
        const Outer = () => {
            const [v, setV] = useState("A");
            return (
                <CssVarsProvider>
                    <button type="button" onClick={() => setV((x) => `${x}!`)}>
                        remote
                    </button>
                    <InlineTitleEdit ariaLabel="T" value={v} onCommit={() => {}} />
                </CssVarsProvider>
            );
        };
        render(<Outer />);
        fireEvent.click(screen.getByText("remote"));
        expect(screen.getByRole("button", { name: "T: A!" })).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "T: A!" }));
        const el = screen.getByRole("textbox", { name: "T" }) as HTMLInputElement;
        type(el, "typing");
        act(() => {
            fireEvent.click(screen.getByText("remote"));
        });
        expect((screen.getByRole("textbox", { name: "T" }) as HTMLInputElement).value).toBe(
            "typing"
        );
    });

    it("controlled `editing` opens the field from a Rename menu item", () => {
        const Outer = () => {
            const [editing, setEditing] = useState(false);
            return (
                <CssVarsProvider>
                    <button type="button" onClick={() => setEditing(true)}>
                        rename
                    </button>
                    <InlineTitleEdit
                        ariaLabel="T"
                        editing={editing}
                        value="A"
                        onCommit={() => {}}
                        onEditingChange={setEditing}
                    />
                </CssVarsProvider>
            );
        };
        render(<Outer />);
        fireEvent.click(screen.getByText("rename"));
        expect(screen.getByRole("textbox", { name: "T" })).toBeTruthy();
        fireEvent.keyDown(screen.getByRole("textbox", { name: "T" }), { key: "Escape" });
        expect(screen.queryByRole("textbox")).toBeNull();
    });

    it("activate=doubleClick: a single click does not edit; double-click and Enter do", () => {
        render(<Host activate="doubleClick" />);
        const button = screen.getByRole("button", { name: /Task title/ });
        fireEvent.click(button);
        expect(screen.queryByRole("textbox")).toBeNull();
        fireEvent.doubleClick(button);
        expect(screen.getByRole("textbox", { name: "Task title" })).toBeTruthy();
        cleanup();
        render(<Host activate="doubleClick" />);
        fireEvent.keyDown(screen.getByRole("button", { name: /Task title/ }), { key: "Enter" });
        expect(screen.getByRole("textbox", { name: "Task title" })).toBeTruthy();
    });
});

describe("InlineTitleEdit (field variant)", () => {
    it("is an input from the start and commits on Enter / blur like the display one", () => {
        const onCommit = vi.fn();
        render(<Host variant="field" onCommit={onCommit} />);
        const el = screen.getByRole("textbox", { name: "Task title" }) as HTMLInputElement;
        expect(screen.queryByRole("button")).toBeNull();
        type(el, "Field title");
        fireEvent.keyDown(el, { key: "Enter" });
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(onCommit).toHaveBeenCalledWith("Field title");
    });

    it("Escape puts the saved title back and commits nothing", () => {
        const onCommit = vi.fn();
        render(<Host variant="field" onCommit={onCommit} />);
        const el = screen.getByRole("textbox", { name: "Task title" }) as HTMLInputElement;
        type(el, "oops");
        fireEvent.keyDown(el, { key: "Escape" });
        fireEvent.blur(el);
        expect(onCommit).not.toHaveBeenCalled();
        expect(el.value).toBe("Plan the launch");
    });

    it("a host that mirrors the draft is told the live text, and the old text on cancel", () => {
        const draft = vi.fn();
        render(<Host variant="field" onDraftChange={draft} />);
        const el = screen.getByRole("textbox", { name: "Task title" }) as HTMLInputElement;
        type(el, "abc");
        expect(draft).toHaveBeenLastCalledWith("abc");
        fireEvent.keyDown(el, { key: "Escape" });
        expect(draft).toHaveBeenLastCalledWith("Plan the launch");
    });

    it("an empty title is refused and the host mirror is told the old text again", () => {
        const draft = vi.fn();
        const onCommit = vi.fn();
        render(<Host variant="field" onCommit={onCommit} onDraftChange={draft} />);
        const el = screen.getByRole("textbox", { name: "Task title" }) as HTMLInputElement;
        type(el, "");
        fireEvent.blur(el);
        expect(onCommit).not.toHaveBeenCalled();
        expect(draft).toHaveBeenLastCalledWith("Plan the launch");
        expect(el.value).toBe("Plan the launch");
    });

    it("a field that starts empty (a new task) commits the first title typed", () => {
        const onCommit = vi.fn();
        render(<Host initial="" placeholder="Title" variant="field" onCommit={onCommit} />);
        const el = screen.getByRole("textbox", { name: "Task title" }) as HTMLInputElement;
        type(el, "First");
        fireEvent.blur(el);
        expect(onCommit).toHaveBeenCalledWith("First");
    });

    it("a host that mirrors the draft into `value` still gets the ORIGINAL text back on Escape / empty", () => {
        const Mirror = ({ onCommit }: { onCommit: (v: string) => void }) => {
            const [live, setLive] = useState("Saved title");
            return (
                <CssVarsProvider>
                    <InlineTitleEdit
                        ariaLabel="T"
                        value={live}
                        variant="field"
                        onCommit={onCommit}
                        onDraftChange={setLive}
                    />
                    <output data-testid="live">{live}</output>
                </CssVarsProvider>
            );
        };
        const onCommit = vi.fn();
        render(<Mirror onCommit={onCommit} />);
        const el = screen.getByRole("textbox", { name: "T" }) as HTMLInputElement;
        type(el, "");
        expect(screen.getByTestId("live").textContent).toBe("");
        fireEvent.blur(el);
        expect(screen.getByTestId("live").textContent).toBe("Saved title");
        expect(onCommit).not.toHaveBeenCalled();
        type(el, "Half typed");
        fireEvent.keyDown(el, { key: "Escape" });
        expect(screen.getByTestId("live").textContent).toBe("Saved title");
        expect(onCommit).not.toHaveBeenCalled();
        type(el, "Real change");
        fireEvent.blur(el);
        expect(onCommit).toHaveBeenCalledWith("Real change");
    });
});
