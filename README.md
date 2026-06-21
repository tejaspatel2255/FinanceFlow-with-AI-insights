# FinanceFlow 💰 — AI-Powered Personal Finance Dashboard

FinanceFlow is a state-of-the-art personal finance tracker built with a Node.js Express backend and a React/Vite frontend. It securely handles user finances in Indian Rupees (`₹`) using a Supabase database (with strict RLS policies), provides interactive cashflow analytics, and features an integrated AI-Engine connected to OpenRouter for natural language queries and financial summaries with multi-model failover chains.

---

## ✨ Key Features

*   **🎨 Multi-Theme Appearance System**: Choose from 5 premium color themes ("Original", "Midnight Ledger", "Sage Paper", "Terminal", "Coral Bloom") and a unified Light/Dark mode toggle. Settings persist instantly across devices through Supabase synchronization and local storage fallback, loaded via an anti-flash inline script.
*   **🔄 Custom Recurring Schedules**: Supports standard billing intervals (Weekly, Monthly, Yearly) along with a "Custom (days)" option allowing users to specify any repeat interval (e.g., 28, 45, 90 days). The billing engine automatically calculates the next due date and displays the countdown inside the upcoming payments tracker.
*   **⚡ AI Quick Add (Natural Language)**: Parse complex natural language inputs describing multiple transactions in a single sentence (e.g., *"spent 500 on icecream and earned 1000 by making a project"*) to automatically record expenses and income concurrently with precise categorization and error diagnostics.
*   **📅 Chronological Default Sorting**: Transactions lists default to ordering by `date DESC, created_at DESC` ensuring predictable, chronological sorting and reliable tie-breaking for multiple entries on the same day.
*   **🎯 Savings Goals Tracker**: Set financial targets with specific deadlines. View interactive progress tracking, save funds directly to individual goals, and get real-time AI-engine forecasts showing if you are on track or behind.
*   **📥 CSV Bulk Importer**: Import your statements in bulk with drag-and-drop. Auto-detect columns, validate transaction values against Zod schema rules, and review parsing logs before batch-submitting.
*   **✨ AI Auto-Categorization**: Automatically classify new transaction entries based on descriptions using Gemini. It includes an in-memory session cache to optimize API requests and handles bulk classification during CSV imports.
*   **📊 Interactive Dashboard**: Monitor net balance, monthly income, and expense metrics in real-time. Responsive area and donut charts render category allocations and 6-month trends.
*   **🤖 OpenRouter Multi-Model Fallback Chain**: If a request to the primary AI model fails or times out, the backend automatically retries the next model in sequence:
    1.  `google/gemini-2.0-flash-001` (Primary)
    2.  `google/gemini-flash-1.5` (Secondary)
    3.  `meta-llama/llama-3.3-70b-instruct:free` (Tertiary)
    4.  `qwen/qwen-2.5-72b-instruct:free` (Quaternary)
    5.  `openrouter/free` (Auto-routing)
*   **💬 Natural Language Query (NLQ) Hero**: Search and ask questions about your cash flow in plain English (e.g., *"How much did I spend on groceries this month?"*). Responses feature custom typewriter reveal animations.
*   **📑 Branded Statement Exports**: Download PDF balance sheets containing aggregated monthly totals, category breakdowns, and top transaction tables in your selected home currency.
*   **⚡ Smart AI Insights Caching**: Financial pattern audits are cached inside Supabase for 24 hours. The cache tracks and validates the user's home currency, automatically invalidating when the active currency changes (e.g., INR to USD) to guarantee correct symbol rendering, and supports a manual cache bypass / force refresh parameter.
*   **📱 Mobile-First Layout**: Adaptive UI utilizing collapsible sidebars on desktop and a sticky bottom navigation bar on mobile viewports.

---

## 🛠️ Tech Stack

*   **Frontend**: React, Vite, Tailwind CSS, Recharts, TanStack Query, React Hook Form, Zod, jsPDF, PapaParse, Lucide Icons.
*   **Backend**: Node.js, Express, Cors, Morgan, Dotenv.
*   **Database & Auth**: Supabase (PostgreSQL + Supabase Auth).
*   **AI Engine**: OpenRouter Client (Gemini 2.0 Flash / Gemini 1.5 Flash / Llama 3.3 / Qwen 2.5).

---

## 📂 Project Structure

