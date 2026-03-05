import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: 'AIzaSyBgtqkn_jsWMtTu8cHqBowSA9UrKFUnN_Y',
    authDomain: 'firstprincipleslearning-f7526.firebaseapp.com',
    databaseURL: 'https://firstprincipleslearning-f7526-default-rtdb.firebaseio.com',
    projectId: 'firstprincipleslearning-f7526',
    storageBucket: 'firstprincipleslearning-f7526.firebasestorage.app',
    messagingSenderId: '67354182023',
    appId: '1:67354182023:web:9908140439106c39325322',
    measurementId: 'G-9MXBD0NJ5B',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
