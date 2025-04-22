import axios from 'axios';

import { authApi } from '../../../services/api';

export const addDmMessage = async (
    accessToken: string | null,
    dmId: number,
    senderId: string,
    receiverId: string,
    messageBody: any[],
    setErrorMessage?: (value: string) => void,
    isInit?: boolean,
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/dm/addMessage/",
                {
                    dm_id: dmId,
                    sender_id: senderId,
                    receiver_id: receiverId,
                    message_body: messageBody,
                    is_init: true ? isInit : false,
                });
            return res.data
        } else {
            console.error('Unauthorized. Auth toke is not found.');
            if (setErrorMessage) {
                setErrorMessage('Unauthorized. Auth toke is not found.')
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                console.error('Message Id already exists.');
                if (setErrorMessage) {
                    setErrorMessage('Message Id already exists.')
                }
            } else if (error.response?.status === 401) {
                console.error('Unauthorized. Please log in again.');
                if (setErrorMessage) {
                    setErrorMessage('Unauthorized. Please log in again.')
                }
            } else {
                console.error('API error:', error.response?.status, error.response?.data);
            }
        } else {
            console.error('Unexpected error:', error);
        }
    }
}
