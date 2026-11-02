import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RequestErrorSnackbar } from "../components/layout/RequestErrorSnackbar";
import { getMessages } from "../i18n";
import { emitRequestError } from "../services/requestErrorNotifier";

// MIP-925. A refused task save is shown with the server's own sentence, as-is;
// every other failure keeps its translated line.
let now = 0;
beforeEach(() => {
    now += 60_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(() => {
    vi.restoreAllMocks();
});

const mount = () =>
    render(
        <CssVarsProvider>
            <RequestErrorSnackbar />
        </CssVarsProvider>
    );

describe("RequestErrorSnackbar", () => {
    it("shows the server's sentence for a serverMessage, untranslated", () => {
        mount();
        act(() => emitRequestError("serverMessage", "custom field 7 must be a number."));
        expect(screen.getByText("custom field 7 must be a number.")).toBeTruthy();
    });

    it("still shows the translated line for the other kinds", () => {
        mount();
        act(() => emitRequestError("serverError"));
        expect(screen.getByText(getMessages().app.snackbar.serverError)).toBeTruthy();
    });

    it("lets the reason replace the generic line raised for the same 400 a moment earlier", () => {
        mount();
        const generic = getMessages().app.snackbar.requestFailed;
        act(() => {
            emitRequestError("requestFailed");
            emitRequestError("serverMessage", "assignee 'u9' is not a member of project 1.");
        });
        expect(screen.getByText("assignee 'u9' is not a member of project 1.")).toBeTruthy();
        expect(screen.queryByText(generic)).toBeNull();
    });
});
