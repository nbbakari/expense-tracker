# 💸 Personal Expense Tracker

A single-page expense tracking dashboard built with **vanilla HTML, CSS and JavaScript** — no frameworks, no build step, no server. Add expenses, see them summarised in charts, filter and sort them, and everything stays saved in your browser.

![Vanilla JS](https://img.shields.io/badge/JavaScript-vanilla-FF7F50) ![No build step](https://img.shields.io/badge/build-none-4C1D95) ![Chart.js](https://img.shields.io/badge/Chart.js-4.4-8B5CF6)

---

## 🚀 Getting started

1. Download or clone this folder.
2. Double-click **`index.html`** — it opens in your browser and runs.

That's it. There is nothing to install and nothing to compile.

> **Note:** Chart.js is loaded from a CDN, so you need an internet connection the first time you open the page. Everything else (including your data) works fully offline.

**Optional — run it on a local server** (nicer URLs, avoids any `file://` quirks):

```bash
# Python 3
python3 -m http.server 8000

# or Node
npx serve .
```

Then visit <http://localhost:8000>.

---

## ✨ Features

| Feature | What it does |
| --- | --- |
| **Add expenses** | The floating "+ Add Expense" button opens a modal for description, amount, category and date |
| **Edit / Delete** | Every table row has edit and delete actions; deleting asks for confirmation first |
| **Live summaries** | Total Spending, Number of Expenses and Average Expense update instantly |
| **Two charts** | A donut chart (spending by category, with the total in the centre) and a bar chart (category breakdown) |
| **Search** | Filters by description as you type |
| **Category filters** | Chips for All, Food 🍔, Transportation 🚗, Shopping 🛍️, Entertainment 🎬, Utilities 💡, Education 📚, Other 📦 |
| **Sorting** | Click the **Amount** column header to toggle ascending / descending |
| **Persistence** | Everything is saved to `localStorage`, so your data survives a refresh |
| **Empty state** | A friendly message when there are no expenses — and a different one when a filter matches nothing |
| **Responsive** | Three-column layout on desktop collapses to one column on phones |

---

## 📁 Project structure

```
expense-tracker/
├── index.html    # Structure: header, summary cards, charts, filters, table, modal
├── style.css     # All styling and the colour palette
├── script.js     # All logic (state, storage, rendering, charts, events)
└── README.md     # You are here
```

The three files are kept strictly separate — no inline styles, no inline `<script>` blocks.

---

## 🎨 Colour palette

| Role | Colour | Hex |
| --- | --- | --- |
| Primary | Deep Purple | `#4C1D95` |
| Accent | Vibrant Coral | `#FF7F50` |
| Background | Off-white | `#F3F4F6` |
| Cards | White | `#FFFFFF` |
| Body text | Charcoal | `#1F2937` |
| Muted text | Grey | `#6B7280` |

All colours are CSS custom properties declared once in `:root` at the top of `style.css`, so changing the theme means editing a handful of lines.

---

## 🧠 How the code works

`script.js` is split into eight commented sections:

1. **Config & constants** — storage key, currency, and the `CATEGORIES` list
2. **State + localStorage** — `loadExpenses()` / `saveExpenses()`
3. **Helpers** — money and date formatting, id generation, HTML escaping
4. **Filtering & sorting** — `getVisibleExpenses()`
5. **Rendering** — `renderSummary()`, `renderTable()`
6. **Charts** — `initCharts()`, `updateCharts()`
7. **Modal** — `openModal()`, `handleSubmit()`, `deleteExpense()`
8. **Event wiring + start-up** — `wireEvents()`, `init()`

### One source of truth

`getVisibleExpenses()` applies the active category chip, the search text and the sort order, and returns one array. The summary cards, both charts and the table **all** read from that same array — which is why clicking a chip updates everything at once instead of just the table.

```js
function render() {
  const visible = getVisibleExpenses();
  renderSummary(visible);
  renderTable(visible);
  updateCharts(visible);
}
```

### Data shape

Each expense is a plain object stored in one array:

```js
{
  id: "8c1f...",              // unique id
  description: "Lunch at campus café",
  amount: 12.5,               // number, always > 0
  category: "Food",           // must match a name in CATEGORIES
  date: "2026-09-02"          // ISO format, sorts correctly as a string
}
```

The whole array is saved as JSON under the key `expenseTracker.expenses`.

### Techniques worth pointing out

- **Event delegation** — one click listener on the chip row and one on the table body, instead of re-binding listeners to every row on each render.
- **Charts are created once** — `initCharts()` runs at start-up; `updateCharts()` only swaps the numbers, so the charts animate smoothly instead of flickering.
- **Custom Chart.js plugin** — `centerTextPlugin` draws the total amount in the middle of the donut.
- **`escapeHtml()`** — user text is escaped before it reaches `innerHTML`, so typing `<script>` into the description renders as harmless text.
- **Safe storage reads** — `loadExpenses()` is wrapped in `try/catch`, so corrupt or blocked storage returns an empty list instead of crashing the page.

---

## 🛠️ Customising

**Change the currency** — edit the two constants near the top of `script.js`:

```js
const LOCALE = 'en-US';
const CURRENCY = 'USD';   // try 'RWF', 'EUR', 'GBP', 'KES' …
```

**Add a category** — add one entry to `CATEGORIES` in `script.js` and it automatically appears in the filter chips, the modal dropdown, the table pills and both charts:

```js
{ name: 'Health', icon: '💊', color: '#10B981' },
```

**Change the theme** — edit the variables in `:root` at the top of `style.css`.

---

## ❓ Troubleshooting

| Problem | Fix |
| --- | --- |
| Charts don't appear | Check your internet connection — Chart.js comes from a CDN. Open DevTools → Console to confirm. |
| Data disappeared | Private/incognito windows clear `localStorage` when closed. Data is also per-browser and per-device. |
| Nothing shows in the table | A category chip or search term may be filtering everything out — click **All** and clear the search box. |

**To reset all data**, open DevTools → Console and run:

```js
localStorage.removeItem('expenseTracker.expenses'); location.reload();
```

---

## 🔮 Possible extensions

- Monthly view with a date-range filter
- Export to CSV
- Budget limits with a warning when a category goes over
- Dark mode (the CSS variables make this straightforward)

---

## 📌 Privacy

Your data is saved locally in your browser. Nothing is uploaded, and there is no backend or account.
