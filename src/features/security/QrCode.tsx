import { useMemo } from "react";
import qrcode from "qrcode-generator";

type Props = {
    /** What the code carries. Drawn in the browser: it holds the authenticator secret, so it
     *  never goes to a QR service. */
    value: string;
    /** Spoken name for a screen reader. */
    label: string;
    /** Side of the square in CSS pixels, quiet zone included. */
    size?: number;
};

const QUIET_ZONE = 4;

/**
 * A QR code as one SVG path.
 *
 * Always dark modules on a white plate with the standard four-module quiet zone, in both
 * themes: scanners read dark-on-light, and a dark theme's inverted code can fail to scan.
 * Built from the module matrix rather than from the library's HTML string, so nothing is
 * injected as markup.
 */
export const QrCode = ({ value, label, size = 192 }: Props) => {
    const { count, path } = useMemo(() => {
        // Type 0 picks the smallest version that fits; M recovers 15% of damage.
        const qr = qrcode(0, "M");
        qr.addData(value, "Byte");
        qr.make();
        const n = qr.getModuleCount();
        let d = "";
        for (let row = 0; row < n; row += 1) {
            for (let col = 0; col < n; col += 1) {
                if (qr.isDark(row, col)) {
                    d += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
                }
            }
        }
        return { count: n, path: d };
    }, [value]);

    const span = count + QUIET_ZONE * 2;
    return (
        <svg
            aria-label={label}
            data-testid="mfa-qr"
            height={size}
            role="img"
            shapeRendering="crispEdges"
            style={{ display: "block", borderRadius: 8, background: "white", maxWidth: "100%" }}
            viewBox={`0 0 ${span} ${span}`}
            width={size}
        >
            <path d={path} fill="black" />
        </svg>
    );
};
