import { styled } from "@mui/joy";

type PulseDotProps = {
    color?: string;
    /**
     * Pixel size of the dot (width = height). Defaults to 10px to
     * preserve the original inline-next-to-text usage. Callers that
     * render the dot as a status indicator on a sized avatar should
     * pass a size proportional to the avatar's pixel size.
     */
    size?: number;
};

// Pulsing status dot
export const PulseDot = styled("span", {
    shouldForwardProp: (prop) => prop !== "size",
})<PulseDotProps>(({ color = "#ccc", size = 10 }) => ({
    position: "relative",
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    backgroundColor: color,
    display: "inline-block",
    marginLeft: "4px",
    "&::after": {
        content: '""',
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        backgroundColor: color,
        opacity: 0.6,
        animation: "joy-pulse 1.2s infinite ease-in-out",
    },
    "@keyframes joy-pulse": {
        "0%": {
            transform: "scale(1)",
            opacity: 0.8,
        },
        "100%": {
            transform: "scale(2.2)",
            opacity: 0,
        },
    },
}));
