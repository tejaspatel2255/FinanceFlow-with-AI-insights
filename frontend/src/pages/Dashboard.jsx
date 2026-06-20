import { useState } from "react";
import { useTransactions } from "../hooks/useTransactions";
import { useBudgets } from "../hooks/useBudgets";
import { useGoals } from "../hooks/useGoals";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  Loader2,
  Calendar,
  Smile,
  Activity,
  Target,
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
  const navigate = useNavigate();

  // Hooks to retrieve transactions & budgets & goals
  const { useGetTransactions } = useTransactions();
  const { useGetBudgets } = useBudgets();
  const { useGetGoals, useUpdateGoal } = useGoals();

  const { data: transactions = [], isLoading: isTxLoading } = useGetTransactions();
  const { data: budgets = [], isLoading: isBudgetsLoading } = useGetBudgets();
  const { data: goals = [], isLoading: isGoalsLoading } = useGetGoals();
  const updateMutation = useUpdateGoal();

  const [fundAmounts, setFundAmounts] = useState({});

  const handleAddFunds = (goal, e) => {
    e.preventDefault();
    e.stopPropagation();
    const amountStr = fundAmounts[goal.id];
    if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) === 0) return;

    const amount = parseFloat(amountStr);
    const newCurrentAmount = Math.max(0, Number(goal.current_amount) + amount);

    updateMutation.mutate(
      {
        id: goal.id,
        current_amount: newCurrentAmount,
      },
      {
        onSuccess: () => {
          setFundAmounts((prev) => ({ ...prev, [goal.id]: "" }));
        },
      }
    );
  };

  // Sort goals by percentage completed to show top 2 closest to completion
  const sortedGoals = [...goals]
    .map((g) => {
      const target = Number(g.target_amount);
      const current = Number(g.current_amount);
      const percentage = target > 0 ? (current / target) * 100 : 0;
      return { ...g, percentage };
    })
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 2);

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
    <div className="space-y-6 pb-12 text-foreground">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Dashboard</h1>
        <p className="text-muted-foreground font-body">Monitor your cashflow, budgets, and visual reports.</p>
      </div>

      {/* Analytics Metric Cards Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Total Balance */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm text-card-foreground">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground font-body">Total Net Balance</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold font-display">
              ₹{totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 font-body">All time net account value</p>
        </div>

        {/* Month Income */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm text-card-foreground">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground font-body">Income This Month</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-[hsl(var(--success))] font-display">
              +₹{thisMonthIncome.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center space-x-1 text-[11px] text-muted-foreground mt-2 font-body">
            <Calendar className="h-3.5 w-3.5" />
            <span>Current calendar month</span>
          </div>
        </div>

        {/* Month Expense */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm text-card-foreground">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground font-body">Expenses This Month</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <ArrowDownRight className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-destructive font-display">
              -₹{thisMonthExpense.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center space-x-1 text-[11px] text-muted-foreground mt-2 font-body">
            <Calendar className="h-3.5 w-3.5" />
            <span>Current calendar month</span>
          </div>
        </div>
      </div>

      {/* AISummary Section (Report grid + NLQ search hero) */}
      <AISummary transactions={transactions} />

      {/* Visual Analytics Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-3 text-card-foreground">
        
        {/* Chart 1: 6-Month Income vs Expense Area/Line Chart */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
          <div className="mb-4">
            <h3 className="font-bold text-foreground flex items-center space-x-1.5 font-display">
              <Activity className="h-4 w-4 text-primary" />
              <span>Cash Flow Analytics</span>
            </h3>
            <p className="text-xs text-muted-foreground font-body">Comparing income and expense metrics across the last 6 months</p>
          </div>

          <div className="h-72">
            {isTxLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground font-body">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading Chart...
              </div>
            ) : transactions.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={lineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="monthName"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontWeight: 600 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontWeight: 600 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    name="Income"
                    dataKey="Income"
                    stroke="hsl(var(--success))"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#incomeColor)"
                  />
                  <Area
                    type="monotone"
                    name="Expense"
                    dataKey="Expense"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#expenseColor)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground font-body">
                Log transactions to generate trend data.
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Category Breakdown Donut Chart */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="font-bold text-foreground font-display">Spending Breakdown</h3>
            <p className="text-xs text-muted-foreground font-body">Category allocation for the current month</p>
          </div>

          <div className="relative h-60 flex items-center justify-center">
            {/* Absolute Centered total label */}
            {totalMonthSpend > 0 && (
              <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-display">
                  Total Spent
                </span>
                <span className="text-xl font-black text-foreground font-display">
                  ₹{totalMonthSpend.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}

            {isTxLoading ? (
              <div className="text-sm text-muted-foreground flex items-center font-body">
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
              <div className="text-xs text-muted-foreground text-center px-4 font-body">
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
                  <div key={item.name} className="flex items-center space-x-1.5 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }}></span>
                    <span className="capitalize font-bold font-body">{item.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Budgets and Savings Goals Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Budgets (Col-span-2) */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm lg:col-span-2 flex flex-col justify-between text-card-foreground">
          <div>
            <div className="mb-4">
              <h3 className="font-bold text-foreground font-display">Active Budget Tracks</h3>
              <p className="text-xs text-muted-foreground font-body">Comparing real-time category limits (updated this month)</p>
            </div>

            {isBudgetsLoading || isTxLoading ? (
              <div className="flex items-center justify-center p-8 text-sm text-muted-foreground font-body">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading budgets...
              </div>
            ) : budgets.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {budgets.slice(0, 4).map((budget) => {
                  const spent = getCategorySpendingThisMonth(budget.category);
                  const limit = Number(budget.amount);
                  const percentage = limit > 0 ? (spent / limit) * 100 : 0;
                  const isOverBudget = spent > limit;

                  let progressColor = "bg-[hsl(var(--success))]";
                  let progressBg = "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]";
                  let statusLabel = "On Track";

                  if (percentage > 85) {
                    progressColor = "bg-destructive";
                    progressBg = "bg-destructive/10 text-destructive";
                    statusLabel = isOverBudget ? "Overrun" : "Critical";
                  } else if (percentage >= 60) {
                    progressColor = "bg-[hsl(var(--warning))]";
                    progressBg = "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]";
                    statusLabel = "Warning";
                  }

                  return (
                    <div
                      key={budget.id}
                      className={`rounded-xl border p-4 flex flex-col justify-between space-y-3 transition-all hover:shadow-sm ${
                        isOverBudget ? "border-destructive bg-destructive/5 text-destructive" : "border-border bg-card"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold capitalize text-foreground font-display">
                          {budget.category}
                        </span>
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${progressBg}`}>
                          {statusLabel}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${progressColor}`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          ></div>
                        </div>

                        <div className="flex justify-between text-[11px] text-muted-foreground font-medium font-body">
                          <span>₹{spent.toLocaleString("en-IN")} spent</span>
                          <span>of ₹{limit.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-secondary rounded-xl">
                <Smile className="h-8 w-8 text-muted-foreground mb-2" />
                <h4 className="text-sm font-bold text-foreground font-display">No active budgets found</h4>
                <p className="text-xs text-muted-foreground mt-0.5 font-body">
                  Set category spending caps to track limits.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Savings Goals Widget (Col-span-1) */}
        <div
          onClick={() => navigate("/goals")}
          className="rounded-xl border border-border bg-card p-6 shadow-sm cursor-pointer hover:border-primary/50 transition-all flex flex-col justify-between group text-card-foreground"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-foreground group-hover:text-primary transition-colors flex items-center space-x-1.5 font-display">
                  <Target className="h-4.5 w-4.5 text-primary" />
                  <span>Savings Goals</span>
                </h3>
                <p className="text-xs text-muted-foreground font-body">Goals closest to completion</p>
              </div>
            </div>

            {isGoalsLoading ? (
              <div className="flex h-40 items-center justify-center text-xs text-muted-foreground font-body">
                <Loader2 className="h-5 w-5 animate-spin mr-1.5" /> Loading goals...
              </div>
            ) : sortedGoals.length > 0 ? (
              <div className="space-y-5">
                {sortedGoals.map((goal) => {
                  const target = Number(goal.target_amount);
                  const current = Number(goal.current_amount);
                  const percentage = Math.min(goal.percentage || 0, 100);

                  return (
                    <div key={goal.id} className="space-y-2 border-b border-border/40 pb-3 last:border-0 last:pb-0">
                      <div className="space-y-1">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs font-bold text-foreground truncate max-w-[120px] font-display">{goal.name}</span>
                          <span className="text-[10px] font-bold text-primary font-body">{Math.round(percentage)}%</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-1.5 rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[9px] text-muted-foreground font-body">
                          <span>₹{current.toLocaleString("en-IN")} saved</span>
                          <span>of ₹{target.toLocaleString("en-IN")}</span>
                        </div>
                      </div>

                      {/* Inline Save/Withdraw Form */}
                      <form
                        onSubmit={(e) => handleAddFunds(goal, e)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex gap-2 pt-1"
                      >
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
                          <input
                            type="number"
                            placeholder="Amount"
                            value={fundAmounts[goal.id] || ""}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              setFundAmounts((prev) => ({
                                ...prev,
                                [goal.id]: e.target.value,
                              }));
                            }}
                            className="w-full pl-6 pr-2 py-1 rounded-lg border border-border bg-background text-foreground text-[10px] focus:outline-none focus:ring-2 focus:ring-primary/20 h-7 font-body"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={updateMutation.isPending}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-primary text-primary-foreground font-bold text-[10px] rounded-lg px-2.5 py-1 hover:opacity-90 transition-colors disabled:opacity-50 flex items-center justify-center h-7 shrink-0 font-body"
                        >
                          {updateMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : Number(fundAmounts[goal.id]) < 0 ? (
                            <span>Withdraw</span>
                          ) : (
                            <span>Save</span>
                          )}
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-secondary rounded-xl h-40">
                <Target className="h-8 w-8 text-muted-foreground mb-2" />
                <h4 className="text-xs font-bold text-foreground font-display">No active goals</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-body">
                  Click here to define your first savings milestone.
                </p>
              </div>
            )}
          </div>
          {sortedGoals.length > 0 && (
            <div className="text-[10px] font-bold text-primary group-hover:underline mt-4 self-end font-body">
              View All Goals →
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
