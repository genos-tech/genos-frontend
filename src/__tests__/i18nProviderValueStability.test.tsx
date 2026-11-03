/**
 * `I18nProvider` must not hand out a new context value on every render
 * (MIP-958). The top of every screen reads `useTranslation()`, so a new
 * `{ t, locale, setLocale }` object on each render re-rendered whole screens
 * whenever the provider's parent re-rendered.
 */

import { memo, useState } from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { I18nProvider, useTranslation } from "../i18n";

type Value = ReturnType<typeof useTranslation>;
const seen: Value[] = [];
let consumerRenders = 0;

// memo(): the only way this re-renders is the context value changing.
const Consumer = memo(() => {
    const value = useTranslation();
    seen.push(value);
    consumerRenders += 1;
    return <span data-testid="locale">{value.locale}</span>;
});

let bump: () => void = () => {};
const Parent = () => {
    const [n, setN] = useState(0);
    bump = () => setN((x) => x + 1);
    return (
        <I18nProvider>
            <span data-testid="n">{n}</span>
            <Consumer />
        </I18nProvider>
    );
};

describe("I18nProvider value", () => {
    it("does not re-render a memoized consumer when only the parent re-renders", () => {
        seen.length = 0;
        consumerRenders = 0;
        render(<Parent />);
        const rendersAfterMount = consumerRenders;
        const first = seen[seen.length - 1];

        for (let i = 0; i < 5; i += 1) act(() => bump());

        expect(screen.getByTestId("n").textContent).toBe("5");
        expect(consumerRenders).toBe(rendersAfterMount);
        expect(seen[seen.length - 1]).toBe(first);
    });

    it("still exposes locale, messages and a setter", () => {
        seen.length = 0;
        render(<Parent />);
        const value = seen[seen.length - 1];
        expect(typeof value.locale).toBe("string");
        expect(typeof value.t).toBe("object");
        expect(typeof value.setLocale).toBe("function");
    });
});
