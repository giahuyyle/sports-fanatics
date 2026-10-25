import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY

export const adminAuth =
  projectId && apiKey
    ? getAuth(
        initializeApp(
          {
            projectId,
            apiKey,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          },
          'sports-fanatics-admin',
        ),
      )
    : null

if (adminAuth && import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL) {
  connectAuthEmulator(adminAuth, import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL)
}
