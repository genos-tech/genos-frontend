/**
 * `FreezeWhenHidden` skips a hidden screen's re-render, but never the render
 * that hides it, the render that shows it, a context change, or its own state
 * (MIP-959).
 */

import { createContext, useContext, useState, type ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FreezeWhenHidden } from "../components/layout/FreezeWhenHidden";

const Ctx = createContext("ctx-0");

let renders = 0;
let lastProps = { value: 0, isActiveRoute: true };

// Stands in for ChatHome / TaskHome / NoteHome: props from the parent, a
// context it reads, and some state of its own.
const Home = ({ value, isActiveRoute }: { value: number; isActiveRoute: boolean }) => {
    const ctx = useContext(Ctx);
    const [own, setOwn] = useState(0);
    renders += 1;
    lastProps = { value, isActiveRoute };
    return (
        <button data-testid="home" onClick={() => setOwn((n) => n + 1)}>
            {`${value}|${isActiveRoute}|${ctx}|${own}`}
        </button>
    );
};

let setParent: (v: { value: number; active: boolean; ctx: string }) => void = () => {};

// Mirrors AppBody: every render builds a new element for the screen with new
// props, and passes `active` to the gate.
const Parent = ({ children }: { children?: ReactNode }) => {
    const [s, set] = useState({ value: 0, active: true, ctx: "ctx-0" });
    setParent = set;
    return (
        <Ctx.Provider value={s.ctx}>
            <FreezeWhenHidden active={s.active}>
                <Home value={s.value} isActiveRoute={s.active} />
            </FreezeWhenHidden>
            {children}
        </Ctx.Provider>
    );
};

const push = (v: { value: number; active: boolean; ctx: string }) => act(() => setParent(v));
const text = () => screen.getByTestId("home").textContent;

describe("FreezeWhenHidden", () => {
    it("re-renders the screen on every parent render while it is active", () => {
        renders = 0;
        render(<Parent />);
        const base = renders;
        push({ value: 1, active: true, ctx: "ctx-0" });
        push({ value: 2, active: true, ctx: "ctx-0" });
        expect(renders).toBe(base + 2);
        expect(text()).toBe("2|true|ctx-0|0");
    });

    it("renders once when it becomes hidden, and the screen sees isActiveRoute = false", () => {
        renders = 0;
        render(<Parent />);
        const base = renders;
        push({ value: 0, active: false, ctx: "ctx-0" });
        expect(renders).toBe(base + 1);
        expect(lastProps.isActiveRoute).toBe(false);
        expect(text()).toBe("0|false|ctx-0|0");
    });

    it("skips every parent render while it stays hidden", () => {
        render(<Parent />);
        push({ value: 0, active: false, ctx: "ctx-0" });
        renders = 0;
        for (let v = 1; v <= 10; v += 1) push({ value: v, active: false, ctx: "ctx-0" });
        expect(renders).toBe(0);
        expect(text()).toBe("0|false|ctx-0|0");
    });

    it("renders with the latest props when it is shown again", () => {
        render(<Parent />);
        push({ value: 0, active: false, ctx: "ctx-0" });
        for (let v = 1; v <= 10; v += 1) push({ value: v, active: false, ctx: "ctx-0" });
        renders = 0;
        push({ value: 10, active: true, ctx: "ctx-0" });
        expect(renders).toBe(1);
        expect(lastProps).toEqual({ value: 10, isActiveRoute: true });
        expect(text()).toBe("10|true|ctx-0|0");
    });

    it("still delivers context changes to a hidden screen", () => {
        render(<Parent />);
        push({ value: 0, active: false, ctx: "ctx-0" });
        push({ value: 0, active: false, ctx: "ctx-1" });
        expect(text()).toBe("0|false|ctx-1|0");
    });

    it("still lets a hidden screen update its own state", () => {
        render(<Parent />);
        push({ value: 0, active: false, ctx: "ctx-0" });
        push({ value: 7, active: false, ctx: "ctx-0" });
        fireEvent.click(screen.getByTestId("home"));
        // Own state moved; the props it renders with are still the ones from
        // the last render that went through.
        expect(text()).toBe("0|false|ctx-0|1");
    });
});
