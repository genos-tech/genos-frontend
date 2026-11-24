// MIP-2239: the QR code that carries the authenticator secret is drawn in the browser as plain
// SVG geometry (never an HTML string, never a request to a QR service).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QrCode } from "../features/security/QrCode";

const URI = "otpauth://totp/Genos:a%40b.c?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Genos";

describe("QrCode", () => {
    it("draws dark modules on a white plate and names itself for a screen reader", () => {
        render(<QrCode label="QR code to add Genos" value={URI} />);
        const svg = screen.getByRole("img", { name: "QR code to add Genos" });
        expect(svg.tagName.toLowerCase()).toBe("svg");
        expect(svg).toHaveStyle({ background: "white" });
        const path = svg.querySelector("path");
        expect(path?.getAttribute("fill")).toBe("black");
        expect(path?.getAttribute("d")?.length).toBeGreaterThan(500);
    });

    it("is a square with the four-module quiet zone", () => {
        render(<QrCode label="x" value={URI} />);
        const [, , w, h] = (screen.getByTestId("mfa-qr").getAttribute("viewBox") ?? "").split(" ");
        expect(w).toBe(h);
        // Version n has 17 + 4n modules; the plate adds 8.
        expect((Number(w) - 8 - 17) % 4).toBe(0);
    });

    it("is deterministic, and different for a different value", () => {
        const first = render(<QrCode label="x" value={URI} />);
        const d1 = first.container.querySelector("path")?.getAttribute("d");
        first.unmount();
        const again = render(<QrCode label="x" value={URI} />);
        expect(again.container.querySelector("path")?.getAttribute("d")).toBe(d1);
        again.unmount();
        const other = render(<QrCode label="x" value={URI.replace("JBSW", "KBSW")} />);
        expect(other.container.querySelector("path")?.getAttribute("d")).not.toBe(d1);
    });

    it("injects no markup from the value", () => {
        const { container } = render(<QrCode label="x" value={'"><script>alert(1)</script>'} />);
        expect(container.querySelector("script")).toBeNull();
    });
});
