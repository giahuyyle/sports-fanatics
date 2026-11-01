import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const options = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const auth = Object.values(options).every(Boolean) ? getAuth(initializeApp(options)) : null;
