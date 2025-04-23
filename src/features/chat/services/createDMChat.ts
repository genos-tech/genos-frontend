import axios from 'axios';

import { authApi } from '../../../services/api';

export const createDm = async (
    accessToken: string | null,
    user1Id: string,
    user2Id: string,
    setErrorMessage?: (value: string) => void
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/dm/create/",
                {
                    user_1_id: user1Id,
                    user_2_id: user2Id
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
                console.error('DM already exists.');
                if (setErrorMessage) {
                    setErrorMessage('DM already exists.')
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
