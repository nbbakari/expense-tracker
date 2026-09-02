/* =========================================================
   Personal Expense Tracker — application logic
   ---------------------------------------------------------
   1.  Config & constants
   2.  State + localStorage (persistence)
   3.  Small helper functions
   4.  Filtering / sorting  (search, chips, amount sort)
   5.  Rendering            (summary cards, table, empty state)
   6.  Charts               (Chart.js donut + bar)
   7.  Modal: add / edit / delete
   8.  Event wiring + start-up
   ========================================================= */

/* ---------------------------------------------------------
   1. CONFIG & CONSTANTS
   --------------------------------------------------------- */

// Key used inside localStorage. Change it and you start with a fresh dataset.
const STORAGE_KEY = 'expenseTracker.expenses';

// Change these two values to use a different currency (e.g. 'RWF', 'EUR').
const LOCALE = 'en-US';
const CURRENCY = 'USD';

// Single source of truth for categories: used by the chips, the dropdown,
// the table pills and the chart colours. Add a category here and it appears everywhere.
const CATEGORIES = [
  { name: 'Food',           icon: '🍔', color: '#FF7F50' },
  { name: 'Transportation', icon: '🚗', color: '#4C1D95' },
  { name: 'Shopping',       icon: '🛍️', color: '#8B5CF6' },
  { name: 'Entertainment',  icon: '🎬', color: '#EC4899' },
  { name: 'Utilities',      icon: '💡', color: '#F59E0B' },
  { name: 'Education',      icon: '📚', color: '#0EA5E9' },
  { name: 'Other',          icon: '📦', color: '#64748B' },
];

// Quick lookup: category name -> { name, icon, color }
const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.name, c]));

/* ---------------------------------------------------------
   2. STATE + LOCALSTORAGE
   --------------------------------------------------------- */

// The full list of expenses. Each item: { id, description, amount, category, date }
let expenses = [];

// What the user is currently filtering / sorting by (UI state, not persisted).
let activeCategory = 'All';                 // 'All' or a category name
let searchTerm = '';                        // text typed in the search bar
let sort = { key: 'date', dir: 'desc' };    // key: 'date' | 'amount'

// Chart.js instances, created once and then updated in place.
let donutChart = null;
let barChart = null;

/** Read the saved expenses out of localStorage (safe against corrupt data). */
function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Could not read saved expenses:', err);
    return [];
  }
}

/** Write the current expenses back to localStorage so they survive a refresh. */
function saveExpenses() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  } catch (err) {
    console.warn('Could not save expenses:', err);
  }
}

/* ---------------------------------------------------------
   3. HELPERS
   --------------------------------------------------------- */

const $ = (id) => document.getElementById(id);

