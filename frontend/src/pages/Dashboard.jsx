import { useTransactions } from "../hooks/useTransactions";
import { useBudgets } from "../hooks/useBudgets";
import {
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  Loader2,
  Calendar,
  Smile,
  Activity,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Import custom AI Insights and NLQ panels
import AISummary from "../components/dashboard/AISummary";

// Category palette mapping (Slate & Indigo custom palette)
const CATEGORY_COLORS = {
  housing: "#6366f1",        // Indigo
  groceries: "#0d9488",      // Teal
  utilities: "#3b82f6",      // Blue
  entertainment: "#ec4899",  // Pink
  transportation: "#f59e0b",  // Amber
  insurance: "#8b5cf6",      // Purple
  salary: "#10b981",         // Emerald
  freelance: "#14b8a6",      // Cyan
  investments: "#06b6d4",    // Light Blue
  other: "#64748b",          // Slate
};

const FALLBACK_COLORS = ["#6366f1", "#0d9488", "#3b82f6", "#ec4899", "#f59e0b", "#8b5cf6", "#10b981", "#64748b"];

// Custom-styled tooltip to match the premium design language
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg font-sans">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          {payload[0].name || payload[0].dataKey}
        </p>
        <div className="space-y-1">
          {payload.map((item) => (
            <div key={item.name || item.dataKey} className="flex items-center space-x-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color || item.payload.fill || "#6366f1" }}
              ></span>
              <span className="text-xs font-semibold text-slate-600 capitalize">
                {item.name || item.dataKey}:
              </span>
              <span className="text-xs font-extrabold text-slate-900">
                ₹{Number(item.value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  // Hooks to retrieve transactions & budgets
  const { useGetTransactions } = useTransactions();
  const { useGetBudgets } = useBudgets();

  const { data: transactions = [], isLoading: isTxLoading } = useGetTransactions();
  const { data: budgets = [], isLoading: isBudgetsLoading } = useGetBudgets();

  // 1. Calculate General Balance Metrics
  const totalBalance = transactions.reduce((acc, tx) => {
    return tx.type === "income" ? acc + Number(tx.amount) : acc - Number(tx.amount);
  }, 0);

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth(); // 0-11
  const currentYear = currentDate.getFullYear();

  const thisMonthIncome = transactions.reduce((acc, tx) => {
    const txDate = new Date(tx.date);
    if (
      tx.type === "income" &&
      txDate.getMonth() === currentMonth &&
      txDate.getFullYear() === currentYear
    ) {
      return acc + Number(tx.amount);
    }
    return acc;
  }, 0);

  const thisMonthExpense = transactions.reduce((acc, tx) => {
    const txDate = new Date(tx.date);
    if (
      tx.type === "expense" &&
      txDate.getMonth() === currentMonth &&
      txDate.getFullYear() === currentYear
    ) {
      return acc + Number(tx.amount);
    }
    return acc;
  }, 0);

  // 2. Spending by Category (Current month data for Donut Chart)
  const currentMonthExpenses = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    return (
      tx.type === "expense" &&
      txDate.getMonth() === currentMonth &&
      txDate.getFullYear() === currentYear
    );
  });

  const categoryAggregation = {};
  currentMonthExpenses.forEach((tx) => {
    const cat = tx.category.toLowerCase();
    categoryAggregation[cat] = (categoryAggregation[cat] || 0) + Number(tx.amount);
  });

  const donutChartData = Object.entries(categoryAggregation).map(([name, value]) => ({
    name,
    value,
  }));

  // Total Month Spend in Center of Donut
  const totalMonthSpend = donutChartData.reduce((sum, item) => sum + item.value, 0);

  // 3. Last 6 Months Income vs Expense Calculations
  const getLast6MonthsData = () => {
    const data = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth();
      const y = d.getFullYear();

      let incomeSum = 0;
      let expenseSum = 0;

      transactions.forEach((tx) => {
        const txDate = new Date(tx.date);
        if (txDate.getMonth() === m && txDate.getFullYear() === y) {
          if (tx.type === "income") {
            incomeSum += Number(tx.amount);
          } else if (tx.type === "expense") {
            expenseSum += Number(tx.amount);
          }
        }
      });

      data.push({
        monthName: `${monthNames[m]} ${y.toString().slice(-2)}`,
        Income: incomeSum,
        Expense: expenseSum,
      });
    }
    return data;
  };

  const lineChartData = getLast6MonthsData();

  // 4. Budget Spending Progress calculator
  const getCategorySpendingThisMonth = (category) => {
    return transactions.reduce((total, tx) => {
      const txDate = new Date(tx.date);
      if (
        tx.type === "expense" &&
        tx.category.toLowerCase() === category.toLowerCase() &&
        txDate.getMonth() === currentMonth &&
        txDate.getFullYear() === currentYear
      ) {
        return total + Number(tx.amount);
      }
      return total;
    }, 0);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Monitor your cashflow, budgets, and visual reports.</p>
      </div>

      {/* Analytics Metric Cards Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Total Balance */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Total Net Balance</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-slate-900">
              ₹{totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">All time net account value</p>
        </div>

        {/* Month Income */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Income This Month</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-emerald-600">
              +₹{thisMonthIncome.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center space-x-1 text-[11px] text-slate-400 mt-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>Current calendar month</span>
          </div>
        </div>

        {/* Month Expense */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Expenses This Month</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <ArrowDownRight className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-rose-600">
              -₹{thisMonthExpense.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center space-x-1 text-[11px] text-slate-400 mt-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>Current calendar month</span>
          </div>
        </div>
      </div>

      {/* AISummary Section (Report grid + NLQ search hero) */}
      <AISummary transactions={transactions} />

      {/* Visual Analytics Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Chart 1: 6-Month Income vs Expense Area/Line Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4">
            <h3 className="font-bold text-slate-900 flex items-center space-x-1.5">
              <Activity className="h-4 w-4 text-primary" />
              <span>Cash Flow Analytics</span>
            </h3>
            <p className="text-xs text-slate-400">Comparing income and expense metrics across the last 6 months</p>
          </div>

          <div className="h-72">
            {isTxLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading Chart...
              </div>
            ) : transactions.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={lineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="monthName"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 500 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 500 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    name="Income"
                    dataKey="Income"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#incomeColor)"
                  />
                  <Area
                    type="monotone"
                    name="Expense"
                    dataKey="Expense"
                    stroke="#ef4444"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#expenseColor)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Log transactions to generate trend data.
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Category Breakdown Donut Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="font-bold text-slate-900">Spending Breakdown</h3>
            <p className="text-xs text-slate-400">Category allocation for the current month</p>
          </div>

          <div className="relative h-60 flex items-center justify-center">
            {/* Absolute Centered total label */}
            {totalMonthSpend > 0 && (
              <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Total Spent
                </span>
                <span className="text-xl font-black text-slate-900">
                  ₹{totalMonthSpend.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}

            {isTxLoading ? (
              <div className="text-sm text-slate-400 flex items-center">
                <Loader2 className="h-5 w-5 animate-spin mr-1.5" /> Loading...
              </div>
            ) : donutChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomTooltip />} />
                  <Pie
                    data={donutChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutChartData.map((entry, index) => {
                      const color = CATEGORY_COLORS[entry.name.toLowerCase()] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400 text-center px-4">
                No expense logs recorded in {new Date().toLocaleString("default", { month: "long" })}.
              </div>
            )}
          </div>

          {/* Quick legend color list */}
          {donutChartData.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 justify-center max-h-20 overflow-y-auto pr-1">
              {donutChartData.map((item, idx) => {
                const color = CATEGORY_COLORS[item.name.toLowerCase()] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                return (
                  <div key={item.name} className="flex items-center space-x-1.5 text-xs text-slate-500">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }}></span>
                    <span className="capitalize font-medium">{item.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Budget Progress Meters */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="font-bold text-slate-900">Active Budget Tracks</h3>
          <p className="text-xs text-slate-400">Comparing real-time category limits (updated this month)</p>
        </div>

        {isBudgetsLoading || isTxLoading ? (
          <div className="flex items-center justify-center p-8 text-sm text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading budgets...
          </div>
        ) : budgets.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {budgets.map((budget) => {
              const spent = getCategorySpendingThisMonth(budget.category);
              const limit = Number(budget.amount);
              const percentage = limit > 0 ? (spent / limit) * 100 : 0;
              const isOverBudget = spent > limit;

              let progressColor = "bg-emerald-500";
              let progressBg = "bg-emerald-50";
              let statusLabel = "On Track";
              let textClass = "text-emerald-700";

              if (percentage > 85) {
                progressColor = "bg-rose-500";
                progressBg = "bg-rose-50";
                statusLabel = isOverBudget ? "Budget Overrun" : "Critical Alert";
                textClass = "text-rose-700";
              } else if (percentage >= 60) {
                progressColor = "bg-amber-500";
                progressBg = "bg-amber-50";
                statusLabel = "Warning";
                textClass = "text-amber-700";
              }

              return (
                <div
                  key={budget.id}
                  className={`rounded-xl border p-4 flex flex-col justify-between space-y-3 transition-all hover:shadow-sm ${
                    isOverBudget ? "border-rose-200 bg-rose-50/20" : "border-slate-100"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold capitalize text-slate-700">
                      {budget.category}
                    </span>
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${progressBg} ${textClass}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${progressColor}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between text-xs text-slate-500 font-medium">
                      <span>₹{spent.toLocaleString("en-IN", { maximumFractionDigits: 0 })} spent</span>
                      <span>of ₹{limit.toLocaleString("en-IN", { maximumFractionDigits: 0 })} limit</span>
                    </div>
                  </div>

                  <div className="text-[10px] font-semibold text-slate-400 flex items-center justify-between pt-1">
                    <span>Target: {budget.period}</span>
                    <span>{percentage.toFixed(0)}% utilized</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-xl">
            <Smile className="h-8 w-8 text-slate-400 mb-2" />
            <h4 className="text-sm font-semibold text-slate-700">No active budgets found</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Navigate to the Budgets page to establish category spending caps.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
