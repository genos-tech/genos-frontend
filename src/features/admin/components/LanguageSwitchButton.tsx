import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import { Dropdown, IconButton, Menu, MenuButton, MenuItem } from "@mui/joy";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { useTranslation, type Locale } from "../../../i18n";

const LANGUAGE_OPTIONS: ReadonlyArray<{
    locale: Exclude<Locale, "ar">;
    labelKey: "english" | "japanese" | "spanish" | "french" | "chinese" | "hindi";
}> = [
    { locale: "en", labelKey: "english" },
    { locale: "ja", labelKey: "japanese" },
    { locale: "es", labelKey: "spanish" },
    { locale: "fr", labelKey: "french" },
    { locale: "zh", labelKey: "chinese" },
    { locale: "hi", labelKey: "hindi" },
];

type LanguageSwitchButtonProps = {
    color?: string;
};

export const LanguageSwitchButton = ({ color }: LanguageSwitchButtonProps) => {
    const { t, locale, setLocale } = useTranslation();

    return (
        <Dropdown>
            <AppTooltip title={t.settings.language.heading}>
                <MenuButton
                    aria-label={t.settings.language.heading}
                    slots={{ root: IconButton }}
                    slotProps={{
                        root: {
                            size: "sm",
                            variant: "plain",
                            sx: {
                                borderRadius: "50%",
                                color,
                                "--IconButton-size": "36px",
                            },
                        },
                    }}
                >
                    <LanguageRoundedIcon />
                </MenuButton>
            </AppTooltip>
            <Menu placement="bottom-end" size="sm">
                {LANGUAGE_OPTIONS.map((option) => (
                    <MenuItem
                        key={option.locale}
                        selected={locale === option.locale}
                        onClick={() => setLocale(option.locale)}
                    >
                        {t.settings.language[option.labelKey]}
                    </MenuItem>
                ))}
            </Menu>
        </Dropdown>
    );
};
