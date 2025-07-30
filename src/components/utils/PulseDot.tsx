import { styled } from "@mui/joy";

// Pulsing status dot
export const PulseDot = styled("span")(({ color = "#ccc" }) => ({
    position: "relative",
    width: "8px",
    height: "8px",
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
