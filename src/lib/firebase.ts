// ── Firebase Configuration ────────────────────────────────────────────
// Replace the placeholder values below with YOUR Firebase project config.
// Get it from: Firebase Console → Project Settings → Your apps → Config
// ──────────────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
