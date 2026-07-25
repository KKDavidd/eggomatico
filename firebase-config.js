const firebaseConfig = {
  apiKey: "AIzaSyChs6POI46C9Hr1xgbiCzavh6D198n20Jw",
  authDomain: "tibiredonykft.firebaseapp.com",
  projectId: "tibiredonykft",
  storageBucket: "tibiredonykft.firebasestorage.app",
  messagingSenderId: "401911833075",
  appId: "1:401911833075:web:1e2a5c90fbc82473c9b286"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = (typeof firebase.auth === 'function') ? firebase.auth() : null;
