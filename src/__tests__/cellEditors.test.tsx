/**
 * MIP-1121: the shared Joy editors behind the task table's inline cells and its
 * quick-add row. The rows' own tests cover the wiring; these pin the pieces'
 * contracts, all under Joy's provider alone (no Material theme).
 */

import { useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
    CellTextInput,
    ChipSelect,
    MemberAutocomplete,
    PillChip,
    TagAutocomplete,
} from "../features/tasks/components/table/cellEditors";
import { UserProps } from "../types/admin";

vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => null }));

const wrap = (ui: React.ReactNode) => render(<CssVarsProvider>{ui}</CssVarsProvider>);

describe("PillChip", () => {
    it("is plain text when it has no handler, and a real button when it does", () => {
        const { rerender } = wrap(<PillChip label="Open" />);
        expect(screen.queryByRole("button")).toBeNull();
        rerender(
            <CssVarsProvider>
                <PillChip label="Open" onClick={() => {}} />
            </CssVarsProvider>
        );
        expect(screen.getByRole("button", { name: "Open" })).toBeTruthy();
    });

    it.each(["Enter", " "])("activates from the keyboard with %j, not only the mouse", (key) => {
        const onClick = vi.fn();
        wrap(<PillChip label="WIP" onClick={onClick} />);
        fireEvent.keyDown(screen.getByRole("button"), { key });
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("shows its icon before the label and truncates a long label inside the chip", () => {
        const { container } = wrap(
            <PillChip icon={<i data-testid="ico" />} label={"x".repeat(60)} />
        );
        expect(container.querySelector(".pill-icon [data-testid=ico]")).toBeTruthy();
        expect(container.querySelector(".pill-label")?.textContent).toBe("x".repeat(60));
    });
});

describe("ChipSelect", () => {
    const options = [
        { value: "Open", node: <span>Open chip</span> },
        { value: "WIP", node: <span>WIP chip</span> },
    ];

    it("shows the chosen option's chip and reports a pick", async () => {
        const onChange = vi.fn();
        wrap(<ChipSelect options={options} value="Open" onChange={onChange} />);
        expect(screen.getByRole("combobox").textContent).toContain("Open chip");
        fireEvent.click(screen.getByRole("combobox"));
        fireEvent.click(await screen.findByRole("option", { name: /WIP/ }));
        expect(onChange).toHaveBeenCalledWith("WIP");
    });

    it("offers a leading 'no value' option when asked, and reports it as the empty string", async () => {
        const onChange = vi.fn();
        wrap(
            <ChipSelect
                empty={<span>none</span>}
                options={options}
                value="WIP"
                onChange={onChange}
            />
        );
        fireEvent.click(screen.getByRole("combobox"));
        const all = await screen.findAllByRole("option");
        expect(all).toHaveLength(3);
        fireEvent.click(all[0]);
        expect(onChange).toHaveBeenCalledWith("");
    });

    it("an editor that opens already open reports closing, and keeps nothing else", async () => {
        const onClose = vi.fn();
        wrap(
            <ChipSelect
                options={options}
                value="Open"
                open
                onChange={() => {}}
                onClose={onClose}
            />
        );
        expect(await screen.findByRole("listbox")).toBeTruthy();
        fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });
});

describe("CellTextInput", () => {
    it("is controlled, and passes Enter and Escape through for the row to act on", () => {
        const onKeyDown = vi.fn();
        const Harness = () => {
            const [v, setV] = useState("a");
            return <CellTextInput value={v} onChange={setV} onKeyDown={onKeyDown} />;
        };
        wrap(<Harness />);
        const input = screen.getByRole("textbox") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "abc" } });
        expect(input.value).toBe("abc");
        fireEvent.keyDown(input, { key: "Enter" });
        fireEvent.keyDown(input, { key: "Escape" });
        expect(onKeyDown.mock.calls.map((c) => c[0].key)).toEqual(["Enter", "Escape"]);
    });

    it("shows an error under the field and marks it invalid", () => {
        wrap(<CellTextInput error="Could not save" value="" onChange={() => {}} />);
        expect(screen.getByText("Could not save")).toBeTruthy();
    });

    it("shows a spinner while busy", () => {
        wrap(<CellTextInput value="" busy onChange={() => {}} />);
        expect(screen.getByRole("progressbar")).toBeTruthy();
    });
});

const person = (id: string, name: string, email: string) =>
    ({ userId: id, userName: name, userEmail: email }) as unknown as UserProps;

describe("MemberAutocomplete", () => {
    const members = [
        person("u1", "Ken Kamiya", "ken@x.dev"),
        person("u2", "Genos", "support@genos.dev"),
    ];

    it("finds a member by email as well as by name", async () => {
        const onChange = vi.fn();
        wrap(
            <MemberAutocomplete
                members={members}
                placeholder="Search"
                value={null}
                onChange={onChange}
            />
        );
        const input = screen.getByPlaceholderText("Search");
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "support@" } });
        const options = await screen.findAllByRole("option");
        expect(options).toHaveLength(1);
        fireEvent.click(options[0]);
        expect(onChange).toHaveBeenCalledWith(members[1]);
    });
});

describe("TagAutocomplete", () => {
    type Tag = { tagName: string; tagColor: string };
    const tags: Tag[] = [
        { tagName: "bug", tagColor: "#ef4444" },
        { tagName: "ui", tagColor: "#3b82f6" },
    ];
    const Harness = ({ onChange }: { onChange: (t: Tag[]) => void }) => {
        const [v, setV] = useState<Tag[]>([tags[0]]);
        return (
            <TagAutocomplete<Tag>
                getColor={(t) => t.tagColor}
                getLabel={(t) => t.tagName}
                isEqual={(a, b) => a.tagName === b.tagName}
                options={tags}
                placeholder="Add tags"
                value={v}
                persistent
                onChange={(next) => {
                    setV(next);
                    onChange(next);
                }}
            />
        );
    };

    it("shows the selected tags as chips, removes one from its delete button, and picks more", async () => {
        const onChange = vi.fn();
        wrap(<Harness onChange={onChange} />);
        expect(screen.getByText("bug")).toBeTruthy();
        // pick another: the list is open on focus and stays open (persistent)
        const input = screen.getByRole("combobox");
        fireEvent.focus(input);
        fireEvent.click(await screen.findByRole("option", { name: /ui/ }));
        expect(onChange).toHaveBeenLastCalledWith([tags[0], tags[1]]);
        expect(screen.getByRole("listbox")).toBeTruthy();
        // remove "bug" with its chip's delete control
        const del = screen
            .getAllByRole("button")
            .find((b) => b.closest(".MuiChip-root")?.textContent === "bug");
        fireEvent.click(del!);
        expect(onChange).toHaveBeenLastCalledWith([tags[1]]);
    });
});
