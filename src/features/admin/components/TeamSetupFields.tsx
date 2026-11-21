import { Checkbox, FormControl, FormHelperText, FormLabel, Textarea, Typography } from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";

import type { TeamSetupFieldsState } from "../../../hooks/common/useTeamSetupFields";
import { useTranslation } from "../../../i18n";
import { MAX_DEPARTMENT_NAME_LENGTH, MAX_DEPARTMENTS } from "../utils/departments";

type Props = {
    fields: TeamSetupFieldsState;
    /** The server's refusal of the list (MIP-1841), shown in place of the hint until it is edited. */
    departmentsError?: string | null;
    /** The first-run page paints these itself; the modal takes Joy's defaults. */
    labelSx?: SxProps;
    textareaSx?: SxProps;
    hintColor?: string;
    checkboxColor?: string;
};

/**
 * "Departments (optional)" and "Include sample instruction data", the two choices a new team is
 * created with. Shared by the first-run page and the in-app Create New Team modal (MIP-1709), so
 * the wording (already in all seven languages), the limits and the refusal reasons are the same.
 */
export const TeamSetupFields = ({
    fields,
    departmentsError,
    labelSx,
    textareaSx,
    hintColor,
    checkboxColor,
}: Props) => {
    const { t } = useTranslation();
    const { problem } = fields;

    return (
        <>
            <FormControl error={problem !== null || !!departmentsError} sx={{ mt: 1.5 }}>
                <FormLabel sx={labelSx}>{t.admin.joinTeam.departmentsLabel}</FormLabel>
                <Textarea
                    maxRows={6}
                    minRows={2}
                    name="departments"
                    placeholder={t.admin.joinTeam.departmentsPlaceholder}
                    sx={textareaSx}
                    value={fields.departmentsText}
                    onChange={(event) => fields.setDepartmentsText(event.target.value)}
                />
                <FormHelperText
                    sx={{ color: problem || departmentsError ? undefined : hintColor, mt: 0.5 }}
                >
                    {departmentsError ??
                        (problem === "tooMany"
                            ? t.admin.joinTeam.departmentsTooMany.replace(
                                  "{max}",
                                  String(MAX_DEPARTMENTS)
                              )
                            : problem === "tooLong"
                              ? t.admin.joinTeam.departmentsTooLong.replace(
                                    "{max}",
                                    String(MAX_DEPARTMENT_NAME_LENGTH)
                                )
                              : t.admin.joinTeam.departmentsHint)}
                </FormHelperText>
            </FormControl>
            <Checkbox
                checked={fields.withStarter}
                label={t.admin.joinTeam.starterOptIn}
                size="sm"
                sx={{ mt: 1.5, color: checkboxColor }}
                onChange={(e) => fields.setWithStarter(e.target.checked)}
            />
            <Typography level="body-xs" sx={{ color: hintColor, mt: 0.5, ml: 3.5 }}>
                {t.admin.joinTeam.starterOptInHint}
            </Typography>
        </>
    );
};
