import axios from 'axios';

/**
 * Central Axios instance for all API calls.
 * - baseURL is empty so all requests use relative paths (/api/...) which
 *   Vite's dev proxy forwards to the backend. This avoids ERR_NAME_NOT_RESOLVED
 *   caused by sending docker-internal hostnames from the browser.
 * - The Authorization header interceptor is a no-op for now but ready for
 *   JWT token injection once auth is implemented.
 */
const apiClient = axios.create({
    baseURL: '',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor — attach auth token when available (future use)
apiClient.interceptors.request.use(
    (config: any) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error: unknown) => Promise.reject(error)
);

// Response interceptor — global error handling
apiClient.interceptors.response.use(
    (response: any) => response,
    (error: unknown) => {
        if (error instanceof Error) {
            console.error('API error:', error.message);
        }
        return Promise.reject(error);
    }
);

export default apiClient;
