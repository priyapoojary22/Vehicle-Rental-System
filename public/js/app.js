// ============================================================================
// VELOCE ACADEMIC CONTROLLER
// ============================================================================

// App Global State
const state = {
  activeTab: 'dashboard',
  customers: [],
  vehicles: [],
  bookings: [],
  rentals: [],
  payments: [],
  maintenance: [],
  sqlLogs: [],
  academicQueries: [],
  selectedQueryId: 1,
  sort: {
    customers: { column: 'customer_id', direction: 'desc' },
    vehicles: { column: 'VehicleID', direction: 'desc' }
  }
};

// Global Chart References
let revenueChart = null;
let fleetChart = null;

const API_BASE = '/api';

// On Document Ready
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  setupNavigation();
  setupEventListeners();
  loadDashboardData();
  startSQLConsolePolling();
  loadAcademicQueriesList();
}

// ============================================================================
// CLIENT-SIDE ROUTING & NAVIGATION
// ============================================================================
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = item.getAttribute('data-tab');
      
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
      });
      document.getElementById(targetTab).classList.add('active');
      
      state.activeTab = targetTab;
      loadTabSpecificData(targetTab);
    });
  });

  if (window.location.hash) {
    const hashTab = window.location.hash.substring(1);
    const item = document.querySelector(`.nav-item[data-tab="${hashTab}"]`);
    if (item) item.click();
  }
}

function loadTabSpecificData(tab) {
  switch (tab) {
    case 'dashboard':
      loadDashboardData();
      break;
    case 'customers':
      fetchCustomers();
      break;
    case 'vehicles':
      fetchVehicles();
      break;
    case 'bookings':
      fetchBookings();
      break;
    case 'rentals':
      fetchRentals();
      break;
    case 'payments':
      fetchPayments();
      break;
    case 'maintenance':
      fetchMaintenance();
      break;
    case 'sql-queries':
      fetchSqlLogs();
      populateProcedureDropdowns();
      break;
  }
}

// ============================================================================
// EVENT LISTENERS & MODAL BINDINGS
// ============================================================================
function setupEventListeners() {
  // Global search
  document.getElementById('global-search').addEventListener('input', (e) => {
    filterAllTables(e.target.value);
  });

  // Customer search
  document.getElementById('customer-search-input').addEventListener('input', (e) => {
    fetchCustomers(e.target.value);
  });

  // Vehicles search
  document.getElementById('vehicle-search-input').addEventListener('input', () => {
    fetchVehicles();
  });
  document.getElementById('vehicle-status-filter').addEventListener('change', () => {
    fetchVehicles();
  });

  // Forms submit
  document.getElementById('customer-form').addEventListener('submit', handleCustomerSubmit);
  document.getElementById('vehicle-form').addEventListener('submit', handleVehicleSubmit);
  document.getElementById('booking-form').addEventListener('submit', handleBookingSubmit);
  document.getElementById('rental-form').addEventListener('submit', handleRentalSubmit);
  document.getElementById('payment-form').addEventListener('submit', handlePaymentSubmit);
  document.getElementById('maintenance-form').addEventListener('submit', handleMaintenanceSubmit);

  // Procedure Execution Forms
  document.getElementById('sp-charge-form').addEventListener('submit', handleCalculateChargeSP);
  document.getElementById('run-sp-report-btn').addEventListener('click', handleAvailabilityReportSP);

  // Academic Queries Selection click
  const queryBtns = document.querySelectorAll('.query-list-btn');
  queryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      queryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const qid = btn.getAttribute('data-qid');
      selectAcademicQuery(qid);
    });
  });

  document.getElementById('execute-academic-query-btn').addEventListener('click', runSelectedAcademicQuery);
  document.getElementById('clear-db-logs').addEventListener('click', clearSqlLogs);
}

