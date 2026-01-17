import { useCallback, useEffect, useRef, useState } from "react";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ReplyRoundedIcon from "@mui/icons-material/ReplyRounded";
import { Box, IconButton, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { createPortal } from "react-dom";
import { Socket } from "socket.io-client";

import { FlaggedService } from "../../../../db/services/flagged.service";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ChatProps, FlaggedMessageProps, MessageProps } from "../../../../types/chat";
import { addFlaggedMessage } from "../../services/addFlaggedMessage";
import { addMessage } from "../../services/addMessage";
import { updateFlagMessage } from "../../services/updateFlagMessage";
import { getFirstLine } from "../../utils/common";
import { ModalDeleteMessage } from "../modals/ModalDeleteMessage";

type BubbleMoreMenuProps = {
    accessToken: string | null;
    chat: ChatProps;
    flaggedMessages: FlaggedMessageProps[];
    message: MessageProps;
    myself: UserProps;
    replyHandler: (e?: React.MouseEvent) => void;
    setCurrentChat: (chat: ChatProps) => void;
    setEditTargetMessage: (value: MessageProps) => void;
    setFlaggedMessages: (messages: FlaggedMessageProps[]) => void;
    setIsInEdit: (value: boolean) => void;
    socket: Socket | null;
    useCM: ChatManagementState;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    isSent: boolean;
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

export const BubbleMoreMenu = (props: BubbleMoreMenuProps) => {
    const {
        accessToken,
        chat,
        flaggedMessages,
        message,
        myself,
        replyHandler,
        setCurrentChat,
        setEditTargetMessage,
        setFlaggedMessages,
        setIsInEdit,
        socket,
        useCM,
        usePM,
        useTM,
        isSent,
    } = props;

    const { mode } = useColorScheme();
    const isDark = mode === "dark";
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
            const menuHeight = 200; // approximate
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let top = rect.bottom + 6;
            let left = isSent ? rect.right - menuWidth : rect.left;

            // Adjust if menu would go off screen horizontally
            if (left < 8) {
                left = 8;
            } else if (left + menuWidth > viewportWidth - 8) {
                left = viewportWidth - menuWidth - 8;
            }

            // Adjust if menu would go off screen vertically - show above button instead
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
        setCurrentChat({
            ...chat,
            messages: chat.messages.map((m) => ({
                ...m,
                isFlagged: m.messageId === message.messageId ? !m.isFlagged : m.isFlagged,
            })),
        });
        addMessage({ ...message, isFlagged: !isFlagged } as MessageProps, chat.chatType);

        if (!isFlagged) {
            addFlaggedMessage({
                flaggedMessageId: `${chat.chatType}-${chat.chatId}-${0}-${message.messageId}`,
                chatType: chat.chatType,
                chatId: chat.chatId,
                threadId: 0,
                messageId: message.messageId,
                contentText: getFirstLine(message.content[0]),
                sender: message.sender,
                dmPartnerUser: chat.dmPartnerUser,
                project: chat.project,
                taskId: 0,
                tsSent: message.tsSent,
            } as FlaggedMessageProps);

            setFlaggedMessages([
                ...flaggedMessages,
                {
                    flaggedMessageId: `${chat.chatType}-${chat.chatId}-${0}-${message.messageId}`,
                    chatType: chat.chatType,
                    chatName: chat.chatName,
                    chatId: chat.chatId,
                    threadId: 0,
                    messageId: message.messageId,
                    contentText: getFirstLine(message.content[0]),
                    sender: message.sender,
                    dmPartnerUser: chat.dmPartnerUser,
                    project: chat.project,
                    taskId: 0,
                    tsSent: message.tsSent,
                },
            ]);
        } else {
            const flaggedService = new FlaggedService();
            flaggedService.deleteFlaggedMessage(
                `${chat.chatType}-${chat.chatId}-${0}-${message.messageId}`
            );

            setFlaggedMessages(
                flaggedMessages.filter(
                    (_message) =>
                        _message.flaggedMessageId !==
                        `${chat.chatType}-${chat.chatId}-${0}-${message.messageId}`
                )
            );
        }

        updateFlagMessage(accessToken, myself, {
            chat_type: chat.chatType,
            chat_id: chat.chatId,
            thread_id: 0,
            message_id: message.messageId,
        });

        setIsFlagged(!isFlagged);
        closeMenu();
    };

    const handleReplyClick = () => {
        // Note: When called from menu items, there's no event to propagate
        // The stopPropagation is handled by replyHandler if event is provided
        replyHandler();
        closeMenu();
    };

    const handleEditClick = () => {
        setIsInEdit(true);
        setEditTargetMessage(message);
        closeMenu();
    };

    const handleOpenTaskClick = () => {
        if (message.taskId !== null) {
            useCM.setIsMainChatVisible(true);
            useCM.setIsThreadVisible(false);
            useTM.setIsTaskPreviewVisible(true);
            useTM.setIsCreatingTask({ ...useTM.isCreatingTask, flag: false });
            useTM.setCurrentPreviewTaskId(message.taskId);

            if (message.project && message.project.projectId) {
                usePM.setCurrentProject(message.project);
            }
        }
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
        4: "pm",
    };

    const handleCopyLinkClick = async () => {
        const typePath = CHAT_TYPE_PATH[chat.chatType];
        if (typePath) {
            const messageUrl = `${window.location.origin}/home/chat/${typePath}/${chat.chatId}/message/${message.messageId}`;
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
    const isSystemMessage = message.sender.isSystemUser === true;
    const isProjectChat = chat.chatType === 3 || chat.chatType === 4;
    const canDelete = message.numReplies < 2 && isOwnMessage;

    const menuItems: MenuItemConfig[] = [
        {
            id: "reply",
            label: "Reply in thread",
            icon: <ReplyRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleReplyClick,
            color: { light: "#4f46e5", dark: "#818cf8" },
            hoverBg: { light: "rgba(79,70,229,0.12)", dark: "rgba(129,140,248,0.18)" },
            visible: true,
        },
        {
            id: "copyLink",
            label: "Copy message link",
            icon: <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleCopyLinkClick,
            color: { light: "#059669", dark: "#34d399" },
            hoverBg: { light: "rgba(5,150,105,0.12)", dark: "rgba(52,211,153,0.18)" },
            visible: true,
        },
        {
            id: "flag",
            label: isFlagged ? "Remove flag" : "Flag for later",
            icon: <FlagRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleFlagClick,
            color: isFlagged
                ? { light: "#ef4444", dark: "#f87171" }
                : { light: "#f59e0b", dark: "#fbbf24" },
            hoverBg: isFlagged
                ? { light: "rgba(239,68,68,0.12)", dark: "rgba(248,113,113,0.18)" }
                : { light: "rgba(245,158,11,0.12)", dark: "rgba(251,191,36,0.18)" },
            visible: true,
            active: isFlagged,
        },
        {
            id: "edit",
            label: "Edit message",
            icon: <EditRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleEditClick,
            color: { light: "#0891b2", dark: "#22d3ee" },
            hoverBg: { light: "rgba(8,145,178,0.12)", dark: "rgba(34,211,238,0.18)" },
            visible: isOwnMessage,
        },
        {
            id: "openTask",
            label: "Open task",
            icon: <OpenInNewRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleOpenTaskClick,
            color: { light: "#0d9488", dark: "#2dd4bf" },
            hoverBg: { light: "rgba(13,148,136,0.12)", dark: "rgba(45,212,191,0.18)" },
            visible: isProjectChat && isSystemMessage && message.taskId !== null,
        },
        {
            id: "delete",
            label: "Delete message",
            icon: <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleDeleteClick,
            color: { light: "#dc2626", dark: "#f87171" },
            hoverBg: { light: "rgba(220,38,38,0.12)", dark: "rgba(248,113,113,0.18)" },
            visible: canDelete,
            danger: true,
        },
    ];

    const visibleItems = menuItems.filter((item) => item.visible);

    // Dropdown menu rendered via portal - using Box with role="menu" for accessibility
    const dropdownMenu = isOpen
        ? createPortal(
              <Box
                  ref={menuRef}
                  role="menu"
                  aria-orientation="vertical"
                  onClick={(e) => e.stopPropagation()}
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
                                  onClick={item.onClick}
                                  onMouseEnter={() => setFocusedIndex(index)}
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
                                                      ? `${item.color.dark}15`
                                                      : `${item.color.light}12`
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
                                              boxShadow: `0 0 10px ${isDark ? item.color.dark : item.color.light}50`,
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
                size="sm"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onClick={(e) => {
                    e.stopPropagation();
                    if (isOpen) {
                        closeMenu();
                    } else {
                        openMenu();
                    }
                }}
                sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "8px",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    color: isOpen
                        ? isDark
                            ? "#a5b4fc"
                            : "#6366f1"
                        : isDark
                          ? "rgba(255,255,255,0.55)"
                          : "rgba(0,0,0,0.45)",
                    background: isOpen
                        ? isDark
                            ? "rgba(99,102,241,0.22)"
                            : "rgba(99,102,241,0.12)"
                        : "transparent",
                    "&:hover": {
                        background: isDark ? "rgba(99,102,241,0.28)" : "rgba(99,102,241,0.15)",
                        color: isDark ? "#a5b4fc" : "#6366f1",
                        transform: "scale(1.08)",
                    },
                    "&:focus-visible": {
                        background: isDark ? "rgba(99,102,241,0.28)" : "rgba(99,102,241,0.15)",
                        color: isDark ? "#a5b4fc" : "#6366f1",
                        outline: "2px solid",
                        outlineColor: isDark ? "#818cf8" : "#6366f1",
                        outlineOffset: "2px",
                    },
                    "&:active": {
                        transform: "scale(0.95)",
                    },
                }}
            >
                <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>

            {/* Portal-rendered dropdown menu */}
            {dropdownMenu}

            {/* Delete Confirmation Modal */}
            <ModalDeleteMessage
                accessToken={accessToken}
                currentChat={chat}
                isThread={false}
                message={message}
                openDeleteMessage={openDeleteMessage}
                setCurrentChat={setCurrentChat}
                setOpenDeleteMessage={setOpenDeleteMessage}
                socket={socket}
            />
        </Box>
    );
};
