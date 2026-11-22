/**
 * `/contact` (MIP-1261): the form posts only what the API accepts, shows
 * field errors without echoing values, maps 429 and 503 to calm messages, keeps
 * the plain mailto fallback visible, and hides the honeypot from people.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ContactPage from "../lp/ContactPage";
import { CONTACT_COPY } from "../lp/copy/contact";
import { LP_ROUTES } from "../lp/seo/routes";
import { SUPPORT_EMAIL } from "../lp/supportLabels";

const en = CONTACT_COPY.en;

const renderPage = (search = "?lang=en") =>
    render(
        <MemoryRouter initialEntries={[`/contact${search}`]}>
            <ContactPage />
        </MemoryRouter>
    );

const fill = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });

const fillValid = () => {
    fill(en.fields.name, "Taro Yamada");
    fill(en.fields.email, "taro@example.com");
    fill(en.fields.message, "Hello, we would like a demo.");
};

describe("privacy sentence (MIP-1902)", () => {
    afterEach(() => localStorage.removeItem("genos-locale"));

    it.each([
        ["?lang=en", /privacy policy/i],
        ["?lang=ja", /プライバシーポリシー/],
    ] as const)("links the policy (%s)", (search, name) => {
        // A stored language choice outranks `?lang=`, so set the stored choice itself.
        localStorage.setItem("genos-locale", search.endsWith("ja") ? "ja" : "en");
        renderPage(search);
        expect(screen.getByRole("link", { name }).getAttribute("href")).toBe("/privacy");
    });
});

const submit = () => fireEvent.click(screen.getByRole("button", { name: en.submit }));

const mockFetch = (response: Response | Error) => {
    const fn = vi.fn(() =>
        response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
    );
    vi.stubGlobal("fetch", fn);
    return fn;
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("contact page", () => {
    it("is a route in the marketing sitemap list", () => {
        expect(LP_ROUTES.map((r) => r.path)).toContain("/contact");
    });

    it("renders for a visitor, with the mailto fallback visible", () => {
        renderPage();
        expect(screen.getByRole("heading", { level: 1, name: en.title })).toBeTruthy();
        const link = screen.getByRole("link", { name: SUPPORT_EMAIL });
        expect(link.getAttribute("href")).toBe(`mailto:${SUPPORT_EMAIL}`);
    });

    it("preselects the Enterprise topic from ?topic=enterprise", () => {
        renderPage("?lang=en&topic=enterprise");
        expect(screen.getByRole("heading", { level: 1, name: en.enterpriseTitle })).toBeTruthy();
        expect((screen.getByLabelText(en.fields.topic) as HTMLSelectElement).value).toBe(
            "enterprise"
        );
    });

    it("ignores an unknown topic in the query", () => {
        renderPage("?lang=en&topic=sales");
        expect((screen.getByLabelText(en.fields.topic) as HTMLSelectElement).value).toBe(
            "general"
        );
    });

    it("shows inline errors and sends nothing when the form is incomplete", () => {
        const fetchMock = mockFetch(new Response(null, { status: 202 }));
        renderPage();
        fill(en.fields.email, "not-an-address");
        submit();
        expect(screen.getByLabelText(en.fields.name).getAttribute("aria-invalid")).toBe("true");
        expect(screen.getByText(en.errors.invalidEmail)).toBeTruthy();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("posts exactly the API's fields and shows the calm success state", async () => {
        const fetchMock = mockFetch(new Response(null, { status: 202 }));
        renderPage();
        fillValid();
        submit();
        expect(await screen.findByRole("status")).toBeTruthy();
        expect(screen.getByText(en.sent.heading)).toBeTruthy();

        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toMatch(/\/api\/v2\/contact\/$/);
        expect(init.method).toBe("POST");
        expect(init.credentials).toBe("omit");
        expect(JSON.parse(String(init.body))).toEqual({
            name: "Taro Yamada",
            email: "taro@example.com",
            topic: "general",
            message: "Hello, we would like a demo.",
            language: "en",
            website: "",
        });
    });

    it("maps a 400 to the field it names, without echoing the value", async () => {
        mockFetch(
            new Response(JSON.stringify({ errors: { email: "invalid" } }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            })
        );
        renderPage();
        fillValid();
        submit();
        expect(await screen.findByText(en.errors.invalidEmail)).toBeTruthy();
        expect(document.body.textContent ?? "").not.toContain("Taro Yamada");
    });

    it("shows the rate-limit message on a 429 and keeps what was typed", async () => {
        mockFetch(new Response(null, { status: 429 }));
        renderPage();
        fillValid();
        submit();
        expect(await screen.findByRole("alert")).toBeTruthy();
        expect(screen.getByRole("alert").textContent).toBe(en.errors.rateLimited);
        expect((screen.getByLabelText(en.fields.message) as HTMLTextAreaElement).value).toBe(
            "Hello, we would like a demo."
        );
    });

    it("shows the unavailable message when the request fails", async () => {
        mockFetch(new TypeError("network down"));
        renderPage();
        fillValid();
        submit();
        expect((await screen.findByRole("alert")).textContent).toBe(en.errors.unavailable);
    });

    it("keeps the honeypot off the screen and out of the tab order", () => {
        renderPage();
        const trap = document.querySelector<HTMLInputElement>('input[name="website"]');
        expect(trap).toBeTruthy();
        expect(trap?.tabIndex).toBe(-1);
        expect(trap?.closest("[aria-hidden='true']")).toBeTruthy();
    });

    it("sends the honeypot value when a bot fills it", async () => {
        const fetchMock = mockFetch(new Response(null, { status: 202 }));
        renderPage();
        fillValid();
        const trap = document.querySelector<HTMLInputElement>('input[name="website"]');
        fireEvent.change(trap as HTMLInputElement, { target: { value: "http://spam.example" } });
        submit();
        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const body = JSON.parse(
            String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)
        );
        expect(body.website).toBe("http://spam.example");
    });
});
