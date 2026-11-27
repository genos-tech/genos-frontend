import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { Box } from "@mui/joy";

import { useProjectStatuses } from "../../../../hooks/tasks/useProjectStatuses";
import { useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";
import { STATUS_DELETED, STATUS_NAMES } from "../../meta/taskStatuses";
import { pickableStatuses, resolveStatusRow, statusRowName } from "../../utils/projectStatus";
import { StatusLabel } from "../meta/StatusLabel";
import { ChipSelect, ChipSelectOption, statusSelectNode } from "../table/cellEditors";
import { CategoryHeading } from "./statusChoices";

/**
 * The table's in-cell status editor. A project that never set up statuses gets the six
 * system values, as before; one that did gets its own, grouped by category (MIP-2493).
 */
export const TableStatusSelect = ({
    projectId,
    status,
    customStatusId,
    onPick,
    onClose,
}: {
    projectId: number | null;
    status: string;
    customStatusId?: number | null;
    /** `statusId` is set when one of the project's statuses was picked. */
    onPick: (category: string, statusId?: number) => void;
    onClose: () => void;
}) => {
    const { t } = useTranslation();
    const { statuses } = useProjectStatuses(projectId, customStatusId);
    const current = resolveStatusRow(statuses, status, customStatusId);

    const options: ChipSelectOption[] = statuses.length
        ? [
              ...pickableStatuses(statuses, current?.statusId).map((row, i, all) => ({
                  value: `st:${row.statusId}`,
                  label: statusRowName(row, t.tasks),
                  header:
                      all[i - 1]?.category !== row.category ? (
                          <CategoryHeading category={row.category} />
                      ) : undefined,
                  node: (
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                          <StatusLabel row={row} status={row.category} />
                          {row.statusId === current?.statusId && (
                              <CheckRoundedIcon aria-hidden="true" sx={{ fontSize: 16 }} />
                          )}
                          {row.isArchived && (
                              <Box
                                  component="span"
                                  sx={{ ...type("caption"), color: g.text.tertiary }}
                              >
                                  {t.tasks.projectStatuses.off}
                              </Box>
                          )}
                      </Box>
                  ),
              })),
              {
                  value: STATUS_DELETED,
                  node: statusSelectNode(STATUS_DELETED),
                  header: (
                      <Box sx={{ borderTop: `1px solid ${g.border.subtle}`, width: "100%" }} />
                  ),
              },
          ]
        : STATUS_NAMES.map((name) => ({ value: name, node: statusSelectNode(name) }));

    // The task reads as a row where there is one; a status with none (Deleted, or a category
    // whose statuses are all off) falls back to the system value.
    const value = statuses.length && current ? `st:${current.statusId}` : status;

    return (
        <ChipSelect
            fullWidth={false}
            minWidth={110}
            options={options}
            value={value}
            autoFocus
            open
            onClose={onClose}
            onChange={(next) => {
                if (next.startsWith("st:")) {
                    const row = statuses.find((r) => `st:${r.statusId}` === next);
                    if (row) onPick(row.category, row.statusId);
                } else onPick(next);
                onClose();
            }}
        />
    );
};
