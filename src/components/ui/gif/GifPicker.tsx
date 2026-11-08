import { useEffect, useRef, useState } from "react";
import { Box, Button, Typography } from "@mui/joy";
import { createPortal } from "react-dom";

import { useAuth } from "../../../context/AuthContext";
import { useTranslation } from "../../../i18n";
import { GifResult, searchGifs } from "../../../services/gifApi";
import { g } from "../../../theme/tokens";
import { SearchField } from "../fields/SearchField";
import { PlainButton } from "../PlainButton";

// GIF search popup (GIPHY via the api proxy). Positioning contract is
// copied from EmojiPicker so each editor wires both pickers the same
// way: inline mode = absolute z 10030; useFixedPosition = portal to
// document.body at z 99999 with caller-computed viewport coords.
type GifPickerProps = {
    showGifPicker: boolean;
    setShowGifPicker: (value: boolean) => void;
    // Fired with the selected GIF; the caller inserts a standard image
    // block (so every read surface renders/animates it for free).
    onSelect: (gif: { url: string; title: string }) => void;
    pickerBottomPosition?: number | string;
    pickerRightPosition?: number | string;
    pickerLeftPosition?: number | string;
    pickerTopPosition?: number | string;
    useFixedPosition?: boolean;
};

const SEARCH_DEBOUNCE_MS = 300;

export const GifPicker = ({
    showGifPicker,
    setShowGifPicker,
    onSelect,
    pickerBottomPosition = 210,
    pickerRightPosition = "auto",
    pickerLeftPosition = "auto",
    pickerTopPosition = "auto",
    useFixedPosition = false,
}: GifPickerProps) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const pickerRef = useRef<HTMLDivElement>(null);

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GifResult[]>([]);
    const [next, setNext] = useState("");
    const [loading, setLoading] = useState(false);
    const [notConfigured, setNotConfigured] = useState(false);

    // One debounced fetch pipeline for open/trending, typed queries,
    // and re-opens. The `cancelled` guard keeps a slow earlier
    // response from clobbering a newer query's grid.
    useEffect(() => {
        if (!showGifPicker || !accessToken) return;
        let cancelled = false;
        setLoading(true);
        const timer = setTimeout(
            () => {
                void searchGifs(accessToken, { q: query.trim() || undefined }).then((page) => {
                    if (cancelled) return;
                    setResults(page.results);
                    setNext(page.next);
                    setNotConfigured(!!page.notConfigured);
                    setLoading(false);
                });
            },
            query ? SEARCH_DEBOUNCE_MS : 0
        );
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [showGifPicker, accessToken, query]);

    const loadMore = () => {
        if (!accessToken || !next) return;
        const offset = next;
        setLoading(true);
        void searchGifs(accessToken, { q: query.trim() || undefined, offset }).then((page) => {
            setResults((prev) => [...prev, ...page.results]);
            setNext(page.next);
            setLoading(false);
        });
    };

    // Close on click-outside — same listener shape as EmojiPicker.
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setShowGifPicker(false);
            }
        };
        if (showGifPicker) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showGifPicker]);

    const pickerContent = showGifPicker && (
        <div
            ref={pickerRef}
            data-testid="gif-picker"
            style={{
                top: pickerTopPosition,
                bottom:
                    pickerBottomPosition !== undefined && pickerTopPosition === "auto"
                        ? pickerBottomPosition
                        : "auto",
                right: pickerRightPosition,
                left: pickerLeftPosition,
                position: useFixedPosition ? "fixed" : "absolute",
                zIndex: useFixedPosition ? 99999 : 10030,
                width: 340,
                maxHeight: 420,
                display: "flex",
                flexDirection: "column",
                background: g.surface.raised,
                border: `1px solid ${g.border.default}`,
                borderRadius: 8,
                boxShadow: g.shadow.md,
                overflow: "hidden",
            }}
        >
            <Box sx={{ p: 1 }}>
                <SearchField
                    loading={loading && query !== ""}
                    placeholder={t.common.editor.gifSearchPlaceholder}
                    size="md"
                    value={query}
                    autoFocus
                    onChange={setQuery}
                />
            </Box>

            <Box sx={{ flex: 1, overflowY: "auto", px: 1 }}>
                {notConfigured ? (
                    <Typography level="body-sm" sx={{ p: 2, textAlign: "center", opacity: 0.7 }}>
                        {t.common.editor.gifNotConfigured}
                    </Typography>
                ) : results.length === 0 && !loading ? (
                    <Typography level="body-sm" sx={{ p: 2, textAlign: "center", opacity: 0.7 }}>
                        {t.common.editor.gifNoResults}
                    </Typography>
                ) : (
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, 1fr)",
                            gap: 0.75,
                        }}
                    >
                        {results.map((gif) => (
                            <PlainButton
                                key={gif.id}
                                aria-label={gif.title || "GIF"}
                                data-testid={`gif-picker-item-${gif.id}`}
                                sx={{
                                    display: "block",
                                    borderRadius: "6px",
                                    "&:hover": { outline: `2px solid ${g.accent.solid}` },
                                }}
                                onClick={() => {
                                    onSelect({ url: gif.url, title: gif.title });
                                    setShowGifPicker(false);
                                }}
                            >
                                <Box
                                    alt=""
                                    component="img"
                                    loading="lazy"
                                    src={gif.previewUrl}
                                    sx={{ width: "100%", borderRadius: "6px", display: "block" }}
                                />
                            </PlainButton>
                        ))}
                    </Box>
                )}
                {next && !loading && !notConfigured && (
                    <Button size="sm" sx={{ my: 1 }} variant="plain" fullWidth onClick={loadMore}>
                        {t.common.editor.gifLoadMore}
                    </Button>
                )}
                {loading && (
                    <Typography level="body-xs" sx={{ p: 1, textAlign: "center", opacity: 0.6 }}>
                        {t.common.editor.gifLoading}
                    </Typography>
                )}
            </Box>

            {/* GIPHY attribution — required by the API terms. */}
            <Typography
                level="body-xs"
                sx={{ p: 0.75, textAlign: "center", opacity: 0.6, fontWeight: 600 }}
            >
                {t.common.editor.gifAttribution}
            </Typography>
        </div>
    );

    if (useFixedPosition && showGifPicker) {
        return <>{createPortal(pickerContent, document.body)}</>;
    }
    return <div className="relative">{pickerContent}</div>;
};
