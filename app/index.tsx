import { Redirect } from 'expo-router'
import { useAuthStore } from '../src/store/authStore'
import { View, ActivityIndicator } from 'react-native'
import { Colors } from '../src/constants/colors'

export default function Index() {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={Colors.primary} size="large" />
    </View>
  )
  if (!user) return <Redirect href="/onboarding" />
  return <Redirect href="/(tabs)/explore" />
}