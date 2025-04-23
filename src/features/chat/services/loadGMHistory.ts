import axios from 'axios';

import { authApi } from '../../../services/api';

export const loadGMHistory = async (
    userId: string,
    accessToken: string | null
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `user_id=${userId}`
            const res = await api.get(`/gm/getHistory/?${query}`);
            return res.data
        } else {
            console.error('Unauthorized. Auth toke is not found.');
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error('API error:', error.response?.status, error.response?.data);
        } else {
            console.error('Unexpected error:', error);
        }
    }
}

