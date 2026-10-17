/** API path of a citizen case. Shared by the page's preload and the client fetch, which must match. */
export const casePath = (token: string) => `/api/c/${encodeURIComponent(token)}`;
