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

// Login Function
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('dashboard-screen').classList.remove('hidden');
    } catch (error) {
        document.getElementById('login-error').textContent = error.message;
    }
});

// Logout Function
document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await auth.signOut();
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
});

// Auth State Observer
auth.onAuthStateChanged(user => {
    if (user) {
        console.log('User logged in:', user.email);
    }
});
