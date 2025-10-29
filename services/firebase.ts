// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions"; // Import getFunctions

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration is loaded from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const firebaseApp = app;

// Initialize and export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

const functionsRegionOrCustomDomain =
  import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION ||
  import.meta.env.VITE_FIREBASE_FUNCTIONS_CUSTOM_DOMAIN ||
  undefined;

export const functions = functionsRegionOrCustomDomain
  ? getFunctions(app, functionsRegionOrCustomDomain)
  : getFunctions(app); // Initialize and export functions