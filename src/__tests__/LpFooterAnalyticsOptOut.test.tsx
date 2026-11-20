/**
 * The marketing footer's "analytics off" control (MIP-1742). It writes the same stored
 * preference the Settings switch uses, so the choice holds when the person signs in later.
 * All wording is a DRAFT for counsel and the owner (marked TODO(copy) in LpShell).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { LpShell } from "../lp/kit/LpShell";

const PREF_KEY = "genos-analytics-preferences:v1";

const renderFooter = (lang: "ja" | "en") => {
    localStorage.setItem("genos-locale", lang);
    return render(
        <MemoryRouter initialEntries={[`/home?lang=${lang}`]}>
            <LpShell active={null}>{() => <p>page</p>}</LpShell>
        </MemoryRouter>
    );
};

const stored = () => JSON.parse(localStorage.getItem(PREF_KEY) ?? "null");

beforeEach(() => {
    localStorage.clear();
});

describe("marketing footer analytics control", () => {
    it("is a button in the footer that opts out and says so, in English", () => {
        renderFooter("en");
        expect(localStorage.getItem(PREF_KEY)).toBeNull(); // rendering stores nothing
        const off = screen.getByRole("button", { name: "Turn analytics off" });
        expect(off.closest("footer")).not.toBeNull();

        fireEvent.click(off);

        expect(stored()).toEqual({ enabled: false });
        expect(screen.getByRole("status").textContent).toMatch(/Analytics is off/);
        expect(screen.queryByRole("button", { name: "Turn analytics off" })).toBeNull();
    });

    it("can be turned back on", () => {
        renderFooter("en");
        fireEvent.click(screen.getByRole("button", { name: "Turn analytics off" }));
        fireEvent.click(screen.getByRole("button", { name: "Turn on" }));

        expect(stored()).toEqual({ enabled: true });
        expect(screen.getByRole("button", { name: "Turn analytics off" })).toBeTruthy();
    });

    it("shows the stored choice on arrival (set earlier, or in Settings)", () => {
        localStorage.setItem(PREF_KEY, JSON.stringify({ enabled: false }));
        renderFooter("en");
        expect(screen.getByRole("status").textContent).toMatch(/Analytics is off/);
    });

    it("is available in Japanese", () => {
        renderFooter("ja");
        const off = screen.getByRole("button", { name: "分析を停止する" });
        fireEvent.click(off);
        expect(stored()).toEqual({ enabled: false });
        expect(screen.getByRole("status").textContent).toMatch(/分析は停止/);
    });
});
