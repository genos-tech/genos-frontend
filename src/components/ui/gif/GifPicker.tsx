import { useEffect, useRef, useState } from "react";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Box, Button, Input, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { createPortal } from "react-dom";

import { useAuth } from "../../../context/AuthContext";
import { GifResult, searchGifs } from "../../../services/gifApi";

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
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { accessToken } = useAuth();
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
                background: isDark ? "#1c1c1f" : "#fff",
                borderRadius: 8,
                boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.2)",
                overflow: "hidden",
            }}
        >
            <Box sx={{ p: 1 }}>
                <Input
                    autoFocus
                    placeholder="Search GIFs…"
                    size="sm"
                    startDecorator={<SearchRoundedIcon />}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </Box>

            <Box sx={{ flex: 1, overflowY: "auto", px: 1 }}>
                {notConfigured ? (
                    <Typography level="body-sm" sx={{ p: 2, textAlign: "center", opacity: 0.7 }}>
                        GIF search isn't configured on this server (missing GIPHY key).
                    </Typography>
                ) : results.length === 0 && !loading ? (
                    <Typography level="body-sm" sx={{ p: 2, textAlign: "center", opacity: 0.7 }}>
                        No GIFs found.
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
                            <Box
                                key={gif.id}
                                component="img"
                                alt={gif.title}
                                data-testid={`gif-picker-item-${gif.id}`}
                                loading="lazy"
                                src={gif.previewUrl}
                                sx={{
                                    width: "100%",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    display: "block",
                                    "&:hover": { outline: "2px solid #6366f1" },
                                }}
                                onClick={() => {
                                    onSelect({ url: gif.url, title: gif.title });
                                    setShowGifPicker(false);
                                }}
                            />
                        ))}
                    </Box>
                )}
                {next && !loading && !notConfigured && (
                    <Button fullWidth size="sm" sx={{ my: 1 }} variant="plain" onClick={loadMore}>
                        Load more
                    </Button>
                )}
                {loading && (
                    <Typography level="body-xs" sx={{ p: 1, textAlign: "center", opacity: 0.6 }}>
                        Loading…
                    </Typography>
                )}
            </Box>

            {/* GIPHY attribution — required by the API terms. */}
            <Typography
                level="body-xs"
                sx={{ p: 0.75, textAlign: "center", opacity: 0.6, fontWeight: 600 }}
            >
                Powered by GIPHY
            </Typography>
        </div>
    );

    if (useFixedPosition && showGifPicker) {
        return <>{createPortal(pickerContent, document.body)}</>;
    }
    return <div className="relative">{pickerContent}</div>;
};
