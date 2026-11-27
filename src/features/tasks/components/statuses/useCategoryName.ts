import { useTranslation } from "../../../../i18n";
import { taskMetaLabel } from "../../utils/taskMeta";

/** The category's name, as the built-in statuses are translated. */
export const useCategoryName = (): ((category: string) => string) => {
    const { t } = useTranslation();
    return (category) => taskMetaLabel(category, t.tasks.filters) || category;
};
