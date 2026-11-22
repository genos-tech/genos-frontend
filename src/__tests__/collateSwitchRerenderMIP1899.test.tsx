/**
 * MIP-1899: a language switch re-sorts in the NEW language in the same render. `compareText`
 * with no `locale` reads the app locale; `<html lang>` is only written in an effect after that
 * render, so before the fix the order stayed the old language's until an unrelated re-render.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { I18nProvider, useTranslation } from "../i18n";
import { compareText, setAppLocale } from "../i18n/collate";

const NAMES = ["张", "王", "李", "陈"];

const Sorted = () => {
    const { setLocale, locale } = useTranslation();
    // Sorted during render, not memoised: the render a language switch triggers.
    const order = [...NAMES].sort((a, b) => compareText(a, b)).join(" ");
    return (
        <>
            <p data-testid="locale">{locale}</p>
            <p data-testid="order">{order}</p>
            <button onClick={() => setLocale("zh")}>zh</button>
        </>
    );
};

afterEach(() => {
    document.documentElement.lang = "";
    setAppLocale("en");
});

describe("language switch re-sorts in the new language", () => {
    it("zh: pinyin order straight after setLocale, without another render", async () => {
        localStorage.setItem("genos.locale", "en");
        document.documentElement.lang = "en";
        render(
            <I18nProvider>
                <Sorted />
            </I18nProvider>
        );
        await act(async () => {
            screen.getByText("zh").click();
        });
        await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("zh"));
        expect(screen.getByTestId("order").textContent).toBe("陈 李 王 张");
    });
});
