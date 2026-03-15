import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { authApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { Colors } from '../constants/colors'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Please fill in all fields')
    setLoading(true)
    try {
      const res = await authApi.login({ email, password })
      await setAuth(res.user, res.token)
      router.replace('/(tabs)/explore')
    } catch (err: any) {
      Alert.alert('Login failed', err.response?.data?.error || 'Check your credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
        <View style={styles.header}>
          <Ionicons name="compass" size={44} color={Colors.primary} />
          <Text style={styles.brand}>SailGuide</Text>
          <Text style={styles.tagline}>Your sailing route companion</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="captain@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={[styles.input, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              autoComplete="password"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginText}>Sign In</Text>}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.line} />
          </View>

          <TouchableOpacity style={styles.registerBtn} onPress={() => router.push('/register')}>
            <Text style={styles.registerText}>Create an account</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.demoBtn} onPress={() => {
            setEmail('demo@sailguide.app')
            setPassword('demo1234')
          }}>
            <Text style={styles.demoText}>Fill demo credentials</Text>
          </TouchableOpacity>
        </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#fff', padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  brand: { fontSize: 30, fontWeight: '800', color: Colors.primary, marginTop: 12 },
  tagline: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },
  form: { gap: 4 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15,
    color: Colors.text, backgroundColor: '#F8FAFC', marginBottom: 16,
  },
  passwordWrap: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5,
    borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14,
    backgroundColor: '#F8FAFC', marginBottom: 24,
  },
  loginBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 16,
  },
  loginText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: { color: Colors.textMuted, fontSize: 14 },
  registerBtn: {
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginBottom: 12,
  },
  registerText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  demoBtn: { alignItems: 'center', paddingVertical: 8 },
  demoText: { color: Colors.textMuted, fontSize: 14, textDecorationLine: 'underline' },
})