```text
FinanceFlow/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── supabase.js         # Supabase client backend setup
│   │   ├── lib/
│   │   │   └── openrouter.js       # OpenRouter client with failover & 20s timeouts
│   │   ├── middleware/
│   │   │   └── auth.js             # Supabase JWT authentication verifier
│   │   └── index.js                # Express API router (Rate-limiting & caching)
│   ├── .env.example                # Backend configuration template
│   └── package.json                # Node dependencies and launch scripts
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   │   └── AISummary.jsx   # AI insights grids & NLQ chat box
│   │   │   ├── transactions/
│   │   │   │   └── CSVImportModal.jsx # Drag-and-drop CSV parser with Zod validation
│   │   │   └── layout/
│   │   │       ├── AppLayout.jsx   # Page wrapper managing responsive views
│   │   │       ├── Navbar.jsx      # Top header swatch picker & mode toggle
│   │   │       ├── Sidebar.jsx     # Desktop left navigation
│   │   │       └── MobileNav.jsx   # Mobile bottom sticky navigation bar
│   │   ├── context/
│   │   │   ├── AuthContext.jsx     # Global authentication provider
│   │   │   └── ThemeContext.jsx    # Theme preference manager & Supabase state syncing
│   │   ├── hooks/
│   │   │   ├── useBudgets.js       # State updates for budgets
│   │   │   ├── useGoals.js         # State updates for goals
│   │   │   └── useTransactions.js  # State updates for transactions
│   │   ├── pages/
│   │   │   ├── Login.jsx           # Account login page
│   │   │   ├── SignUp.jsx          # Registration form
│   │   │   ├── Dashboard.jsx       # Analytics graphs, stats, and budget progress
│   │   │   ├── Transactions.jsx    # Segmented table lists & PDF statement exports
│   │   │   ├── Budgets.jsx         # Category budget targets
│   │   │   ├── Goals.jsx           # Savings Goals page (Forms, progress tracking, forecasts)
│   │   │   └── Settings.jsx        # Live preview appearance & theme customizer
│   │   ├── styles/
│   │   │   └── themes.css          # CSS custom properties defining palettes & font-pairings
│   │   └── App.jsx                 # Routes map
│   ├── tailwind.config.js          # Tailwind styling tokens
│   └── vite.config.js              # Vite bundler options
└── supabase/
    └── schema.sql                  # PostgreSQL Tables, Indexes, RLS Policies & User Settings
```

---

## 🚀 Local Installation & Setup

### Prerequisites
*   Node.js (v18 or higher)
*   NPM
*   A free Supabase account
*   A free OpenRouter account

### Step 1: Clone the Repo & Setup the Database
1.  Log in to your **Supabase Dashboard** and create a new project.
2.  Open the **SQL Editor** in your Supabase project.
3.  Copy and paste the contents of `supabase/schema.sql` into the SQL Editor and click **Run**. This creates the `transactions`, `budgets`, `goals`, `ai_insights`, and `user_settings` tables, sets up performance indexes, and enables RLS security.

### Step 2: Configure Backend Environment Variables
Navigate to the `backend/` folder and create a `.env` file:
```env
PORT=5000
NODE_ENV=development

# Found in Supabase -> Project Settings -> API
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Get your key from https://openrouter.ai/
OPENROUTER_API_KEY=your-openrouter-key-here
```

### Step 3: Configure Frontend Environment Variables
Navigate to the `frontend/` folder and create a `.env` file:
```env
# Found in Supabase -> Project Settings -> API
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here

# Local Backend Port URL
VITE_API_URL=http://localhost:5000/api
```

### Step 4: Install Dependencies & Run
Open two terminal panels:

*   **Terminal 1 (Backend)**:
    ```bash
    cd backend
    npm install
    npm run dev
    ```
*   **Terminal 2 (Frontend)**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

Open `http://localhost:5173` in your browser.

---

## 🌐 Production Deployment Guide

### Deploying the Backend (API) on Render
1.  Go to [Render.com](https://render.com) and click **New + -> Web Service**.
2.  Connect your GitHub repository.
3.  Configure the service details:
    *   **Root Directory**: `backend`
    *   **Build Command**: `npm install`
    *   **Start Command**: `npm start`
4.  Under the **Environment** tab, add your environment variables (`PORT`, `NODE_ENV`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`).
5.  Deploy. Render will provide a live API URL like `https://financeflow-api.onrender.com`.

### Deploying the Frontend on Vercel
1.  Go to [Vercel.com](https://vercel.com) and click **Add New -> Project**.
2.  Connect your GitHub repository.
3.  Configure the project details:
    *   **Framework Preset**: `Vite`
    *   **Root Directory**: `frontend`
4.  Under **Environment Variables**, add:
    *   `VITE_SUPABASE_URL` = Your Supabase Project URL
    *   `VITE_SUPABASE_ANON_KEY` = Your Supabase Anon Key
    *   `VITE_API_URL` = `https://your-backend-api-url.onrender.com/api` (The Render URL from the previous step)
5.  Click **Deploy**. Vercel will build the frontend files and host them on a fast edge CDN.
