// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCK-pRuG2UBYzbzyg6NEoJqFeM9bVokKsU",
  authDomain: "energy-dashboard-3phase.firebaseapp.com",
  projectId: "energy-dashboard-3phase",
  storageBucket: "energy-dashboard-3phase.firebasestorage.app",
  messagingSenderId: "538942868301",
  appId: "1:538942868301:web:e5075552648f5135a24504"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Auto redirect if already logged in
auth.onAuthStateChanged(user => {
    if (user) {
        console.log('User logged in:', user.email);
    }
});
