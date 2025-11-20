// ========================================
// MAIN APPLICATION LOGIC
// ========================================

// API Configuration
const API_CONFIG = {
    apiUrl: "https://script.google.com/macros/s/AKfycbyGkHgRv34rmHt0_SpMuBJALDkhxz48F5QZbaBrG6JHB2QspLga_vJXhx6zpA-cueb8yQ/exec" // ⚠️ แก้ไข URL นี้ให้ตรงกับ Backend Web App URL
};

// Global state
let currentUser = null;
let currentPhaseInfo = null;
let charts = {};

// ========================================
// INITIALIZATION
// ========================================

firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    currentUser = user;
    document.getElementById('userEmail').textContent = user.email;
    
    // Set default dates
    setDefaultDates();
    
    // Populate year selectors
    if (typeof populateYearSelector === 'function') {
        populateYearSelector();
        populateCompareYearSelectors();
    }
    
    // Detect phases
    await detectPhases();
});

// ========================================
// TAB MANAGEMENT
// ========================================

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const tabName = this.getAttribute('data-tab');
        switchTab(tabName);
    });
});

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// ========================================
// LOGOUT
// ========================================

document.getElementById('logout-btn').addEventListener('click', async () => {
    await firebase.auth().signOut();
    window.location.href = 'index.html';
});

// ========================================
// PHASE DETECTION
// ========================================

async function detectPhases() {
    try {
        if (!currentUser) return;

        const token = await currentUser.getIdToken();
        const url = `${API_CONFIG.apiUrl}?action=detectPhases&token=${token}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            currentPhaseInfo = data;
            console.log('Phase info:', data);
            
            // Store phase info in localStorage for other scripts
            localStorage.setItem('phaseInfo', JSON.stringify(data));
        } else {
            console.error('Phase detection failed:', data.error);
            showAlert('error', 'ไม่สามารถตรวจสอบระบบได้: ' + data.error);
        }

    } catch (error) {
        console.error('Detect phases error:', error);
        showAlert('error', 'เกิดข้อผิดพลาด: ' + error.message);
    }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function setDefaultDates() {
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setDate(today.getDate() - 30);

    const todayStr = formatDate(today);
    const lastMonthStr = formatDate(lastMonth);

    // Set for all tabs
    ['tou', 'solar', 'email'].forEach(prefix => {
        const endDateEl = document.getElementById(`${prefix}-endDate`);
        const startDateEl = document.getElementById(`${prefix}-startDate`);
        
        if (endDateEl) endDateEl.value = todayStr;
        if (startDateEl) startDateEl.value = lastMonthStr;
    });
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showAlert(type, message) {
    const alertTypes = {
        success: 'alert-success',
        error: 'alert-error',
        info: 'alert-info'
    };

    const alertClass = alertTypes[type] || 'alert-info';
    
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${alertClass}`;
    alertDiv.textContent = message;
    
    // Insert at the top of active tab
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab) {
        activeTab.insertBefore(alertDiv, activeTab.firstChild);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }
}

function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>กำลังโหลดข้อมูล...</p>
            </div>
        `;
    }
}

function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        const loading = element.querySelector('.loading');
        if (loading) loading.remove();
    }
}

// ========================================
// CHART UTILITIES
// ========================================

function destroyChart(chartId) {
    if (charts[chartId]) {
        charts[chartId].destroy();
        delete charts[chartId];
    }
}

function createLineChart(canvasId, labels, datasets, title) {
    destroyChart(canvasId);
    
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: !!title,
                    text: title
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Energy (kWh)'
                    }
                }
            }
        }
    });
}

function createBarChart(canvasId, labels, datasets, title) {
    destroyChart(canvasId);
    
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: !!title,
                    text: title
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Value'
                    }
                }
            }
        }
    });
}

function createPieChart(canvasId, labels, data, title) {
    destroyChart(canvasId);
    
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    charts[canvasId] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF',
                    '#FF9F40'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: !!title,
                    text: title
                },
                legend: {
                    display: true,
                    position: 'right'
                }
            }
        }
    });
}

// ========================================
// API HELPER
// ========================================

async function callAPI(action, params = {}) {
    try {
        if (!currentUser) {
            throw new Error('ยังไม่ได้เข้าสู่ระบบ');
        }

        const token = await currentUser.getIdToken();
        
        // Build URL with parameters
        const urlParams = new URLSearchParams({
            action: action,
            token: token,
            ...params
        });
        
        const url = `${API_CONFIG.apiUrl}?${urlParams.toString()}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'เกิดข้อผิดพลาด');
        }
        
        return data;
        
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}

// ========================================
// EXPORT API CONFIG
// ========================================

window.API_CONFIG = API_CONFIG;
window.callAPI = callAPI;
window.showAlert = showAlert;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.createLineChart = createLineChart;
window.createBarChart = createBarChart;
window.createPieChart = createPieChart;
