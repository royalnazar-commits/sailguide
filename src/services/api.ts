import axios, { AxiosError } from 'axios'
import { useAuthStore } from '../store/authStore'
import { SEED_ROUTES, SEED_POINTS, getPointsForRoute } from '../data/seedRoutes'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

if (__DEV__ && API_URL.includes('localhost')) {
  console.warn(
    '[api] BASE_URL is localhost — requests will fail on a real device.\n' +
    'Set EXPO_PUBLIC_API_URL=http://<your-machine-ip>:3000 in .env and restart Expo.'
  )
}

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
})

// ── Request interceptor ───────────────────────────────────────────────────────
//
// Reads the token from the Zustand auth store's in-memory state.
//
// WHY NOT SecureStore?
//   SecureStore is the persistence layer (disk). The Zustand store is the
//   runtime source of truth: it is populated from SecureStore once on app
//   start (loadAuth), and then stays current for the lifetime of the session.
//   Reading from the store is synchronous, avoiding all async-interceptor
//   timing problems and ensuring we always use the same token that the rest
//   of the app believes is active.
//
// HOW TO USE ZUSTAND OUTSIDE REACT:
//   useAuthStore is both a React hook and a store object. Calling
//   useAuthStore.getState() (not as a hook) is safe anywhere — no component
//   context required.

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  } else if (__DEV__) {
    // Log missing token only for endpoints that typically require auth
    const url = config.url ?? ''
    const publicPaths = ['/auth/register', '/auth/login', '/health']
    const isPublic = publicPaths.some((p) => url.includes(p))
    if (!isPublic) {
      console.warn(
        `[api] ⚠ No auth token for ${config.method?.toUpperCase()} ${config.baseURL}${url}.\n` +
        '  → User is not logged in, or loadAuth() has not yet completed.',
      )
    }
  }

  if (__DEV__) {
    const authed = token ? '✓ authed' : '✗ no token'
    console.log(`[api] → ${config.method?.toUpperCase()} ${config.baseURL}${config.url} (${authed})`)
  }

  return config
})

// ── Response / error interceptor ─────────────────────────────────────────────
//
// On 401: clears auth from BOTH the Zustand store and SecureStore (via
// clearAuth). This keeps them in sync — the store is always the authority.
//
// On network failure: replaces the raw "Network Error" with a message that
// names the URL and current API_URL, so developers know where to look.
//
// Server error messages from { error: "..." } JSON bodies are surfaced as the
// exception's .message, so catch blocks in screens get readable strings.

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (__DEV__) {
      if (err.response) {
        console.error(
          `[api] ✗ ${err.response.status} ${err.config?.method?.toUpperCase()} ` +
          `${err.config?.baseURL}${err.config?.url}`,
          err.response.data,
        )
      } else if (err.request) {
        console.error(
          `[api] ✗ No response for ${err.config?.method?.toUpperCase()} ` +
          `${err.config?.baseURL}${err.config?.url}\n` +
          `  code=${err.code}  message=${err.message}\n` +
          `  → Is the backend running? Is EXPO_PUBLIC_API_URL set correctly? (currently: ${API_URL})`,
        )
      } else {
        console.error('[api] ✗ Request setup error:', err.message)
      }
    }

    if (err.response?.status === 401) {
      // Clear auth from both Zustand store (in-memory) and SecureStore (persisted).
      // This keeps them in sync and causes auth-gated UI to show the login screen.
      useAuthStore.getState().clearAuth()

      if (__DEV__) {
        console.warn(
          '[api] 401 received — auth cleared. User will need to log in again.\n' +
          `  URL: ${err.config?.baseURL}${err.config?.url}`,
        )
      }
    }

    // Replace raw axios error messages with the server's own error string,
    // so screens can show `err.message` directly in alerts/toasts.
    const serverMessage = (err.response?.data as any)?.error
    if (serverMessage) {
      err.message = serverMessage
    } else if (!err.response) {
      err.message =
        `Cannot reach server at ${API_URL}. ` +
        `Check that the backend is running and EXPO_PUBLIC_API_URL is correct.`
    }

    return Promise.reject(err)
  }
)

