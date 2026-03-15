import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useAuthStore } from '../src/store/authStore'
import { useProfileStore } from '../src/store/profileStore'
import { usePlacesStore } from '../src/store/placesStore'
import { useCommentsStore } from '../src/store/commentsStore'
import { useRouteBuilderStore } from '../src/store/routeBuilderStore'
import { useConditionsStore } from '../src/store/conditionsStore'
import { useContributorStore } from '../src/store/contributorStore'
import { useCaptainStore } from '../src/store/captainStore'
import { RewardToast } from '../src/components/RewardToast'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
})

export default function RootLayout() {
  const loadAuth = useAuthStore((s) => s.loadAuth)
  const loadProfile = useProfileStore((s) => s.loadProfile)
  const loadPlaces     = usePlacesStore((s) => s.loadPlaces)
  const initLocalUser  = usePlacesStore((s) => s.initLocalUser)
  const loadComments = useCommentsStore((s) => s.loadComments)
  const loadRoutes = useRouteBuilderStore((s) => s.loadRoutes)
  const loadConditions   = useConditionsStore((s) => s.loadReports)
  const loadContributor  = useContributorStore((s) => s.loadContributor)
  const loadCaptainData  = useCaptainStore((s) => s.loadCaptainData)
  useEffect(() => { loadAuth(); loadProfile(); loadPlaces(); initLocalUser(); loadComments(); loadRoutes(); loadConditions(); loadContributor(); loadCaptainData() }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="route/[id]/index" />
            <Stack.Screen name="route/[id]/map" />
            <Stack.Screen name="navigate/[id]" />
            <Stack.Screen name="marina/[id]" />
            <Stack.Screen name="captain/[id]" />
            <Stack.Screen name="nearby" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="place/[id]" />
            <Stack.Screen name="my-places" />
            <Stack.Screen name="create-place" />
            <Stack.Screen name="my-routes" />
            <Stack.Screen name="route-builder" />
            <Stack.Screen name="place-picker" />
            <Stack.Screen name="user-route/[id]" />
            <Stack.Screen name="captain-dashboard" />
            <Stack.Screen name="boat/[id]" />
            <Stack.Screen name="booking/[id]" />
          </Stack>
          <RewardToast />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}