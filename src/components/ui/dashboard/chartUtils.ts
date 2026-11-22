import { g, type } from "../../../theme/tokens";

/** Plot height token: 160 px on desktop, 140 on phone. */
export const CHART_H = { desktop: 160, phone: 140 } as const;

/** Axis text: caption in secondary (tertiary fails as the only label). */
export const chartAxisSx = { ...type("caption"), fill: g.text.secondary, color: g.text.secondary };

/** Dates on an axis follow the app language: "11/22" in en, "11/22" in ja, "22/11" in fr... */
export const formatAxisDate = (d: Date, locale: string): string =>
    new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric" }).format(d);
