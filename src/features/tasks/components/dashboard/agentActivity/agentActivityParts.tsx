import { Box, Chip } from "@mui/joy";

import { g, type } from "../../../../../theme/tokens";
import { AgentKind, AgentWorkAgent } from "../../../services/loadAgentWork";

/** Chip colours by agent kind, all from the role tokens (no literals, no isDark branch). */
const AGENT_TONE: Record<AgentKind, { bg: string; fg: string; border: string }> = {
    claude: { bg: g.accent.subtle, fg: g.accent.text, border: g.accent.border },
    chatgpt: { bg: g.info.subtle, fg: g.info.text, border: g.info.border },
    api_key: { bg: g.bg.subtle, fg: g.text.secondary, border: g.border.default },
    other_app: { bg: g.warning.subtle, fg: g.warning.text, border: g.warning.border },
    person: { bg: g.success.subtle, fg: g.success.text, border: g.success.border },
};

/** A small chip naming who made a change. "by people in the app" is the unmarked in-app write. */
export const AgentChip = ({
    agent,
    label,
}: {
    agent: AgentWorkAgent | { kind: AgentKind };
    label: string;
}) => {
    const tone = AGENT_TONE[agent.kind] ?? AGENT_TONE.person;
    return (
        <Chip
            data-agent-kind={agent.kind}
            size="sm"
            variant="soft"
            sx={{
                flex: "0 0 auto",
                bgcolor: tone.bg,
                color: tone.fg,
                border: `1px solid ${tone.border}`,
                borderRadius: g.radius.full,
                whiteSpace: "nowrap",
                ...type("caption"),
                fontWeight: 500,
            }}
        >
            {label}
        </Chip>
    );
};

/** A plain, fenced line of text: monospace, no markup, wraps long words. */
export const FencedText = ({ children }: { children: string }) => (
    <Box
        component="pre"
        sx={{
            m: 0,
            mt: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: g.radius.sm,
            bgcolor: g.bg.subtle,
            border: `1px solid ${g.border.subtle}`,
            color: g.text.secondary,
            fontFamily: g.font.mono,
            ...type("caption"),
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
        }}
    >
        {children}
    </Box>
);
