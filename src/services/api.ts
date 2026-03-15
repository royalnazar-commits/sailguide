import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { SEED_ROUTES, SEED_POINTS, getPointsForRoute } from '../data/seedRoutes'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
})

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      SecureStore.deleteItemAsync('auth_token')
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
    try {
      // First try to get routes from API
      const apiRoutes = await api.get('/routes', { params }).then((r) => r.data)
      
      // Filter seed routes based on params
      let filteredSeedRoutes = [...SEED_ROUTES]
      
      if (params?.region && params.region !== 'All') {
        filteredSeedRoutes = filteredSeedRoutes.filter(r => r.region.includes(params.region!))
      }
      if (params?.difficulty && params.difficulty !== 'All') {
        filteredSeedRoutes = filteredSeedRoutes.filter(r => r.difficulty === params.difficulty)
      }
      if (params?.search) {
        const searchLower = params.search.toLowerCase()
        filteredSeedRoutes = filteredSeedRoutes.filter(r => 
          r.title.toLowerCase().includes(searchLower) ||
          r.description.toLowerCase().includes(searchLower) ||
          r.region.toLowerCase().includes(searchLower) ||
          r.tags.some(tag => tag.toLowerCase().includes(searchLower))
        )
      }
      
      // Combine API routes with filtered seed routes
      return [...filteredSeedRoutes, ...apiRoutes]
    } catch (error) {
      // If API fails, return only seed routes (filtered)
      let filteredSeedRoutes = [...SEED_ROUTES]
      
      if (params?.region && params.region !== 'All') {
        filteredSeedRoutes = filteredSeedRoutes.filter(r => r.region.includes(params.region!))
      }
      if (params?.difficulty && params.difficulty !== 'All') {
        filteredSeedRoutes = filteredSeedRoutes.filter(r => r.difficulty === params.difficulty)
      }
      if (params?.search) {
        const searchLower = params.search.toLowerCase()
        filteredSeedRoutes = filteredSeedRoutes.filter(r => 
          r.title.toLowerCase().includes(searchLower) ||
          r.description.toLowerCase().includes(searchLower) ||
          r.region.toLowerCase().includes(searchLower) ||
          r.tags.some(tag => tag.toLowerCase().includes(searchLower))
        )
      }
      
      return filteredSeedRoutes
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