/** 1234.5 -> "$1,234.50" */
function formatMoney(value) {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

/** "2026-09-02" -> "Sep 2, 2026"  (built from parts so the timezone can't shift the day) */
function formatDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(LOCALE, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/** Today's date as "YYYY-MM-DD" (the format <input type="date"> expects). */
function todayISO() {
  const t = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

/** Escape user text before putting it into innerHTML (keeps the table safe). */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

/** Unique id for each expense. */
function makeId() {
  return (crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

/** Turn a hex colour into a soft translucent version, used for the pill backgrounds. */
function tint(hex, alpha = 0.14) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ---------------------------------------------------------
   4. FILTERING & SORTING
   --------------------------------------------------------- */

/**
 * The list that everything on screen is based on:
 * category chip + search box applied, then sorted.
 * Summary cards, charts and the table all read from this — that is
 * why filtering one thing instantly updates all three.
 */
function getVisibleExpenses() {
  const term = searchTerm.trim().toLowerCase();

  const filtered = expenses.filter((e) => {
    const matchesCategory = activeCategory === 'All' || e.category === activeCategory;
    const matchesSearch = !term || e.description.toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  });

  // Sort by the active column, then flip the result for descending order.
  filtered.sort((a, b) => {
    let cmp;
    if (sort.key === 'amount') {
      cmp = a.amount - b.amount;
    } else {
      cmp = a.date.localeCompare(b.date);       // ISO dates compare correctly as text
    }
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  return filtered;
}

/* ---------------------------------------------------------
   5. RENDERING
   --------------------------------------------------------- */

/** Master render: called after every change so the whole UI stays in sync. */
function render() {
  const visible = getVisibleExpenses();
  renderSummary(visible);
  renderTable(visible);
  updateCharts(visible);
  $('sortIcon').textContent = sort.key === 'amount' ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅';
  $('tableCount').textContent = `${visible.length} shown`;
}

/** Total spending / number of expenses / average expense cards. */
function renderSummary(list) {
  const total = list.reduce((sum, e) => sum + e.amount, 0);
  const count = list.length;
  const average = count ? total / count : 0;

  $('statTotal').textContent = formatMoney(total);
  $('statCount').textContent = count;
  $('statAverage').textContent = formatMoney(average);

  // Small hint under each number tells the user whether a filter is active.
  const scope = (activeCategory === 'All' && !searchTerm.trim())
    ? 'All time'
    : 'Filtered view';
  $('statTotalHint').textContent = scope;
  $('statCountHint').textContent = count === 1 ? 'record' : 'records';
  $('statAverageHint').textContent = 'per expense';
}

/** Build the table rows (or show the empty state when there is nothing to show). */
function renderTable(list) {
  const body = $('expenseBody');
  const empty = $('emptyState');
  const table = $('expenseTable');

  if (list.length === 0) {
    body.innerHTML = '';
    table.hidden = true;
    empty.hidden = false;

    // Different wording for "no data at all" vs "nothing matched the filter".
    if (expenses.length === 0) {
      $('emptyTitle').textContent = 'No expenses yet';
      $('emptyText').textContent = 'Tap “+ Add Expense” to record your first one.';
    } else {
      $('emptyTitle').textContent = 'No matching expenses';
      $('emptyText').textContent = 'Try another category or clear the search box.';
    }
    return;
  }

  table.hidden = false;
  empty.hidden = true;

  body.innerHTML = list.map((e) => {
    const cat = CATEGORY_MAP[e.category] || CATEGORY_MAP.Other;
    return `
      <tr>
        <td class="cell-desc">${escapeHtml(e.description)}</td>
        <td>
          <span class="pill" style="background:${tint(cat.color)}; color:${cat.color};">
            <span aria-hidden="true">${cat.icon}</span>${escapeHtml(cat.name)}
          </span>
        </td>
        <td class="cell-date">${formatDate(e.date)}</td>
        <td class="cell-amount">${formatMoney(e.amount)}</td>
        <td class="cell-actions">
          <button class="icon-btn" data-action="edit" data-id="${e.id}" title="Edit" aria-label="Edit expense">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button class="icon-btn danger" data-action="delete" data-id="${e.id}" title="Delete" aria-label="Delete expense">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18" /><path d="M8 6V4h8v2" />
              <path d="M6 6l1 14h10l1-14" /><path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </td>
      </tr>`;
  }).join('');
}

/* ---------------------------------------------------------
   6. CHARTS (Chart.js)
   --------------------------------------------------------- */

/** Sum the visible expenses per category — the data both charts share. */
function totalsByCategory(list) {
  const totals = new Map();
  list.forEach((e) => totals.set(e.category, (totals.get(e.category) || 0) + e.amount));

  // Keep the order of the CATEGORIES list, and drop categories with no spending.
  return CATEGORIES
    .filter((c) => totals.get(c.name) > 0)
    .map((c) => ({ label: c.name, value: totals.get(c.name), color: c.color, icon: c.icon }));
}

/**
 * Custom Chart.js plugin: writes the total amount in the middle of the donut.
 * `chart.$centerText` is set by updateCharts() before each redraw.
 */
const centerTextPlugin = {
  id: 'centerText',
  afterDatasetsDraw(chart) {
    const text = chart.$centerText;
    if (!text) return;

    const { ctx, chartArea } = chart;
    const x = (chartArea.left + chartArea.right) / 2;
    const y = (chartArea.top + chartArea.bottom) / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#6B7280';
    ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('TOTAL', x, y - 16);

    ctx.fillStyle = '#4C1D95';
    ctx.font = '800 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(text, x, y + 8);

    ctx.restore();
  },
};

/** Create both charts once, on page load. */
function initCharts() {
  const donutCtx = $('donutChart').getContext('2d');
  const barCtx = $('barChart').getContext('2d');

  donutChart = new Chart(donutCtx, {
    type: 'doughnut',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderColor: '#fff', borderWidth: 3, hoverOffset: 8 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',                      // the hole that makes it a donut
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 14 } },
        tooltip: {
          callbacks: {
            label: (c) => ` ${c.label}: ${formatMoney(c.parsed)}`,
          },
        },
      },
    },
    plugins: [centerTextPlugin],
  });

  barChart = new Chart(barCtx, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Spent', data: [], backgroundColor: [], borderRadius: 8, maxBarThickness: 46 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${formatMoney(c.parsed.y)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6B7280' } },
        y: {
          beginAtZero: true,
          grid: { color: '#F1F2F4' },
          border: { display: false },
          ticks: { color: '#6B7280', callback: (v) => formatMoney(v) },
        },
      },
    },
  });
}

/** Push the current (filtered) numbers into both charts. */
function updateCharts(list) {
  if (!donutChart || !barChart) return;

  const data = totalsByCategory(list);
  const total = list.reduce((sum, e) => sum + e.amount, 0);
  const hasData = data.length > 0;

  // Donut — when there is no data we draw one grey placeholder ring.
  donutChart.data.labels = hasData ? data.map((d) => `${d.icon} ${d.label}`) : ['No data'];
  donutChart.data.datasets[0].data = hasData ? data.map((d) => d.value) : [1];
  donutChart.data.datasets[0].backgroundColor = hasData ? data.map((d) => d.color) : ['#E5E7EB'];
  donutChart.options.plugins.tooltip.enabled = hasData;
  donutChart.$centerText = formatMoney(total);
  donutChart.update();

  // Bar chart
  barChart.data.labels = data.map((d) => d.label);
  barChart.data.datasets[0].data = data.map((d) => d.value);
  barChart.data.datasets[0].backgroundColor = data.map((d) => d.color);
  barChart.update();
}