// ============================================================================
// API INTEGRATION & DATA FETCHING
// ============================================================================

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? 
    `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>` :
    `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

async function loadDashboardData() {
  try {
    const res = await fetch(`${API_BASE}/dashboard`);
    const data = await res.json();

    document.getElementById('stat-customers').textContent = data.totalCustomers;
    document.getElementById('stat-vehicles').textContent = data.totalVehicles;
    document.getElementById('stat-available-vehicles').textContent = data.availableVehicles;
    document.getElementById('stat-active-rentals').textContent = data.activeRentals;
    document.getElementById('stat-completed-rentals').textContent = data.completedRentals;
    document.getElementById('stat-revenue').textContent = `₹${parseFloat(data.totalRevenue).toLocaleString('en-IN')}`;

    renderCharts(data.revenueHistory, data.vehicleTypeDistribution);
    fetchSqlLogs();
  } catch (err) {
    console.error('Error loading dashboard:', err);
    showToast('Failed to retrieve dashboard metrics.', 'error');
  }
}

// Customer List
async function fetchCustomers(search = '') {
  try {
    const res = await fetch(`${API_BASE}/customers?search=${search}`);
    state.customers = await res.json();
    renderCustomersTable();
    fetchSqlLogs();
  } catch (err) {
    showToast('Error fetching customer records.', 'error');
  }
}

function renderCustomersTable() {
  const tbody = document.getElementById('customers-table-body');
  tbody.innerHTML = '';

  if (state.customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No customers registered.</td></tr>`;
    return;
  }

  const sorted = sortData(state.customers, state.sort.customers);

  sorted.forEach(c => {
    tbody.innerHTML += `
      <tr>
        <td>#CUST-${c.customer_id}</td>
        <td><strong>${c.CustomerName}</strong></td>
        <td>${c.phone}</td>
        <td>${c.email}</td>
        <td><code>${c.LicenseNo}</code></td>
        <td class="action-buttons">
          <button class="btn btn-secondary btn-sm" onclick="openCustomerModal(${c.customer_id})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('customers', ${c.customer_id}, '${c.CustomerName}')">Delete</button>
        </td>
      </tr>
    `;
  });
}

// Vehicle List
async function fetchVehicles() {
  const search = document.getElementById('vehicle-search-input').value;
  const status = document.getElementById('vehicle-status-filter').value;
  try {
    const res = await fetch(`${API_BASE}/vehicles?search=${search}&status=${status}`);
    state.vehicles = await res.json();
    renderVehiclesTable();
    fetchSqlLogs();
  } catch (err) {
    showToast('Error loading fleet inventory.', 'error');
  }
}

function renderVehiclesTable() {
  const tbody = document.getElementById('vehicles-table-body');
  tbody.innerHTML = '';

  if (state.vehicles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No vehicles matching query.</td></tr>`;
    return;
  }

  const sorted = sortData(state.vehicles, state.sort.vehicles);

  sorted.forEach(v => {
    const statusClass = `badge-${v.Status.toLowerCase().replace(' ', '-')}`;
    const maintClass = v.MaintenanceStatus === 'Yes' ? 'badge-maintenance' : 'badge-available';
    tbody.innerHTML += `
      <tr>
        <td>#VEH-${v.VehicleID}</td>
        <td><strong>${v.VehicleModel}</strong></td>
        <td>${v.VehicleType}</td>
        <td>₹${parseFloat(v.RentalRate).toLocaleString('en-IN')}/day</td>
        <td><span class="badge ${statusClass}">${v.Status}</span></td>
        <td><span class="badge ${maintClass}">${v.MaintenanceStatus}</span></td>
        <td class="action-buttons">
          <button class="btn btn-secondary btn-sm" onclick="openVehicleModal(${v.VehicleID})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('vehicles', ${v.VehicleID}, '${v.VehicleModel}')">Delete</button>
        </td>
      </tr>
    `;
  });
}

// Bookings List
async function fetchBookings() {
  try {
    const res = await fetch(`${API_BASE}/bookings`);
    state.bookings = await res.json();
    renderBookingsTable();
    fetchSqlLogs();
  } catch (err) {
    showToast('Error loading reservations.', 'error');
  }
}

function renderBookingsTable() {
  const tbody = document.getElementById('bookings-table-body');
  tbody.innerHTML = '';

  if (state.bookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No reservations booked.</td></tr>`;
    return;
  }

  state.bookings.forEach(b => {
    const statusClass = `badge-${b.VehicleStatus.toLowerCase()}`;
    tbody.innerHTML += `
      <tr>
        <td>#BKG-${b.BookingID}</td>
        <td><strong>${b.CustomerName}</strong></td>
        <td>${b.VehicleModel} <br><small class="text-muted">Rate: ₹${b.RentalRate}/day</small></td>
        <td>${parseFloat(b.RentalRate).toLocaleString('en-IN')}</td>
        <td>${new Date(b.BookingDate).toLocaleDateString()}</td>
        <td><span class="badge ${statusClass}">${b.VehicleStatus}</span></td>
        <td class="action-buttons">
          <button class="btn btn-secondary btn-sm" onclick="quickCreateRental(${b.BookingID}, '${b.BookingDate}', ${b.RentalRate})">Start Rental</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('bookings', ${b.BookingID}, 'Booking #${b.BookingID}')">Cancel</button>
        </td>
      </tr>
    `;
  });
}

