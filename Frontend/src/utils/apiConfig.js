export const getApiUrl = (endpoint) => {
    const host = import.meta.env.VITE_API_HOST_IP || '127.0.0.1';
    const port = import.meta.env.VITE_API_HOST_PORT || '8015';
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `http://${host}:${port}${path}`;
};
