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

// Global variables
let authToken = '';
let userData = {};
let currentInventory = [];

// Check authentication
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = '/auth.html';
        return;
    }

    try {
        authToken = await user.getIdToken();

        const response = await fetch('/api/auth/verify-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: authToken })
        });

        const data = await response.json();

        if (!data.success || data.data.role !== 'pharmacy_admin' || data.data.status !== 'approved') {
            await auth.signOut();
            localStorage.clear();
            alert(data.data.status === 'pending' ? 'Your account is pending approval.' : 'Access denied.');
            window.location.href = '/auth.html';
            return;
        }

        userData = data.data;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('userData', JSON.stringify(userData));

        initializeDashboard();
    } catch (error) {
        console.error('Authentication error:', error);
        await auth.signOut();
        localStorage.clear();
        window.location.href = '/auth.html';
    }
});

// Initialize dashboard
function initializeDashboard() {
    document.getElementById('pharmacyName').textContent = userData.pharmacyName;
    document.getElementById('userEmail').textContent = userData.email;

    loadDashboardStats();
    loadInventory();
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchSection(item.dataset.section);
        });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await auth.signOut();
        localStorage.clear();
        window.location.href = '/auth.html';
    });

    // Inventory actions
    document.getElementById('refreshInventory').addEventListener('click', loadInventory);
    document.getElementById('searchInventory').addEventListener('input', filterInventory);

    // Add medicine buttons
    document.getElementById('addNewMedicineBtn').addEventListener('click', openAddModal);
    document.getElementById('addFromMasterBtn').addEventListener('click', openMasterModal);

    // Add new medicine
    document.getElementById('saveNewMedicineBtn').addEventListener('click', saveNewMedicine);

    // Master list search
    document.getElementById('medicineSearch').addEventListener('input', searchMedicines);
    document.getElementById('addToInventoryBtn').addEventListener('click', addFromMaster);

    // Edit medicine
    document.getElementById('saveEditBtn').addEventListener('click', saveEdit);
}

// Switch section
function switchSection(section) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));

    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    document.getElementById(`${section}Section`).classList.add('active');

    const titles = {
        'dashboard': 'Dashboard',
        'inventory': 'My Inventory'
    };
    document.getElementById('sectionTitle').textContent = titles[section];
}

// Modal functions
function openAddModal() {
    document.getElementById('addMedicineModal').classList.add('active');
    document.getElementById('newMedicineName').value = '';
    document.getElementById('newMedicineDesc').value = '';
    document.getElementById('newMedicinePrice').value = '';
    document.getElementById('newMedicineQuantity').value = '';
}

function closeAddModal() {
    document.getElementById('addMedicineModal').classList.remove('active');
}

function openMasterModal() {
    document.getElementById('masterListModal').classList.add('active');
    document.getElementById('medicineSearch').value = '';
    document.getElementById('selectedMedicineInfo').style.display = 'none';
    document.getElementById('medicineResults').classList.remove('active');
}

function closeMasterModal() {
    document.getElementById('masterListModal').classList.remove('active');
}

function openEditModal(id, name, description, price, quantity) {
    document.getElementById('editMedicineModal').classList.add('active');
    document.getElementById('editMedicineId').value = id;
    document.getElementById('editMedicineName').value = name;
    document.getElementById('editMedicineDesc').value = description || '';
    document.getElementById('editMedicinePrice').value = price;
    document.getElementById('editMedicineQuantity').value = quantity;
}

function closeEditModal() {
    document.getElementById('editMedicineModal').classList.remove('active');
}

