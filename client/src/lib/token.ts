const KEY = 'tv_show_token';

export const getToken = (): string | null => {
  return localStorage.getItem(KEY);
};

export const setToken = (token: string): void => {
  localStorage.setItem(KEY, token);
};

export const clearToken = (): void => {
  localStorage.removeItem(KEY);
};
