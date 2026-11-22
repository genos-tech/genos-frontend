import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useDocumentTitle } from "../hooks/useDocumentTitle";

function Probe({ title }: { title: string }) {
    useDocumentTitle(title);
    return null;
}

describe("useDocumentTitle (MIP-1826)", () => {
    it("sets the title and restores the previous one on unmount", () => {
        document.title = "Genos";
        const { rerender, unmount } = render(<Probe title="Sign in | Genos" />);
        expect(document.title).toBe("Sign in | Genos");
        rerender(<Probe title="Sign up | Genos" />);
        expect(document.title).toBe("Sign up | Genos");
        unmount();
        expect(document.title).toBe("Genos");
    });
});