// Load dashboard stats
async function loadDashboardStats() {
    try {
        const response = await fetch('/api/pharmacy/dashboard/stats', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        if (data.success) {
            document.getElementById('totalMedicines').textContent = data.data.totalMedicines;
            document.getElementById('inventoryValue').textContent = `PKR ${data.data.inventoryValue.toLocaleString()}`;
            document.getElementById('lowStock').textContent = data.data.lowStock;
            document.getElementById('outOfStock').textContent = data.data.outOfStock;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load inventory
async function loadInventory() {
    showLoading();
    try {
        const response = await fetch('/api/pharmacy/inventory', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        if (data.success) {
            currentInventory = data.data;
            renderInventory(currentInventory);
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
    }
    hideLoading();
}

// Render inventory
function renderInventory(inventory) {
    const tbody = document.getElementById('inventoryTableBody');

    if (inventory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No medicines in inventory. Click "Add New Medicine" to get started!</td></tr>';
        return;
    }

    tbody.innerHTML = inventory.map(item => {
        const status = item.quantity === 0 ? 'Out of Stock' :
            item.quantity < 20 ? 'Low Stock' : 'In Stock';
        const badgeClass = item.quantity === 0 ? 'badge-danger' :
            item.quantity < 20 ? 'badge-warning' : 'badge-success';

        return `
            <tr>
                <td><strong>${item.medicine_name}</strong></td>
                <td>${item.description || '-'}</td>
                <td>PKR ${item.price.toFixed(2)}</td>
                <td>${item.quantity}</td>
                <td><span class="badge ${badgeClass}">${status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary btn-sm" onclick="openEditModal('${item.id}', '${item.medicine_name.replace(/'/g, "\\'")}', '${(item.description || '').replace(/'/g, "\\'")}', ${item.price}, ${item.quantity})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteMedicine('${item.id}', '${item.medicine_name.replace(/'/g, "\\'")}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter inventory
function filterInventory() {
    const search = document.getElementById('searchInventory').value.toLowerCase();
    const filtered = currentInventory.filter(item =>
        item.medicine_name.toLowerCase().includes(search) ||
        (item.description && item.description.toLowerCase().includes(search))
    );
    renderInventory(filtered);
}

// Save new medicine
async function saveNewMedicine() {
    const name = document.getElementById('newMedicineName').value.trim();
    const description = document.getElementById('newMedicineDesc').value.trim();
    const price = document.getElementById('newMedicinePrice').value;
    const quantity = document.getElementById('newMedicineQuantity').value;

    if (!name || !price || !quantity) {
        alert('Please fill in all required fields (Name, Price, Quantity)');
        return;
    }

    showLoading();
    try {
        const response = await fetch('/api/pharmacy/inventory/direct', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                medicine_name: name,
                description: description,
                price: parseFloat(price),
                quantity: parseInt(quantity)
            })
        });

        const data = await response.json();
        if (data.success) {
            alert('Medicine added successfully!');
            closeAddModal();
            loadInventory();
            loadDashboardStats();
        } else {
            alert(data.message || 'Failed to add medicine');
        }
    } catch (error) {
        console.error('Error adding medicine:', error);
        alert('Error adding medicine');
    }
    hideLoading();
}

// Search medicines from master list
let searchTimeout;
async function searchMedicines() {
    clearTimeout(searchTimeout);
    const query = document.getElementById('medicineSearch').value;

    if (query.length < 2) {
        document.getElementById('medicineResults').classList.remove('active');
        return;
    }

    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`/api/pharmacy/medicines/search?q=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            const data = await response.json();
            if (data.success) {
                renderMedicineResults(data.data);
            }
        } catch (error) {
            console.error('Error searching medicines:', error);
        }
    }, 300);
}

function renderMedicineResults(medicines) {
    const results = document.getElementById('medicineResults');

    if (medicines.length === 0) {
        results.innerHTML = '<div class="search-result-item">No medicines found</div>';
    } else {
        results.innerHTML = medicines.map(med => `
            <div class="search-result-item" onclick="selectMedicine('${med.id}', '${med.name.replace(/'/g, "\\'")}', '${(med.description || '').replace(/'/g, "\\'")}')">
                <strong>${med.name}</strong><br>
                <small>${med.description || 'No description'}</small>
            </div>
        `).join('');
    }

    results.classList.add('active');
}

function selectMedicine(id, name, description) {
    document.getElementById('selectedMedicineId').value = id;
    document.getElementById('selectedMedicineName').textContent = name;
    document.getElementById('selectedMedicineDesc').textContent = description || 'No description';
    document.getElementById('selectedMedicineInfo').style.display = 'block';
    document.getElementById('medicineResults').classList.remove('active');
    document.getElementById('medicineSearch').value = name;
}

// Add from master list
async function addFromMaster() {
    const medicineId = document.getElementById('selectedMedicineId').value;
    const price = document.getElementById('medicinePrice').value;
    const quantity = document.getElementById('medicineQuantity').value;

    if (!medicineId || !price || !quantity) {
        alert('Please select a medicine and fill in price and quantity');
        return;
    }

    showLoading();
    try {
        const response = await fetch('/api/pharmacy/inventory', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                medicine_id: medicineId,
                price: parseFloat(price),
                quantity: parseInt(quantity)
            })
        });

        const data = await response.json();
        if (data.success) {
            alert('Medicine added to inventory!');
            closeMasterModal();
            loadInventory();
            loadDashboardStats();
        } else {
            alert(data.message || 'Failed to add medicine');
        }
    } catch (error) {
        console.error('Error adding medicine:', error);
        alert('Error adding medicine');
    }
    hideLoading();
}

// Save edit
async function saveEdit() {
    const id = document.getElementById('editMedicineId').value;
    const name = document.getElementById('editMedicineName').value.trim();
    const description = document.getElementById('editMedicineDesc').value.trim();
    const price = document.getElementById('editMedicinePrice').value;
    const quantity = document.getElementById('editMedicineQuantity').value;

    if (!name || !price || !quantity) {
        alert('Please fill in all required fields');
        return;
    }

    showLoading();
    try {
        const response = await fetch(`/api/pharmacy/inventory/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                medicine_name: name,
                description: description,
                price: parseFloat(price),
                quantity: parseInt(quantity)
            })
        });

        const data = await response.json();
        if (data.success) {
            alert('Medicine updated successfully!');
            closeEditModal();
            loadInventory();
            loadDashboardStats();
        } else {
            alert(data.message || 'Failed to update medicine');
        }
    } catch (error) {
        console.error('Error updating medicine:', error);
        alert('Error updating medicine');
    }
    hideLoading();
}

// Delete medicine
async function deleteMedicine(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
        return;
    }

    showLoading();
    try {
        const response = await fetch(`/api/pharmacy/inventory/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        if (data.success) {
            alert('Medicine deleted successfully!');
            loadInventory();
            loadDashboardStats();
        } else {
            alert(data.message || 'Failed to delete medicine');
        }
    } catch (error) {
        console.error('Error deleting medicine:', error);
        alert('Error deleting medicine');
    }
    hideLoading();
}

// Loading helpers
function showLoading() {
    document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}
