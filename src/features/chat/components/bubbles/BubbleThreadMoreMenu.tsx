import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import CodeIcon from "@mui/icons-material/Code";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import WrapTextIcon from "@mui/icons-material/WrapText";
import { Box, IconButton, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { createPortal } from "react-dom";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { UserProps } from "../../../../types/admin";
import { FlaggedMessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { ModalDeleteMessage } from "../modals/ModalDeleteMessage";

type BubbleThreadMoreMenuProps = {
    accessToken: string | null;
    currentMessageIndex: number;
    flaggedMessages: FlaggedMessageProps[];
    message: ThreadMessageProps;
    myself: UserProps;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    setEditTargetMessage: (value: ThreadMessageProps) => void;
    setFlaggedMessages: Dispatch<SetStateAction<FlaggedMessageProps[]>>;
    setIsInEdit: (value: boolean) => void;
    setTargetMessageIndex: (value: number) => void;
    socket: Socket | null;
    thread: ThreadProps;
    useCM: ChatManagementState;
    isSent: boolean;
    // Per-bubble wrap toggles owned by the parent thread-bubble.
    unwrapAll: boolean;
    setUnwrapAll: (value: boolean) => void;
    unwrapCode: boolean;
    setUnwrapCode: (value: boolean) => void;
};

type MenuItemConfig = {
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    color: { light: string; dark: string };
    hoverBg: { light: string; dark: string };
    visible: boolean;
    danger?: boolean;
    active?: boolean;
};

export const BubbleThreadMoreMenu = (props: BubbleThreadMoreMenuProps) => {
    const {
        accessToken,
        currentMessageIndex,
        flaggedMessages,
        message,
        myself,
        setCurrentThreadChat,
        setEditTargetMessage,
        setFlaggedMessages,
        setIsInEdit,
        setTargetMessageIndex,
        socket,
        thread,
        useCM,
        isSent,
        unwrapAll,
        setUnwrapAll,
        unwrapCode,
        setUnwrapCode,
    } = props;

    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [openDeleteMessage, setOpenDeleteMessage] = useState(false);
    const [isFlagged, setIsFlagged] = useState(message.isFlagged || false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsFlagged(message.isFlagged || false);
    }, [message]);

    // Calculate menu position when opening
    const updateMenuPosition = useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const menuWidth = 200;
            const menuHeight = 180;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let top = rect.bottom + 6;
            let left = isSent ? rect.right - menuWidth : rect.left;

            if (left < 8) {
                left = 8;
            } else if (left + menuWidth > viewportWidth - 8) {
                left = viewportWidth - menuWidth - 8;
            }

            if (top + menuHeight > viewportHeight - 8) {
                top = rect.top - menuHeight - 6;
            }

            setMenuPosition({ top, left });
        }
    }, [isSent]);

    const openMenu = () => {
        updateMenuPosition();
        setIsOpen(true);
        setFocusedIndex(0);
    };

    const closeMenu = () => {
        setIsOpen(false);
        setFocusedIndex(-1);
    };

    // Update position on scroll/resize
    useEffect(() => {
        if (isOpen) {
            const handleUpdate = () => {
                updateMenuPosition();
            };
            window.addEventListener("scroll", handleUpdate, true);
            window.addEventListener("resize", handleUpdate);
            return () => {
                window.removeEventListener("scroll", handleUpdate, true);
                window.removeEventListener("resize", handleUpdate);
            };
        }
    }, [isOpen, updateMenuPosition]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                menuRef.current &&
                !menuRef.current.contains(target) &&
                buttonRef.current &&
                !buttonRef.current.contains(target)
            ) {
                closeMenu();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isOpen) return;

            const items = menuItems.filter((item) => item.visible);

            switch (event.key) {
                case "Escape":
                    closeMenu();
                    buttonRef.current?.focus();
                    break;
                case "ArrowDown":
                    event.preventDefault();
                    setFocusedIndex((prev) => (prev + 1) % items.length);
                    break;
                case "ArrowUp":
                    event.preventDefault();
                    setFocusedIndex((prev) => (prev - 1 + items.length) % items.length);
                    break;
                case "Enter":
                case " ":
                    event.preventDefault();
                    if (focusedIndex >= 0 && focusedIndex < items.length) {
                        items[focusedIndex].onClick();
                    }
                    break;
                case "Tab":
                    closeMenu();
                    break;
            }
        };

        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, focusedIndex]);

    const handleFlagClick = () => {
        // v3 owns the flag state end-to-end. Same pattern as
        // BubbleMoreMenu — thread message UUID lives on
        // `messageIdWithChatIdAndThreadId` (set by
        // `v3ThreadMessageToLegacy`). channelService notify drives the
        // v3 subscriptions in useChatManagement which re-derive the
        // thread chat's `isFlagged` bubble flags and the sidebar
        // `flaggedMessages` list automatically.
        const v3MessageId = message.messageIdWithChatIdAndThreadId;
        if (!v3MessageId) {
            closeMenu();
            return;
        }
        if (!isFlagged) {
            void channelService
                .flagMessage(v3MessageId)
                .catch((e) => console.error("[BubbleThreadMoreMenu] flag failed:", e));
        } else {
            void channelService
                .unflagMessage(v3MessageId)
                .catch((e) => console.error("[BubbleThreadMoreMenu] unflag failed:", e));
        }
        setIsFlagged(!isFlagged);
        closeMenu();
    };

    const handleEditClick = () => {
        setIsInEdit(true);
        setEditTargetMessage(message);
        setTargetMessageIndex(currentMessageIndex);
        closeMenu();
    };

    const handleDeleteClick = () => {
        setOpenDeleteMessage(true);
        closeMenu();
    };

    // Chat type to URL path mapping
    const CHAT_TYPE_PATH: Record<number, string> = {
        1: "dm",
        2: "gm",
        3: "pm",
        4: "mdm",
    };

    const handleCopyLinkClick = async () => {
        const typePath = CHAT_TYPE_PATH[thread.chatType];
        if (typePath) {
            const threadId =
                thread.chatType === 3 && thread.taskId ? thread.taskId : thread.threadId;
            const messageUrl = `${window.location.origin}/workspace/chat/${typePath}/${thread.chatId}/thread/${threadId}/message/${message.messageId}`;
            try {
                await navigator.clipboard.writeText(messageUrl);
            } catch (err) {
                console.error("Failed to copy link:", err);
            }
        }
        closeMenu();
    };

    // Check conditions for showing each menu item
    const isOwnMessage = message.sender.userId === myself.userId;
    const canDelete = message.messageId !== 1 && isOwnMessage;

    // Per-action hues below are a functional category color scheme — users
    // recognise actions by colour at a glance (copy=emerald, flag=red/amber,
    // edit=cyan). The `delete` action is the only generic destructive
    // affordance and uses palette.dangerTint instead of red. The `flag` red
    // is also a cross-file functional carve-out (see chatListItemForFlagMessages).
    const menuItems: MenuItemConfig[] = [
        {
            id: "copyLink",
            label: t.chat.messageActions.copyMessageLink,
            icon: <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleCopyLinkClick,
            color: { light: "#059669", dark: "#34d399" },
            colorRgb: { light: "5, 150, 105", dark: "52, 211, 153" },
            hoverBg: { light: "rgba(5,150,105,0.12)", dark: "rgba(52,211,153,0.18)" },
            visible: true,
        },
        {
            id: "unwrapAll",
            label: unwrapAll ? t.chat.messageActions.wrapAll : t.chat.messageActions.unwrapAll,
            icon: <WrapTextIcon sx={{ fontSize: 18 }} />,
            onClick: () => {
                setUnwrapAll(!unwrapAll);
                closeMenu();
            },
            color: { light: "#6366f1", dark: "#a5b4fc" },
            colorRgb: { light: "99, 102, 241", dark: "165, 180, 252" },
            hoverBg: { light: "rgba(99,102,241,0.10)", dark: "rgba(99,102,241,0.20)" },
            visible: true,
            active: unwrapAll,
        },
        {
            id: "unwrapCode",
            label: unwrapCode ? t.chat.messageActions.wrapCode : t.chat.messageActions.unwrapCode,
            icon: <CodeIcon sx={{ fontSize: 18 }} />,
            onClick: () => {
                setUnwrapCode(!unwrapCode);
                closeMenu();
            },
            color: { light: "#6366f1", dark: "#a5b4fc" },
            colorRgb: { light: "99, 102, 241", dark: "165, 180, 252" },
            hoverBg: { light: "rgba(99,102,241,0.10)", dark: "rgba(99,102,241,0.20)" },
            visible: true,
            active: unwrapCode,
        },
        {
            id: "flag",
            label: isFlagged
                ? t.chat.messageActions.removeFlag
                : t.chat.messageActions.flagForLater,
            icon: <FlagRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleFlagClick,
            color: isFlagged
                ? { light: "#ef4444", dark: "#f87171" }
                : { light: "#f59e0b", dark: "#fbbf24" },
            colorRgb: isFlagged
                ? { light: "239, 68, 68", dark: "248, 113, 113" }
                : { light: "245, 158, 11", dark: "251, 191, 36" },
            hoverBg: isFlagged
                ? { light: "rgba(239,68,68,0.12)", dark: "rgba(248,113,113,0.18)" }
                : { light: "rgba(245,158,11,0.12)", dark: "rgba(251,191,36,0.18)" },
            visible: true,
            active: isFlagged,
        },
        {
            id: "edit",
            label: t.chat.messageActions.editMessage,
            icon: <EditRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleEditClick,
            color: { light: "#0891b2", dark: "#22d3ee" },
            colorRgb: { light: "8, 145, 178", dark: "34, 211, 238" },
            hoverBg: { light: "rgba(8,145,178,0.12)", dark: "rgba(34,211,238,0.18)" },
            visible: isOwnMessage,
        },
        {
            id: "delete",
            label: t.chat.messageActions.deleteMessage,
            icon: <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleDeleteClick,
            color: { light: "var(--gp-tint-danger-alt)", dark: "var(--gp-tint-danger)" },
            colorRgb: {
                light: "var(--gp-tint-danger-alt-rgb)",
                dark: "var(--gp-tint-danger-rgb)",
            },
            hoverBg: {
                light: "rgba(var(--gp-tint-danger-alt-rgb), 0.12)",
                dark: "rgba(var(--gp-tint-danger-rgb), 0.18)",
            },
            visible: canDelete,
            danger: true,
        },
    ];

    const visibleItems = menuItems.filter((item) => item.visible);

    // Dropdown menu rendered via portal
    const dropdownMenu = isOpen
        ? createPortal(
              <Box
                  ref={menuRef}
                  aria-orientation="vertical"
                  role="menu"
                  sx={{
                      position: "fixed",
                      top: menuPosition.top,
                      left: menuPosition.left,
                      zIndex: 9999,
                      minWidth: 200,
                      py: 0.75,
                      borderRadius: "14px",
                      background: isDark
                          ? "linear-gradient(145deg, rgba(32,32,42,0.98) 0%, rgba(24,24,34,0.98) 100%)"
                          : "linear-gradient(145deg, rgba(255,255,255,0.99) 0%, rgba(250,251,253,0.99) 100%)",
                      backdropFilter: "blur(24px) saturate(180%)",
                      border: "1px solid",
                      borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                      boxShadow: isDark
                          ? "0 12px 48px rgba(0,0,0,0.65), 0 4px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)"
                          : "0 12px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)",
                      animation: "menuSlideIn 0.18s cubic-bezier(0.32, 0.72, 0, 1) forwards",
                      transformOrigin: "top center",
                      "@keyframes menuSlideIn": {
                          from: {
                              opacity: 0,
                              transform: "scale(0.95) translateY(-6px)",
                          },
                          to: {
                              opacity: 1,
                              transform: "scale(1) translateY(0)",
                          },
                      },
                  }}
                  onClick={(e) => e.stopPropagation()}
              >
                  {visibleItems.map((item, index) => {
                      const isFocused = focusedIndex === index;
                      return (
                          <Box key={item.id}>
                              {item.danger && index > 0 && (
                                  <Box
                                      sx={{
                                          height: "1px",
                                          mx: 1.5,
                                          my: 0.5,
                                          background: isDark
                                              ? "rgba(255,255,255,0.08)"
                                              : "rgba(0,0,0,0.06)",
                                      }}
                                  />
                              )}
                              <Box
                                  role="menuitem"
                                  tabIndex={isFocused ? 0 : -1}
                                  sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1.5,
                                      px: 1.5,
                                      py: 1,
                                      mx: 0.75,
                                      my: 0.25,
                                      borderRadius: "10px",
                                      minHeight: 40,
                                      cursor: "pointer",
                                      outline: "none",
                                      transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                                      color:
                                          item.active || isFocused
                                              ? isDark
                                                  ? item.color.dark
                                                  : item.color.light
                                              : isDark
                                                ? "rgba(255,255,255,0.9)"
                                                : "rgba(15,23,42,0.85)",
                                      background:
                                          item.active || isFocused
                                              ? isDark
                                                  ? item.hoverBg.dark
                                                  : item.hoverBg.light
                                              : "transparent",
                                      transform: isFocused ? "translateX(3px)" : "none",
                                      "&:hover": {
                                          background: isDark
                                              ? item.hoverBg.dark
                                              : item.hoverBg.light,
                                          color: isDark ? item.color.dark : item.color.light,
                                          transform: "translateX(3px)",
                                      },
                                      "&:active": {
                                          transform: "translateX(3px) scale(0.98)",
                                      },
                                  }}
                                  onClick={item.onClick}
                                  onMouseEnter={() => setFocusedIndex(index)}
                              >
                                  <Box
                                      sx={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          width: 30,
                                          height: 30,
                                          borderRadius: "8px",
                                          background:
                                              item.active || isFocused
                                                  ? isDark
                                                      ? `rgba(${item.colorRgb.dark}, 0.08)`
                                                      : `rgba(${item.colorRgb.light}, 0.07)`
                                                  : "transparent",
                                          transition: "all 0.15s ease",
                                          flexShrink: 0,
                                      }}
                                  >
                                      {item.icon}
                                  </Box>
                                  <Typography
                                      level="body-sm"
                                      sx={{
                                          fontWeight: 500,
                                          fontSize: "0.875rem",
                                          letterSpacing: "-0.01em",
                                          color: "inherit",
                                          flex: 1,
                                          userSelect: "none",
                                      }}
                                  >
                                      {item.label}
                                  </Typography>
                                  {item.active && (
                                      <Box
                                          sx={{
                                              width: 7,
                                              height: 7,
                                              borderRadius: "50%",
                                              background: isDark
                                                  ? item.color.dark
                                                  : item.color.light,
                                              boxShadow: `0 0 10px rgba(${isDark ? item.colorRgb.dark : item.colorRgb.light}, 0.31)`,
                                              flexShrink: 0,
                                          }}
                                      />
                                  )}
                              </Box>
                          </Box>
                      );
                  })}
              </Box>,
              document.body
          )
        : null;

    return (
        <Box sx={{ position: "relative" }}>
            {/* Trigger Button */}
            <IconButton
                ref={buttonRef}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                size="sm"
                sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "8px",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    color: isOpen
                        ? isDark
                            ? "var(--gp-brandalt-300)"
                            : "var(--gp-brand-700)"
                        : isDark
                          ? "rgba(255,255,255,0.55)"
                          : "rgba(0,0,0,0.45)",
                    background: isOpen
                        ? isDark
                            ? "rgba(var(--gp-brand-700-rgb), 0.22)"
                            : "rgba(var(--gp-brand-700-rgb), 0.12)"
                        : "transparent",
                    "&:hover": {
                        background: isDark
                            ? "rgba(var(--gp-brand-700-rgb), 0.28)"
                            : "rgba(var(--gp-brand-700-rgb), 0.15)",
                        color: isDark ? "var(--gp-brandalt-300)" : "var(--gp-brand-700)",
                        transform: "scale(1.08)",
                    },
                    "&:focus-visible": {
                        background: isDark
                            ? "rgba(var(--gp-brand-700-rgb), 0.28)"
                            : "rgba(var(--gp-brand-700-rgb), 0.15)",
                        color: isDark ? "var(--gp-brandalt-300)" : "var(--gp-brand-700)",
                        outline: "2px solid",
                        outlineColor: isDark ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)",
                        outlineOffset: "2px",
                    },
                    "&:active": {
                        transform: "scale(0.95)",
                    },
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (isOpen) {
                        closeMenu();
                    } else {
                        openMenu();
                    }
                }}
            >
                <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>

            {/* Portal-rendered dropdown menu */}
            {dropdownMenu}

            {/* Delete Confirmation Modal */}
            <ModalDeleteMessage
                accessToken={accessToken}
                currentThreadChat={thread}
                flaggedMessages={flaggedMessages}
                isThread={true}
                message={message}
                openDeleteMessage={openDeleteMessage}
                setCurrentThreadChat={useCM.setCurrentThreadChat}
                setFlaggedMessages={setFlaggedMessages}
                setOpenDeleteMessage={setOpenDeleteMessage}
                socket={socket}
            />
        </Box>
    );
};
