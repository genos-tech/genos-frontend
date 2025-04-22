import axios from 'axios';

import { authApi } from '../../../services/api';

export const getMyTeams = async (
    accessToken: string,
    userId: string,
    setErrorMessage?: (value: string) => void
) => {
    try {
        const api = authApi(accessToken);
        const query = `user_id=${userId}`
        if (api) {
            const res = await api.get(`/team/getMyTeams/?${query}`);
            return res.data
        } else {
            console.error('Unauthorized. Auth toke is not found.');
            if (setErrorMessage) {
                setErrorMessage('Unauthorized. Auth toke is not found.')
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error('API error:', error.response?.status, error.response?.data);
        } else {
            console.error('Unexpected error:', error);
        }
    }
}
