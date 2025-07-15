import { useState, useEffect } from "react";
import { Autocomplete, Box } from "@mui/joy";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import CircularProgress from "@mui/joy/CircularProgress";
import { Socket } from "socket.io-client";

import { loadSearchList } from "../services/loadChatSearchList";
import { moveToSelectedChat } from "../services/moveToChat";
import { useAuth } from "../../../context/AuthContext";
import { UserProps } from "../../../types/admin";
import { SearchListProps, AllChatProps, ChatProps } from "../../../types/chat";

type ChatSearchProps = {
    myself: UserProps;
    socket: Socket | null;
    openSearchBox: boolean;
    setOpenSearchBox: (value: boolean) => void;
    setCurrentMainChat: (value: ChatProps) => void;
    allChats: AllChatProps[];
    setAllChats: (value: AllChatProps[]) => void;
};

export const ChatSearch = (props: ChatSearchProps) => {
    const {
        myself,
        socket,
        openSearchBox,
        setOpenSearchBox,
        setCurrentMainChat,
        allChats,
        setAllChats,
    } = props;
    const { accessToken } = useAuth();
    const [options, setOptions] = useState<SearchListProps[]>([]);
    const loading = openSearchBox && options.length === 0;

    const onChangeHandler = async (value: any) => {
        if (value !== null && socket !== null) {
            var isDm: boolean = true;
            if (value.type === "Group") {
                isDm = false;
            }
            console.log("joinnhere", value);
            socket.emit(
                "join",
                {
                    joiningCGId: value.id, // dm_id or gm_id
                    joiningCGName: value.name, // dm_name or gm_name
                    isDm: isDm,
                    chatType: isDm === true ? 1 : 2,
                    dmPartnerUserId: value.dmPartnerUser.userId || null,
                },
                (ack: any) => {
                    if (Number(value.id) !== -1)
                        moveToSelectedChat(
                            myself,
                            socket,
                            value.id,
                            value.name,
                            value.type === "Group" ? Boolean(false) : Boolean(true),
                            value.type === "Group" ? 2 : 1,
                            value.dmPartnerUser,
                            allChats,
                            setCurrentMainChat,
                            setAllChats,
                            setOpenSearchBox
                        );
                }
            );
        }
    };

    useEffect(() => {
        let active = true;

        if (!loading) {
            return undefined;
        }

        (async () => {
            const loadedUsers: SearchListProps[] = await loadSearchList(myself, accessToken);

            if (active) {
                setOptions([...loadedUsers]);
            }
        })();

        return () => {
            active = false;
        };
    }, [loading]);

    useEffect(() => {
        if (!open) {
            setOptions([]);
        }
    }, [openSearchBox]);

    return (
        <Box sx={{ px: 2, pb: 1.5, mt: 2 }}>
            <Autocomplete
                placeholder={"Search"}
                open={openSearchBox}
                onOpen={() => {
                    setOpenSearchBox(true);
                }}
                onClose={() => {
                    setOpenSearchBox(false);
                }}
                isOptionEqualToValue={(option, value) => option.name === value.name}
                getOptionLabel={(option) =>
                    option.type === "People" ? `${option.name} | ${option.email}` : option.name
                }
                options={options}
                loading={loading}
                endDecorator={
                    loading ? (
                        <CircularProgress size="sm" sx={{ bgcolor: "background.surface" }} />
                    ) : null
                }
                onChange={(event, value) => onChangeHandler(value)}
                size="sm"
                startDecorator={<SearchRoundedIcon />}
                aria-label="Search"
                groupBy={(option) => option.type}
            />
        </Box>
    );
};
