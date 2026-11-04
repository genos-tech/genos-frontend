import { Divider, Typography } from "@mui/joy";

// Section divider component
export const SectionDivider = ({ isDark }: { isDark: boolean }) => (
    <Divider
        sx={{
            my: 2,
            opacity: isDark ? 0.08 : 0.12,
        }}
    />
);

// Section header component
export const SectionHeader = ({
    children,
    isDark,
}: {
    children: React.ReactNode;
    isDark: boolean;
}) => (
    <Typography
        level="body-xs"
        sx={{
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontSize: 10,
            color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
            mb: 1,
        }}
    >
        {children}
    </Typography>
);
