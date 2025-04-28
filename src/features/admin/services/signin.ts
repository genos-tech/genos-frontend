import axios from 'axios';

import { nonAuthApi } from '../../../services/api';

export const signIn = async (
    email: string,
    password: string,
    setErrorMessage?: (value: string) => void
) => {
    try {
        const api = nonAuthApi();
        const res = await api.post('/user/signin/', { email, password });
        return res.data
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 401) {
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