// Rentals List
async function fetchRentals() {
  try {
    const res = await fetch(`${API_BASE}/rentals`);
    state.rentals = await res.json();
    renderRentalsTable();
    fetchSqlLogs();
  } catch (err) {
    showToast('Error loading rentals database.', 'error');
  }
}

function renderRentalsTable() {
  const tbody = document.getElementById('rentals-table-body');
  tbody.innerHTML = '';

  if (state.rentals.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">No rentals recorded.</td></tr>`;
    return;
  }

  state.rentals.forEach(r => {
    tbody.innerHTML += `
      <tr>
        <td>#RNT-${r.RentalID}</td>
        <td>#BKG-${r.BookingID}</td>
        <td><strong>${r.CustomerName}</strong></td>
        <td>${r.VehicleModel}</td>
        <td>₹${parseFloat(r.RentalRate).toLocaleString('en-IN')}</td>
        <td>${new Date(r.StartDate).toLocaleDateString()}</td>
        <td>${new Date(r.EndDate).toLocaleDateString()}</td>
        <td><strong>₹${parseFloat(r.TotalAmount).toLocaleString('en-IN')}</strong></td>
        <td class="action-buttons">
          <button class="btn btn-secondary btn-sm" onclick="completeVehicleReturn(${r.RentalID})">Complete Return</button>
        </td>
      </tr>
    `;
  });
}

