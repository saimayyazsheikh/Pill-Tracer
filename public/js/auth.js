// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDPGk_0r3SSFfrCJ8yOCdKC1cXS9z_8oTo",
    authDomain: "pill-tracer-887b2.firebaseapp.com",
    projectId: "pill-tracer-887b2",
    storageBucket: "pill-tracer-887b2.firebasestorage.app",
    messagingSenderId: "93379004906",
    appId: "1:93379004906:web:6173d23c919c8125678a93",
    measurementId: "G-LKVQSF7S9J"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginFormElement = document.getElementById('loginFormElement');
const registerFormElement = document.getElementById('registerFormElement');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const loadingOverlay = document.getElementById('loadingOverlay');

// Switch between login and register
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.remove('active');
    loginForm.classList.add('active');
});

// Show/hide loading
function showLoading() {
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// Show alert message
function showAlert(message, type = 'info') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    const activeForm = document.querySelector('.auth-form.active');
    const existingAlert = activeForm.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    activeForm.insertBefore(alert, activeForm.querySelector('form'));

    setTimeout(() => alert.remove(), 5000);
}

// Handle Login
loginFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    showLoading();

    try {
        // Sign in with Firebase
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Get ID token
        const token = await user.getIdToken();

        // Verify token with backend
        const response = await fetch('/api/auth/verify-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });

        const data = await response.json();

        if (data.success) {
            // Store token and user data
            localStorage.setItem('authToken', token);
            localStorage.setItem('userData', JSON.stringify(data.data));

            // Redirect based on role
            if (data.data.role === 'super_admin') {
                window.location.href = '/admin-dashboard.html';
            } else if (data.data.role === 'pharmacy_admin') {
                if (data.data.status === 'approved') {
                    window.location.href = '/pharmacy-portal.html';
                } else if (data.data.status === 'pending') {
                    showAlert('Your account is pending approval. Please wait for admin approval.', 'info');
                    await auth.signOut();
                    hideLoading();
                } else {
                    showAlert('Your account has been suspended. Please contact support.', 'error');
                    await auth.signOut();
                    hideLoading();
                }
            }
        } else {
            showAlert(data.message || 'Login failed', 'error');
            hideLoading();
        }
    } catch (error) {
        console.error('Login error:', error);
        let message = 'Login failed. Please try again.';

        if (error.code === 'auth/user-not-found') {
            message = 'No account found with this email. Please register first.';
        } else if (error.code === 'auth/wrong-password') {
            message = 'Incorrect password. Please try again.';
        } else if (error.code === 'auth/invalid-email') {
            message = 'Invalid email address format.';
        } else if (error.code === 'auth/too-many-requests') {
            message = 'Too many failed attempts. Please try again later.';
        } else if (error.message && error.message.includes('token')) {
            message = 'Authentication error. Please contact support if this persists.';
        }

        showAlert(message, 'error');
        hideLoading();
    }
});

// Handle Registration
registerFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const pharmacyName = document.getElementById('regPharmacyName').value;
    const city = document.getElementById('regCity').value;
    const phone = document.getElementById('regPhone').value;
    const address = document.getElementById('regAddress').value;
    const licenseNumber = document.getElementById('regLicense').value;

    if (password.length < 6) {
        showAlert('Password must be at least 6 characters long.', 'error');
        return;
    }

    showLoading();

    try {
        // Register with backend
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password,
                pharmacyName,
                city,
                phone,
                address,
                licenseNumber
            })
        });

        const data = await response.json();

        if (data.success) {
            showAlert('Registration successful! Please wait for admin approval.', 'success');

            // Clear form
            registerFormElement.reset();

            // Switch to login form after 2 seconds
            setTimeout(() => {
                registerForm.classList.remove('active');
                loginForm.classList.add('active');
            }, 2000);
        } else {
            showAlert(data.message || 'Registration failed', 'error');
        }

        hideLoading();
    } catch (error) {
        console.error('Registration error:', error);
        let message = 'Registration failed. ';

        if (error.message) {
            message += error.message;
        } else {
            message += 'Please check your connection and try again.';
        }

        showAlert(message, 'error');
        hideLoading();
    }
});

// Check if already logged in
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const token = await user.getIdToken();
        const response = await fetch('/api/auth/verify-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });

        const data = await response.json();

        if (data.success && data.data.status === 'approved') {
            if (data.data.role === 'super_admin') {
                window.location.href = '/admin-dashboard.html';
            } else if (data.data.role === 'pharmacy_admin') {
                window.location.href = '/pharmacy-portal.html';
            }
        }
    }
});
