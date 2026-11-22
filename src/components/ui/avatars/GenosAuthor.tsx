import genosLogo from "../../../assets/genos-logo.png";
import { useTranslation } from "../../../i18n";
import { ResolvedUserName } from "./AvatarContext";
import { AvatarSize, BaseAvatar } from "./BaseAvatar";
import { UserAvatar } from "./UserAvatar";

/**
 * The author of an automatic comment (MIP-2025): the PR-merge note, a status reason, a
 * review request, a merge-readiness nudge. genos-api writes these with no sender, as it does
 * every system-authored row. A real deleted account keeps its (anonymised) user row and id,
 * so a missing id is Genos, never "Deleted user".
 */
export const isGenosAuthor = (userId: string | number | null | undefined): boolean =>
    userId == null || userId === "";

/** The app mark as an avatar, with no profile link. */
export const GenosAuthorAvatar = ({ size }: { size?: AvatarSize | number }) => {
    const { t } = useTranslation();
    return (
        <BaseAvatar
            alt={t.admin.brand.logoAlt}
            data-testid="genos-author-avatar"
            size={size}
            src={genosLogo}
        />
    );
};

/** "Genos" for an automatic author, else the person's live-resolved name. */
export const AuthorName = ({
    userId,
    fallbackName,
}: {
    userId: string | number | null | undefined;
    fallbackName: string;
}) => {
    const { t } = useTranslation();
    if (isGenosAuthor(userId)) return <bdi className="g-bidi-island">{t.admin.brand.name}</bdi>;
    return <ResolvedUserName fallbackName={fallbackName} userId={userId} />;
};

/** The Genos mark for an automatic author, else the person's avatar. */
export const AuthorAvatar = ({
    userId,
    fallbackName,
    size,
    showPulseDot,
}: {
    userId: string | number | null | undefined;
    fallbackName?: string | null;
    size?: AvatarSize | number;
    showPulseDot?: boolean;
}) =>
    isGenosAuthor(userId) ? (
        <GenosAuthorAvatar size={size} />
    ) : (
        <UserAvatar
            fallbackName={fallbackName}
            showPulseDot={showPulseDot}
            size={size}
            userId={userId}
        />
    );
