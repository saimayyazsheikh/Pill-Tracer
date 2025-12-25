// ===== Configuration =====
const API_BASE = '/api';

// ===== DOM Elements =====
const elements = {
    searchInput: document.getElementById('searchInput'),
    countryFilter: document.getElementById('countryFilter'),
    cityFilter: document.getElementById('cityFilter'),
    searchBtn: document.getElementById('searchBtn'),
    resultsContainer: document.getElementById('resultsContainer'),
    resultsCount: document.getElementById('resultsCount'),
    resultsBody: document.getElementById('resultsBody'),
    loadingOverlay: document.getElementById('loadingOverlay')
};

// ===== Utility Functions =====
function showLoading() {
    elements.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
}

function formatPrice(price) {
    return `PKR ${parseFloat(price).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getStockBadge(quantity) {
    const qty = parseInt(quantity);
    if (qty > 100) {
        return '<span class="stock-badge stock-high">In Stock</span>';
    } else if (qty > 20) {
        return '<span class="stock-badge stock-medium">Limited</span>';
    } else if (qty > 0) {
        return '<span class="stock-badge stock-low">Low Stock</span>';
    } else {
        return '<span class="stock-badge stock-out">Out of Stock</span>';
    }
}

// ===== API Functions =====
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ===== Public Search Functions =====
async function loadFilters() {
    try {
        const data = await apiRequest('/public/filters');

        // Populate country filter
        elements.countryFilter.innerHTML = '<option value="">All Countries</option>';
        data.data.countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            elements.countryFilter.appendChild(option);
        });

        // Populate city filter
        elements.cityFilter.innerHTML = '<option value="">All Cities</option>';
        data.data.cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            elements.cityFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading filters:', error);
    }
}

async function searchMedicines() {
    const name = elements.searchInput.value.trim();
    const country = elements.countryFilter.value;
    const city = elements.cityFilter.value;

    if (!name && !country && !city) {
        alert('Please enter a medicine name or select filters');
        return;
    }

    showLoading();

    try {
        const params = new URLSearchParams();
        if (name) params.append('name', name);
        if (country) params.append('country', country);
        if (city) params.append('city', city);

        const data = await apiRequest(`/public/search?${params.toString()}`);

        displayResults(data.data, data.count);
    } catch (error) {
        alert('Error searching medicines: ' + error.message);
    } finally {
        hideLoading();
    }
}

function displayResults(results, count) {
    elements.resultsCount.textContent = `${count} result${count !== 1 ? 's' : ''}`;

    if (results.length === 0) {
        elements.resultsBody.innerHTML = `
            <tr class="no-results">
                <td colspan="6">
                    <div class="empty-state">
                        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                            <circle cx="32" cy="32" r="30" stroke="#e5e7eb" stroke-width="4"/>
                            <path d="M32 20v24M20 32h24" stroke="#e5e7eb" stroke-width="4" stroke-linecap="round"/>
                        </svg>
                        <p>No medicines found matching your criteria</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    elements.resultsBody.innerHTML = results.map(result => `
        <tr>
            <td><strong>${result.medicine_name}</strong></td>
            <td>${result.description || 'N/A'}</td>
            <td>${result.branch_name}<br><small style="color: #64748b;">${result.branch_address}</small></td>
            <td>${result.city}</td>
            <td><span class="price-tag">${formatPrice(result.price)}</span></td>
            <td>${result.quantity} units ${getStockBadge(result.quantity)}</td>
        </tr>
    `).join('');
}

// ===== Event Listeners =====
function setupEventListeners() {
    elements.searchBtn.addEventListener('click', searchMedicines);
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchMedicines();
    });
}

// ===== Initialization =====
async function init() {
    setupEventListeners();
    await loadFilters();
    console.log('✅ Pill Tracer Public Search initialized successfully!');
}

// Start the application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
