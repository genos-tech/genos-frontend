import { StatStrip, StatTile, useNumberFormat } from "../../../../../components/ui/dashboard";
import { useTranslation } from "../../../../../i18n";
import { AGENT_KINDS, AgentWorkTotals } from "../../../services/loadAgentWork";
import { AgentChip } from "./agentActivityParts";

/** Totals by agent and the decisions recorded in the window: one tile each, in the shared strip. */
export const AgentSummaryRow = ({ totals }: { totals: AgentWorkTotals }) => {
    const { t } = useTranslation();
    const nf = useNumberFormat();
    const a = t.tasks.dashboard.agentActivity;
    return (
        <StatStrip>
            {AGENT_KINDS.map((kind) => (
                <StatTile
                    key={kind}
                    label={<AgentChip agent={{ kind }} label={a.agents[kind]} />}
                    raw={totals.by_agent[kind] ?? 0}
                    value={nf.number(totals.by_agent[kind] ?? 0)}
                    valueTestId={`agent-total-${kind}`}
                />
            ))}
            <StatTile
                label={a.summary.decisions}
                raw={totals.decisions ?? 0}
                value={nf.number(totals.decisions ?? 0)}
                valueTestId="agent-total-decisions"
            />
        </StatStrip>
    );
};
