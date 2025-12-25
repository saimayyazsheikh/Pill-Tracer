const firebaseConfig = {
    apiKey: "AIzaSyDPGk_0r3SSFfrCJ8yOCdKC1cXS9z_8oTo",
    authDomain: "pill-tracer-887b2.firebaseapp.com",
    projectId: "pill-tracer-887b2",
    storageBucket: "pill-tracer-887b2.firebasestorage.app",
    messagingSenderId: "93379004906",
    appId: "1:93379004906:web:6173d23c919c8125678a93",
    measurementId: "G-LKVQSF7S9J"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

let authToken = '';
let userData = {};

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = '/auth.html';
        return;
    }

    try {
        // Get ID token
        authToken = await user.getIdToken();

        // Verify token with backend to get user data
        const response = await fetch('/api/auth/verify-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: authToken })
        });

        const data = await response.json();

        if (!data.success) {
            await auth.signOut();
            localStorage.clear();
            window.location.href = '/auth.html';
            return;
        }

        userData = data.data;

        // Check if user is super admin
        if (userData.role !== 'super_admin') {
            await auth.signOut();
            localStorage.clear();
            alert('Access denied. Super admin access required.');
            window.location.href = '/auth.html';
            return;
        }

        // Check if approved
        if (userData.status !== 'approved') {
            await auth.signOut();
            localStorage.clear();
            alert('Your account is not approved.');
            window.location.href = '/auth.html';
            return;
        }

        // Store user data
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('userData', JSON.stringify(userData));

        // Initialize dashboard
        initializeDashboard();
    } catch (error) {
        console.error('Authentication error:', error);
        await auth.signOut();
        localStorage.clear();
        window.location.href = '/auth.html';
    }
});

function initializeDashboard() {
    document.getElementById('userEmail').textContent = userData.email;
    loadDashboardStats();
    loadUsers();
    loadActivityLogs();
    setupEventListeners();
}

function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            switchSection(section);
        });
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await auth.signOut();
        localStorage.clear();
        window.location.href = '/auth.html';
    });
}

function switchSection(section) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));

    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    document.getElementById(`${section}Section`).classList.add('active');

    const titles = {
        'dashboard': 'Super Admin Dashboard',
        'users': 'User Management',
        'activity': 'Activity Logs'
    };
    document.getElementById('sectionTitle').textContent = titles[section];
}

async function loadDashboardStats() {
    try {
        const response = await fetch('/api/super-admin/dashboard/stats', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('totalMedicines').textContent = data.data.totalMedicines;
            document.getElementById('totalBranches').textContent = data.data.totalBranches;
            document.getElementById('totalUsers').textContent = data.data.totalUsers;
            document.getElementById('pendingApprovals').textContent = data.data.pendingApprovals;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/super-admin/users', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success) {
            renderUsers(data.data);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => {
        const statusClass = user.status === 'approved' ? 'badge-success' :
            user.status === 'pending' ? 'badge-warning' : 'badge-danger';
        const createdDate = user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString() : 'N/A';

        return `
            <tr>
                <td><strong>${user.pharmacyName}</strong></td>
                <td>${user.email}</td>
                <td>${user.profile?.city || 'N/A'}</td>
                <td><span class="badge ${statusClass}">${user.status}</span></td>
                <td>${createdDate}</td>
                <td>
                    ${user.status === 'pending' ? `
                        <button class="btn btn-primary btn-sm" onclick="approveUser('${user.uid}')">
                            <i class="fas fa-check"></i> Approve
                        </button>
                    ` : ''}
                    ${user.status === 'approved' ? `
                        <button class="btn btn-danger btn-sm" onclick="suspendUser('${user.uid}')">
                            <i class="fas fa-ban"></i> Suspend
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

async function approveUser(uid) {
    if (!confirm('Approve this pharmacy?')) return;

    try {
        const response = await fetch(`/api/super-admin/users/${uid}/approve`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success) {
            alert('Pharmacy approved successfully!');
            loadUsers();
            loadDashboardStats();
        }
    } catch (error) {
        console.error('Error approving user:', error);
    }
}

async function suspendUser(uid) {
    if (!confirm('Suspend this pharmacy?')) return;

    try {
        const response = await fetch(`/api/super-admin/users/${uid}/suspend`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success) {
            alert('Pharmacy suspended');
            loadUsers();
        }
    } catch (error) {
        console.error('Error suspending user:', error);
    }
}

async function loadActivityLogs() {
    try {
        const response = await fetch('/api/super-admin/activity-logs?limit=50', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success) {
            renderActivityLogs(data.data);
        }
    } catch (error) {
        console.error('Error loading activity logs:', error);
    }
}

function renderActivityLogs(logs) {
    const tbody = document.getElementById('activityTableBody');
    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No activity logs</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(log => {
        const timestamp = log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'N/A';
        return `
            <tr>
                <td>${log.userId}</td>
                <td><span class="badge badge-success">${log.action}</span></td>
                <td>${log.resource}</td>
                <td>${timestamp}</td>
            </tr>
        `;
    }).join('');
}