/* ---------------------------------------------------------
   7. MODAL: ADD / EDIT / DELETE
   --------------------------------------------------------- */

/**
 * Open the modal. Pass an expense to edit it, or nothing to add a new one.
 */
function openModal(expense = null) {
  const overlay = $('modalOverlay');

  $('formError').hidden = true;
  $('modalTitle').textContent = expense ? 'Edit Expense' : 'Add Expense';
  $('saveBtn').textContent = expense ? 'Save Changes' : 'Save Expense';

  $('expenseId').value = expense ? expense.id : '';
  $('descInput').value = expense ? expense.description : '';
  $('amountInput').value = expense ? expense.amount : '';
  $('categoryInput').value = expense ? expense.category : CATEGORIES[0].name;
  $('dateInput').value = expense ? expense.date : todayISO();

  overlay.hidden = false;
  $('descInput').focus();
}

function closeModal() {
  $('modalOverlay').hidden = true;
  $('expenseForm').reset();
}

/** Validate the form, then create or update an expense and re-render. */
function handleSubmit(event) {
  event.preventDefault();

  const id = $('expenseId').value;
  const description = $('descInput').value.trim();
  const amount = parseFloat($('amountInput').value);
  const category = $('categoryInput').value;
  const date = $('dateInput').value;
  const error = $('formError');

  // --- simple validation ---
  if (!description) return showError('Please enter a description.');
  if (!Number.isFinite(amount) || amount <= 0) return showError('Please enter an amount greater than 0.');
  if (!date) return showError('Please pick a date.');
  error.hidden = true;

  if (id) {
    // EDIT: replace the matching record
    expenses = expenses.map((e) =>
      e.id === id ? { ...e, description, amount, category, date } : e
    );
  } else {
    // ADD: push a brand new record
    expenses.push({ id: makeId(), description, amount, category, date });
  }

  saveExpenses();   // persistence
  render();         // summary + charts + table all refresh
  closeModal();

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
  }
}

/** Delete one expense (with a confirmation so nothing disappears by accident). */
function deleteExpense(id) {
  const target = expenses.find((e) => e.id === id);
  if (!target) return;

  const ok = confirm(`Delete “${target.description}” (${formatMoney(target.amount)})?`);
  if (!ok) return;

  expenses = expenses.filter((e) => e.id !== id);
  saveExpenses();
  render();
}

/* ---------------------------------------------------------
   8. BUILD UI PIECES + EVENT WIRING
   --------------------------------------------------------- */

/** Build the filter chips ("All" + one per category) from the CATEGORIES list. */
function buildChips() {
  const row = $('chipRow');
  const items = [{ name: 'All', icon: '' }, ...CATEGORIES];

  row.innerHTML = items.map((c) => `
    <button type="button" class="chip ${c.name === activeCategory ? 'active' : ''}" data-category="${c.name}">
      ${c.icon ? c.icon + ' ' : ''}${c.name}
    </button>`).join('');
}

/** Fill the category dropdown inside the modal. */
function buildCategoryOptions() {
  $('categoryInput').innerHTML = CATEGORIES
    .map((c) => `<option value="${c.name}">${c.icon} ${c.name}</option>`)
    .join('');
}

function wireEvents() {
  // --- Floating action button opens an empty modal ---
  $('addBtn').addEventListener('click', () => openModal());

  // --- Modal close paths: X, Cancel, click outside, Escape key ---
  $('closeModal').addEventListener('click', closeModal);
  $('cancelBtn').addEventListener('click', closeModal);
  $('modalOverlay').addEventListener('click', (e) => {
    if (e.target === $('modalOverlay')) closeModal();   // only when the backdrop itself is clicked
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('modalOverlay').hidden) closeModal();
  });

  // --- Form submit handles both "add" and "edit" ---
  $('expenseForm').addEventListener('submit', handleSubmit);

  // --- Search: filters by description as you type ---
  $('searchInput').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    render();
  });

  // --- Category chips (one listener on the row: event delegation) ---
  $('chipRow').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;

    activeCategory = chip.dataset.category;
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
    render();
  });

  // --- Amount column header toggles ascending / descending ---
  $('sortAmount').addEventListener('click', () => {
    if (sort.key === 'amount') {
      sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';   // toggle
    } else {
      sort = { key: 'amount', dir: 'desc' };            // first click: highest first
    }
    render();
  });

  // --- Edit / delete buttons inside the table (delegated to the tbody) ---
  $('expenseBody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const { action, id } = btn.dataset;
    if (action === 'edit') {
      const expense = expenses.find((x) => x.id === id);
      if (expense) openModal(expense);
    } else if (action === 'delete') {
      deleteExpense(id);
    }
  });
}

/* ---------------------------------------------------------
   START-UP
   --------------------------------------------------------- */
function init() {
  expenses = loadExpenses();   // restore whatever was saved last time
  buildChips();
  buildCategoryOptions();
  initCharts();
  wireEvents();
  render();
}

init();
