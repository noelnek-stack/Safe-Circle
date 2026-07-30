// Thin wrapper around fetch() for talking to the SafeCircle backend (server/).
// Set VITE_API_URL in a .env file at the project root if your API isn't
// running on the default http://localhost:5000.

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

let authToken = null

export function setAuthToken(token) {
  authToken = token
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth && authToken) headers.Authorization = `Bearer ${authToken}`

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Could not reach the SafeCircle server. Is it running?')
  }

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await response.json() : null

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`)
  }
  return data
}

export const api = {
  signup: (name, email, password) => request('/auth/signup', { method: 'POST', body: { name, email, password }, auth: false }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  me: () => request('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false }),

  getSettings: () => request('/settings'),
  updateSettings: (patch) => request('/settings', { method: 'PUT', body: patch }),

  getContacts: () => request('/contacts'),
  addContact: (contact) => request('/contacts', { method: 'POST', body: contact }),
  removeContact: (id) => request(`/contacts/${id}`, { method: 'DELETE' }),

  triggerSos: (payload) => request('/sos/trigger', { method: 'POST', body: payload }),
  sosHistory: () => request('/sos/history'),

  registerFcmToken: (token) => request('/fcm/register', { method: 'POST', body: { token } }),
  unregisterFcmToken: (token) => request('/fcm/unregister', { method: 'POST', body: { token } }),

  getAlerts: () => request('/alerts'),
  reportAlert: (alert) => request('/alerts', { method: 'POST', body: alert }),
  dismissAlert: (id) => request(`/alerts/${id}/dismiss`, { method: 'POST' }),

  getCommunity: () => request('/community'),
  addPost: (post) => request('/community', { method: 'POST', body: post }),
  likePost: (id) => request(`/community/${id}/like`, { method: 'POST' }),

  getRoutes: () => request('/routes'),
  saveRoute: (route) => request('/routes', { method: 'POST', body: route }),
  removeRoute: (id) => request(`/routes/${id}`, { method: 'DELETE' }),

  getCheckIns: () => request('/checkins'),
  startCheckIn: (payload) => request('/checkins/start', { method: 'POST', body: payload }),
  endCheckIn: (status) => request('/checkins/end', { method: 'POST', body: { status } }),
}
