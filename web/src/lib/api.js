const TOKEN_KEY = 'hrm_token';
const USER_KEY = 'hrm_user';
const unauthorizedListeners = new Set();

export function getSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  const rawUser = localStorage.getItem(USER_KEY);
  if (!token || !rawUser) return null;
  try {
    return { token, user: JSON.parse(rawUser) };
  } catch {
    return null;
  }
}

export function setSession({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export async function apiFetch(path, options = {}) {
  const session = getSession();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !path.startsWith('/api/v1/auth/login')) {
    clearSession();
    for (const listener of unauthorizedListeners) {
      listener();
    }
  }
  if (!res.ok) {
    throw new Error(data.error || `Lỗi ${res.status}`);
  }
  return data;
}