// Complete Return Drive
async function completeVehicleReturn(rentalId) {
  if (confirm('Complete return for this vehicle rental? (This sets status to Available)')) {
    try {
      const res = await fetch(`${API_BASE}/rentals/${rentalId}/return`, {
        method: 'POST'
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      showToast('Vehicle returned successfully. Status reset to Available.');
      fetchRentals();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}

// Payments List
async function fetchPayments() {
  try {
    const res = await fetch(`${API_BASE}/payments`);
    state.payments = await res.json();
    renderPaymentsTable();
    fetchSqlLogs();
  } catch (err) {
    showToast('Error loading payments history.', 'error');
  }
}

function renderPaymentsTable() {
  const tbody = document.getElementById('payments-table-body');
  tbody.innerHTML = '';

  if (state.payments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No payments recorded.</td></tr>`;
    return;
  }

  state.payments.forEach(p => {
    tbody.innerHTML += `
      <tr>
        <td>#PAY-${p.PaymentID}</td>
        <td>#RNT-${p.RentalID}</td>
        <td><strong>${p.CustomerName}</strong></td>
        <td>${p.VehicleModel}</td>
        <td><strong>₹${parseFloat(p.Amount).toLocaleString('en-IN')}</strong></td>
        <td>${new Date(p.PaymentDate).toLocaleDateString()}</td>
        <td><span class="badge badge-confirmed">${p.PaymentMethod}</span></td>
      </tr>
    `;
  });
}

// Maintenance List
async function fetchMaintenance() {
  try {
    const res = await fetch(`${API_BASE}/maintenance`);
    state.maintenance = await res.json();
    renderMaintenanceTable();
    fetchSqlLogs();
  } catch (err) {
    showToast('Error loading maintenance repairs.', 'error');
  }
}

function renderMaintenanceTable() {
  const tbody = document.getElementById('maintenance-table-body');
  tbody.innerHTML = '';

  if (state.maintenance.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No maintenance scheduled.</td></tr>`;
    return;
  }

  state.maintenance.forEach(m => {
    tbody.innerHTML += `
      <tr>
        <td>#MNT-${m.MaintenanceID}</td>
        <td><strong>${m.VehicleModel}</strong></td>
        <td>${new Date(m.MaintenanceDate).toLocaleDateString()}</td>
        <td>${m.Description}</td>
        <td><strong>₹${parseFloat(m.Cost).toLocaleString('en-IN')}</strong></td>
      </tr>
    `;
  });
}

// ============================================================================
// DATA SUBMISSION & ACTIONS HANDLERS
// ============================================================================

// Customer Submit
async function handleCustomerSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('cust-id').value;
  const payload = {
    CustomerName: document.getElementById('cust-name').value,
    phone: document.getElementById('cust-phone').value,
    email: document.getElementById('cust-email').value,
    LicenseNo: document.getElementById('cust-license').value
  };

  const url = id ? `${API_BASE}/customers/${id}` : `${API_BASE}/customers`;
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Server error');

    showToast(id ? 'Customer profile updated.' : 'New customer registered successfully!');
    closeCustomerModal();
    fetchCustomers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Vehicle Submit
async function handleVehicleSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('veh-id').value;
  const payload = {
    VehicleModel: document.getElementById('veh-model').value,
    VehicleType: document.getElementById('veh-type').value,
    RentalRate: parseFloat(document.getElementById('veh-rate').value),
    Status: document.getElementById('veh-status').value,
    MaintenanceStatus: document.getElementById('veh-maint').value
  };

  const url = id ? `${API_BASE}/vehicles/${id}` : `${API_BASE}/vehicles`;
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Server error');

    showToast(id ? 'Vehicle details updated successfully.' : 'Vehicle added to fleet.');
    closeVehicleModal();
    fetchVehicles();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Booking Submit (Trigger demo: prevent insert if MaintenanceStatus = Yes)
async function handleBookingSubmit(e) {
  e.preventDefault();
  const payload = {
    CustomerID: parseInt(document.getElementById('book-customer').value),
    VehicleID: parseInt(document.getElementById('book-vehicle').value),
    BookingDate: document.getElementById('book-date').value
  };

  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Server error');

    showToast('Booking reservation scheduled successfully (Vehicle status set to Rented via Trigger).');
    closeBookingModal();
    fetchBookings();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Rental Submit
async function handleRentalSubmit(e) {
  e.preventDefault();
  const payload = {
    BookingID: parseInt(document.getElementById('rental-booking').value),
    StartDate: document.getElementById('rental-start').value,
    EndDate: document.getElementById('rental-end').value,
    TotalAmount: parseFloat(document.getElementById('rental-amount').value)
  };

  try {
    const res = await fetch(`${API_BASE}/rentals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    showToast('Rental drive started successfully!');
    closeRentalModal();
    fetchRentals();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Payment Submit
async function handlePaymentSubmit(e) {
  e.preventDefault();
  const payload = {
    RentalID: parseInt(document.getElementById('pay-rental').value),
    Amount: parseFloat(document.getElementById('pay-amount').value),
    PaymentDate: document.getElementById('pay-date').value,
    PaymentMethod: document.getElementById('pay-method').value
  };

  try {
    const res = await fetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    showToast('Payment transaction recorded successfully.');
    closePaymentModal();
    fetchPayments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Maintenance Submit
async function handleMaintenanceSubmit(e) {
  e.preventDefault();
  const payload = {
    VehicleID: parseInt(document.getElementById('maint-vehicle').value),
    Description: document.getElementById('maint-desc').value,
    MaintenanceDate: document.getElementById('maint-date').value,
    Cost: parseFloat(document.getElementById('maint-cost').value)
  };

  try {
    const res = await fetch(`${API_BASE}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    showToast('Vehicle maintenance scheduled. Vehicle status updated.');
    closeMaintenanceModal();
    fetchMaintenance();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================================
// ACADEMIC STORED PROCEDURES SIMULATIONS
// ============================================================================

// SP 1: CalculateRentalCharge
async function handleCalculateChargeSP(e) {
  e.preventDefault();
  const vId = document.getElementById('sp-veh-select').value;
  const days = document.getElementById('sp-days-input').value;

  try {
    const res = await fetch(`${API_BASE}/procedures/calculate-charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ VehicleID: vId, Days: days })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    const outBox = document.getElementById('sp-charge-output');
    outBox.innerHTML = `
      <div style="color: var(--accent-cyan); font-weight: bold; margin-bottom: 8px;">PROCEDURE OUTPUT</div>
      <div><strong>Vehicle model:</strong> ${result.VehicleModel} (#${result.VehicleID})</div>
      <div><strong>Rental Rate:</strong> ₹${parseFloat(result.RentalRate).toLocaleString()}/day</div>
      <div><strong>Days:</strong> ${result.NumberOfDays}</div>
      <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 8px 0;">
      <div style="font-size: 1.05rem; color: #fff;"><strong>Total Charge:</strong> ₹${parseFloat(result.TotalRentalCharge).toLocaleString('en-IN')}</div>
    `;
    outBox.classList.remove('hide');
    fetchSqlLogs();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// SP 2: VehicleAvailabilityReport
async function handleAvailabilityReportSP() {
  try {
    const res = await fetch(`${API_BASE}/procedures/availability-report`);
    const rows = await res.json();
    if (!res.ok) throw new Error(rows.error);

    const outBox = document.getElementById('sp-report-output');
    const tbody = outBox.querySelector('tbody');
    tbody.innerHTML = '';

    rows.forEach(r => {
      const statusClass = r.Status === 'Available' ? 'avail-text' : 'rented-text';
      tbody.innerHTML += `
        <tr>
          <td>#${r.VehicleID}</td>
          <td>${r.VehicleModel}</td>
          <td>${r.VehicleType}</td>
          <td>₹${parseFloat(r.RentalRate).toLocaleString()}</td>
          <td class="${statusClass}"><strong>${r.Status}</strong></td>
        </tr>
      `;
    });

    outBox.classList.remove('hide');
    fetchSqlLogs();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================================
// ACADEMIC QUERY EXECUTOR
// ============================================================================
async function loadAcademicQueriesList() {
  try {
    const res = await fetch(`${API_BASE}/academic-queries`);
    state.academicQueries = await res.json();
    
    // Bind query buttons
    const queryBtns = document.querySelectorAll('.query-list-btn');
    queryBtns.forEach(btn => {
      btn.onclick = () => {
        queryBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const qid = parseInt(btn.getAttribute('data-qid'));
        selectAcademicQuery(qid);
      };
    });

    selectAcademicQuery(1);
  } catch (err) {
    console.error('Error loading academic queries list', err);
  }
}

function selectAcademicQuery(qid) {
  state.selectedQueryId = qid;
  const q = state.academicQueries.find(item => parseInt(item.id) === qid);
  if (!q) return;

  document.getElementById('active-query-title').textContent = `Query ${q.id}: ${q.description}`;
  document.getElementById('active-query-desc').textContent = `Run this predefined SQL analysis query to inspect database records.`;
  document.getElementById('active-query-sql').textContent = q.sql;
  
  // Hide results
  document.getElementById('query-results-container').classList.add('hide');
}

async function runSelectedAcademicQuery() {
  const qid = state.selectedQueryId;
  const container = document.getElementById('query-results-container');
  const table = document.getElementById('query-results-table');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  thead.innerHTML = '';
  tbody.innerHTML = '';

  try {
    const res = await fetch(`${API_BASE}/academic-queries/${qid}`, {
      method: 'POST'
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    container.classList.remove('hide');

    if (result.length === 0) {
      thead.innerHTML = '<tr><th>Result</th></tr>';
      tbody.innerHTML = '<tr><td class="text-muted">Query executed successfully, but returned 0 rows.</td></tr>';
      return;
    }

    const headers = Object.keys(result[0]);
    let headerHtml = '<tr>';
    headers.forEach(h => {
      headerHtml += `<th>${h}</th>`;
    });
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;

    result.forEach(row => {
      let rowHtml = '<tr>';
      headers.forEach(h => {
        rowHtml += `<td>${row[h] !== null ? row[h] : '<span class="text-muted">NULL</span>'}</td>`;
      });
      rowHtml += '</tr>';
      tbody.innerHTML += rowHtml;
    });

    showToast(`Query ${qid} executed successfully!`);
    fetchSqlLogs();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================================
// DELETE VERIFICATION CONFIRMATION WINDOW
// ============================================================================
let deleteContext = null;

function confirmDelete(table, id, displayName) {
  deleteContext = { table, id };
  document.getElementById('confirm-message').textContent = `Are you absolutely sure you want to remove "${displayName}" from the ${table} list?`;
  document.getElementById('confirm-modal').classList.add('active');
  
  const confirmBtn = document.getElementById('confirm-action-btn');
  confirmBtn.onclick = executeDeletion;
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').classList.remove('active');
  deleteContext = null;
}

async function executeDeletion() {
  if (!deleteContext) return;
  const { table, id } = deleteContext;
  
  try {
    const res = await fetch(`${API_BASE}/${table}/${id}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Deletion failed');
    
    showToast('Record removed successfully.');
    closeConfirmModal();
    loadTabSpecificData(state.activeTab);
  } catch (err) {
    showToast(err.message, 'error');
    closeConfirmModal();
  }
}

// ============================================================================
// MODAL CONTROLS & DROPDOWN SEEDERS
// ============================================================================

function openCustomerModal(id = null) {
  const modal = document.getElementById('customer-modal');
  const title = document.getElementById('customer-modal-title');
  const form = document.getElementById('customer-form');
  form.reset();

  if (id) {
    title.textContent = 'Edit Customer Details';
    const c = state.customers.find(item => item.customer_id === id);
    if (c) {
      document.getElementById('cust-id').value = c.customer_id;
      document.getElementById('cust-name').value = c.CustomerName;
      document.getElementById('cust-phone').value = c.phone;
      document.getElementById('cust-email').value = c.email;
      document.getElementById('cust-license').value = c.LicenseNo;
    }
  } else {
    title.textContent = 'Register New Customer';
    document.getElementById('cust-id').value = '';
  }
  modal.classList.add('active');
}

function closeCustomerModal() {
  document.getElementById('customer-modal').classList.remove('active');
}

function openVehicleModal(id = null) {
  const modal = document.getElementById('vehicle-modal');
  const title = document.getElementById('vehicle-modal-title');
  const form = document.getElementById('vehicle-form');
  form.reset();

  if (id) {
    title.textContent = 'Edit Vehicle Information';
    const v = state.vehicles.find(item => item.VehicleID === id);
    if (v) {
      document.getElementById('veh-id').value = v.VehicleID;
      document.getElementById('veh-model').value = v.VehicleModel;
      document.getElementById('veh-type').value = v.VehicleType;
      document.getElementById('veh-rate').value = v.RentalRate;
      document.getElementById('veh-status').value = v.Status;
      document.getElementById('veh-maint').value = v.MaintenanceStatus;
    }
  } else {
    title.textContent = 'Add Vehicle';
    document.getElementById('veh-id').value = '';
    document.getElementById('veh-status').value = 'Available';
    document.getElementById('veh-maint').value = 'No';
  }
  modal.classList.add('active');
}

function closeVehicleModal() {
  document.getElementById('vehicle-modal').classList.remove('active');
}

async function openBookingModal() {
  const modal = document.getElementById('booking-modal');
  document.getElementById('booking-form').reset();

  const custSelect = document.getElementById('book-customer');
  const vehSelect = document.getElementById('book-vehicle');
  custSelect.innerHTML = '<option value="">-- Choose Customer --</option>';
  vehSelect.innerHTML = '<option value="">-- Choose Vehicle --</option>';

  try {
    const [custRes, vehRes] = await Promise.all([
      fetch(`${API_BASE}/customers`),
      fetch(`${API_BASE}/vehicles`)
    ]);

    const customers = await custRes.json();
    const vehicles = await vehRes.json();

    customers.forEach(c => {
      custSelect.innerHTML += `<option value="${c.customer_id}">${c.CustomerName} (#${c.customer_id})</option>`;
    });

    vehicles.forEach(v => {
      // Allow selecting all for booking demo (to test prevention on maintenance vehicle)
      const maintTag = v.MaintenanceStatus === 'Yes' ? ' [UNDER MAINTENANCE]' : '';
      vehSelect.innerHTML += `<option value="${v.VehicleID}">${v.VehicleModel} - ₹${v.RentalRate}/day${maintTag} (${v.Status})</option>`;
    });
  } catch (err) {
    console.error(err);
  }

  modal.classList.add('active');
}

function closeBookingModal() {
  document.getElementById('booking-modal').classList.remove('active');
}

async function openRentalModal() {
  const modal = document.getElementById('rental-modal');
  document.getElementById('rental-form').reset();

  const bookingSelect = document.getElementById('rental-booking');
  bookingSelect.innerHTML = '<option value="">-- Choose Booking ID --</option>';

  try {
    const res = await fetch(`${API_BASE}/bookings`);
    const bookings = await res.json();

    bookings.forEach(b => {
      bookingSelect.innerHTML += `
        <option value="${b.BookingID}" data-rate="${b.RentalRate}">Booking #${b.BookingID} - ${b.CustomerName} (${b.VehicleModel})</option>
      `;
    });

    // Auto compute total cost on date change
    const startInput = document.getElementById('rental-start');
    const endInput = document.getElementById('rental-end');
    const amountInput = document.getElementById('rental-amount');

    const updateAmount = () => {
      const selected = bookingSelect.options[bookingSelect.selectedIndex];
      if (!selected || !selected.value || !startInput.value || !endInput.value) {
        amountInput.value = '';
        return;
      }
      const rate = parseFloat(selected.getAttribute('data-rate'));
      const start = new Date(startInput.value);
      const end = new Date(endInput.value);
      const diff = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
      amountInput.value = diff * rate;
    };

    bookingSelect.onchange = updateAmount;
    startInput.onchange = updateAmount;
    endInput.onchange = updateAmount;

  } catch (err) {
    console.error(err);
  }

  modal.classList.add('active');
}

function closeRentalModal() {
  document.getElementById('rental-modal').classList.remove('active');
}

async function quickCreateRental(bookingId, bookingDate, rentalRate) {
  openRentalModal();
  setTimeout(() => {
    const select = document.getElementById('rental-booking');
    select.value = bookingId;
    document.getElementById('rental-start').value = bookingDate;
    
    // Set End date to 4 days later by default
    const start = new Date(bookingDate);
    const end = new Date(start.getTime() + 86400000 * 4);
    document.getElementById('rental-end').value = end.toISOString().split('T')[0];

    // Force compute
    const event = new Event('change');
    select.dispatchEvent(event);
  }, 300);
}

async function openPaymentModal() {
  const modal = document.getElementById('payment-modal');
  document.getElementById('payment-form').reset();

  const rentalSelect = document.getElementById('pay-rental');
  rentalSelect.innerHTML = '<option value="">-- Choose Rental --</option>';

  try {
    const res = await fetch(`${API_BASE}/rentals`);
    const rentals = await res.json();

    rentals.forEach(r => {
      rentalSelect.innerHTML += `
        <option value="${r.RentalID}" data-amount="${r.TotalAmount}">Rental #${r.RentalID} - ${r.CustomerName} (₹${r.TotalAmount})</option>
      `;
    });

    rentalSelect.onchange = () => {
      const selected = rentalSelect.options[rentalSelect.selectedIndex];
      if (selected && selected.value) {
        document.getElementById('pay-amount').value = selected.getAttribute('data-amount');
      } else {
        document.getElementById('pay-amount').value = '';
      }
    };
  } catch (err) {
    console.error(err);
  }

  modal.classList.add('active');
}

function closePaymentModal() {
  document.getElementById('payment-modal').classList.remove('active');
}

async function openMaintenanceModal() {
  const modal = document.getElementById('maintenance-modal');
  document.getElementById('maintenance-form').reset();

  const maintVehSelect = document.getElementById('maint-vehicle');
  maintVehSelect.innerHTML = '<option value="">-- Choose Vehicle --</option>';

  try {
    const res = await fetch(`${API_BASE}/vehicles`);
    const vehicles = await res.json();
    
    vehicles.forEach(v => {
      maintVehSelect.innerHTML += `
        <option value="${v.VehicleID}">${v.VehicleModel} (#${v.VehicleID})</option>
      `;
    });
  } catch (err) {
    console.error(err);
  }

  modal.classList.add('active');
}

function closeMaintenanceModal() {
  document.getElementById('maintenance-modal').classList.remove('active');
}

// Populate Academic SP dropdowns
async function populateProcedureDropdowns() {
  const spVehSelect = document.getElementById('sp-veh-select');
  if (!spVehSelect) return;
  spVehSelect.innerHTML = '';

  try {
    const res = await fetch(`${API_BASE}/vehicles`);
    const vehicles = await res.json();
    vehicles.forEach(v => {
      spVehSelect.innerHTML += `<option value="${v.VehicleID}">${v.VehicleModel} (Rate: ₹${v.RentalRate})</option>`;
    });
  } catch (err) {
    console.error(err);
  }
}

// ============================================================================
// SQL CONSOLE POLLING
// ============================================================================
let logPoller = null;
let lastLogCount = 0;

function startSQLConsolePolling() {
  fetchSqlLogs();
  logPoller = setInterval(fetchSqlLogs, 3000);
}

async function fetchSqlLogs() {
  try {
    const res = await fetch(`${API_BASE}/sql-logs`);
    const logs = await res.json();
    state.sqlLogs = logs;

    const consoleDiv = document.getElementById('sql-logs-console');
    if (!consoleDiv) return;

    if (logs.length === 0) {
      consoleDiv.innerHTML = '<span class="console-line text-muted">Listening for SQL transactions...</span>';
      lastLogCount = 0;
      return;
    }

    if (logs.length === lastLogCount) return;
    lastLogCount = logs.length;

    consoleDiv.innerHTML = '';
    logs.forEach(log => {
      const timeSpan = `<span class="console-time">[${log.timestamp}]</span>`;
      const contextSpan = log.context ? `<span class="console-context">${log.context}:</span>` : '';
      const textSpan = `<span class="console-text">${formatSqlCode(log.sql)}</span>`;
      
      consoleDiv.innerHTML += `
        <div class="console-line">
          ${timeSpan} ${contextSpan} ${textSpan}
        </div>
      `;
    });

    consoleDiv.scrollTop = consoleDiv.scrollHeight;
  } catch (err) {
    console.error(err);
  }
}

async function clearSqlLogs() {
  try {
    await fetch(`${API_BASE}/sql-logs/clear`, { method: 'POST' });
    showToast('SQL Transaction console logs cleared.');
    fetchSqlLogs();
  } catch (err) {
    console.error(err);
  }
}

function formatSqlCode(sql) {
  const keywords = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'TRIGGER', 'PROCEDURE', 
    'FROM', 'WHERE', 'JOIN', 'ON', 'VALUES', 'SET', 'BEGIN', 'END', 'AFTER',
    'IF', 'THEN', 'ELSE', 'CALL', 'DATABASE', 'INTO', 'CASCADE', 'CONFLICT', 'REPLACE',
    'GROUP BY', 'HAVING', 'ORDER BY', 'ASC', 'DESC', 'RAISE', 'BEFORE'
  ];
  
  let formatted = sql;
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    formatted = formatted.replace(regex, `<strong style="color: #60a5fa;">${keyword}</strong>`);
  });
  return formatted;
}

// ============================================================================
// DATA FILTERING & CLIENT-SIDE SORTING UTILITIES
// ============================================================================

function filterAllTables(query) {
  const lowerQuery = query.toLowerCase().trim();
  const activeSection = document.getElementById(state.activeTab);
  if (!activeSection) return;

  const rows = activeSection.querySelectorAll('table tbody tr');
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    if (text.includes(lowerQuery)) {
      row.classList.remove('hide');
    } else {
      row.classList.add('hide');
    }
  });
}

function sortTable(table, column) {
  if (!state.sort[table]) return;
  const current = state.sort[table];
  
  if (current.column === column) {
    current.direction = current.direction === 'asc' ? 'desc' : 'asc';
  } else {
    current.column = column;
    current.direction = 'asc';
  }

  const activeSection = document.getElementById(state.activeTab);
  const headers = activeSection.querySelectorAll('th.sortable');
  headers.forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.getAttribute('onclick').includes(`'${column}'`)) {
      th.classList.add(current.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });

  if (table === 'customers') renderCustomersTable();
  else if (table === 'vehicles') renderVehiclesTable();
}

function sortData(arr, sortConfig) {
  const { column, direction } = sortConfig;
  return [...arr].sort((a, b) => {
    let valA = a[column];
    let valB = b[column];
    
    if (!isNaN(valA) && !isNaN(valB)) {
      valA = parseFloat(valA);
      valB = parseFloat(valB);
    } else {
      valA = valA.toString().toLowerCase();
      valB = valB.toString().toLowerCase();
    }

    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

// ============================================================================
// CHART.JS ANALYTICS
// ============================================================================
function renderCharts(revenueData, compositionData) {
  const revCtx = document.getElementById('revenueChart');
  if (revCtx) {
    const months = revenueData.map(r => {
      const parts = r.month.split('-');
      const date = new Date(parts[0], parts[1] - 1);
      return date.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
    });
    const revenues = revenueData.map(r => r.total);

    if (revenueChart) revenueChart.destroy();
    
    revenueChart = new Chart(revCtx, {
      type: 'line',
      data: {
        labels: months.length > 0 ? months : ['No Data'],
        datasets: [{
          label: 'Payments Total (INR)',
          data: revenues.length > 0 ? revenues : [0],
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.15)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#06b6d4'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(75, 85, 99, 0.1)' }, ticks: { color: '#9ca3af' } },
          y: { grid: { color: 'rgba(75, 85, 99, 0.1)' }, ticks: { color: '#9ca3af' } }
        }
      }
    });
  }

  const fleetCtx = document.getElementById('fleetChart');
  if (fleetCtx) {
    const types = compositionData.map(c => c.type);
    const counts = compositionData.map(c => c.count);

    if (fleetChart) fleetChart.destroy();

    fleetChart = new Chart(fleetCtx, {
      type: 'doughnut',
      data: {
        labels: types.length > 0 ? types : ['No Vehicles'],
        datasets: [{
          data: counts.length > 0 ? counts : [1],
          backgroundColor: ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans' } }
          }
        }
      }
    });
  }
}
