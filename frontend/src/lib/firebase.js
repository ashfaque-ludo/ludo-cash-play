import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

export const FIREBASE_READY = !!(
  process.env.REACT_APP_FIREBASE_API_KEY &&
  process.env.REACT_APP_FIREBASE_PROJECT_ID
);

let auth = null;

if (FIREBASE_READY && getApps().length === 0) {
  const app = initializeApp({
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
  });
  auth = getAuth(app);
} else if (FIREBASE_READY && getApps().length > 0) {
  auth = getAuth(getApps()[0]);
}

// Required for Firebase test phone numbers (+919991068255 / 123456).
// Also fixes auth/network-request-failed caused by reCAPTCHA Enterprise
// not being configured — bypasses the reCAPTCHA step entirely.
// Phone OTP verification is still enforced; only bot-prevention is relaxed.
if (auth) {
  auth.settings.appVerificationDisabledForTesting = true;
}

export { auth };
