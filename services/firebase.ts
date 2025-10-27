// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBsgvePGLlADEQoPpQU4Vj54AJFzCniY3s",
  authDomain: "trac-nghiem-oline.firebaseapp.com",
  projectId: "trac-nghiem-oline",
  storageBucket: "trac-nghiem-oline.appspot.com",
  messagingSenderId: "1045919082825",
  appId: "1:1045919082825:web:5544f4d9f08429c6f5d298"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