// Auth
export const authApi = {
  register: (data: { name: string; email: string; password: string; role?: string }) =>
    api.post('/auth/register', data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  updateProfile: (data: { name?: string; bio?: string }) =>
    api.put('/auth/me', data).then((r) => r.data),
}

function filterSeedRoutes(params?: {
  region?: string
  difficulty?: string
  search?: string
}) {
  let result = [...SEED_ROUTES]
  if (params?.region && params.region !== 'All') {
    result = result.filter((r) => r.region.includes(params.region!))
  }
  if (params?.difficulty && params.difficulty !== 'All') {
    result = result.filter((r) => r.difficulty === params.difficulty)
  }
  if (params?.search) {
    const q = params.search.toLowerCase()
    result = result.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.tags.some((tag) => tag.toLowerCase().includes(q)),
    )
  }
  return result
}

// Routes
export const routesApi = {
  list: async (params?: {
    region?: string
    difficulty?: string
    minDays?: number
    maxDays?: number
    maxPrice?: number
    search?: string
  }) => {
    const seedRoutes = filterSeedRoutes(params)
    try {
      const apiRoutes = await api.get('/routes', { params }).then((r) => r.data)
      return [...seedRoutes, ...apiRoutes]
    } catch {
      // API unavailable — serve seed routes only (dev / offline mode)
      return seedRoutes
    }
  },
  get: async (id: string) => {
    // Check if it's a seed route first
    const seedRoute = SEED_ROUTES.find(r => r.id === id)
    if (seedRoute) {
      return seedRoute
    }
    
    // Otherwise try API
    return api.get(`/routes/${id}`).then((r) => r.data)
  },
  getPoints: async (id: string) => {
    // Check if it's a seed route first
    const seedPoints = getPointsForRoute(id)
    if (seedPoints.length > 0) {
      return seedPoints
    }
    
    // Otherwise try API
    return api.get(`/routes/${id}/points`).then((r) => r.data)
  },
  getReviews: async (id: string) => {
    // Check if it's a seed route first
    const seedRoute = SEED_ROUTES.find(r => r.id === id)
    if (seedRoute) {
      // Return some mock reviews for seed routes
      return [
        {
          id: `review-${id}-1`,
          userId: 'user-1',
          routeId: id,
          rating: 5,
          comment: 'Amazing route! Perfect for our first sailing adventure. The stops were well-planned and the descriptions very helpful.',
          createdAt: '2024-02-15T00:00:00Z',
          user: { id: 'user-1', name: 'Maria K.', avatarUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150' }
        },
        {
          id: `review-${id}-2`,
          userId: 'user-2',
          routeId: id,
          rating: 5,
          comment: 'Excellent route with beautiful anchorages. The SailGuide team really knows these waters!',
          createdAt: '2024-01-20T00:00:00Z',
          user: { id: 'user-2', name: 'Captain James', avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150' }
        }
      ]
    }
    
    // Otherwise try API
    return api.get(`/routes/${id}/reviews`).then((r) => r.data)
  },
  addReview: (id: string, data: { rating: number; comment?: string }) =>
    api.post(`/routes/${id}/reviews`, data).then((r) => r.data),
}

// Marinas
export const marinasApi = {
  list: (params?: { region?: string; fuel?: boolean; swLat?: number; swLng?: number; neLat?: number; neLng?: number }) =>
    api.get('/marinas', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/marinas/${id}`).then((r) => r.data),
  nearby: (params: { lat: number; lng: number; radiusKm?: number; limit?: number; fuel?: boolean }) =>
    api.get('/marinas/nearby', { params }).then((r) => r.data),
}

// Purchases
export const purchasesApi = {
  createIntent: (routeId: string) =>
    api.post('/payments/create-intent', { routeId }).then((r) => r.data),
  confirmMock: (routeId: string) =>
    api.post('/purchases/confirm-mock', { routeId }).then((r) => r.data),
  myPurchases: () => api.get('/me/purchases/me').then((r) => r.data),
}

// Captains
export const captainsApi = {
  get: (id: string) => api.get(`/captains/${id}`).then((r) => r.data),
}