import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useBudgets } from "../hooks/useBudgets";
import { useTransactions } from "../hooks/useTransactions";
import { useTheme } from "../context/ThemeContext";
import { AlertCircle, PiggyBank, Plus, Trash2, Wallet } from "lucide-react";

// Form validation schema with Zod
const budgetSchema = z.object({
  category: z.string().min(1, "Category is required"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be a positive number",
    }),
  period: z.enum(["weekly", "monthly", "yearly"]),
});

const CATEGORIES = [
  "housing",
  "groceries",
  "utilities",
  "entertainment",
  "transportation",
  "insurance",
  "salary",
  "freelance",
  "investments",
  "other",
];

export default function Budgets() {
  const { homeCurrency } = useTheme();

  const getCurrencySymbol = (currency) => {
    const symbols = {
      INR: "₹",
      USD: "$",
      EUR: "€",
      GBP: "£",
      AED: "د.إ",
      JPY: "¥"
    };
    return symbols[currency] || "₹";
  };

  const currencySymbol = getCurrencySymbol(homeCurrency);

  const { useGetBudgets, useUpsertBudget, useDeleteBudget } = useBudgets();
  const { useGetTransactions } = useTransactions();

  const { data: budgets = [], isLoading: isBudgetsLoading } = useGetBudgets();
  const { data: transactions = [], isLoading: isTxLoading } = useGetTransactions();

  const upsertMutation = useUpsertBudget();
  const deleteMutation = useDeleteBudget();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      category: "groceries",
      amount: "",
      period: "monthly",
    },
  });

  const onSubmit = (data) => {
    upsertMutation.mutate(
      {
        category: data.category,
        amount: parseFloat(data.amount),
        period: data.period,
        start_date: new Date().toISOString().split("T")[0],
      },
      {
        onSuccess: () => {
          reset();
        },
      }
    );
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this budget?")) {
      deleteMutation.mutate(id);
    }
  };

  // Helper to calculate total spent in a category for the current calendar month (converted to Home Currency)
  const getCategorySpendingThisMonth = (category) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return transactions.reduce((total, tx) => {
      const txDate = new Date(tx.date);
      if (
        tx.type === "expense" &&
        tx.category.toLowerCase() === category.toLowerCase() &&
        txDate.getMonth() === currentMonth &&
        txDate.getFullYear() === currentYear
      ) {
        return total + (Number(tx.amount) * (tx.exchange_rate_to_home || 1.0));
      }
      return total;
    }, 0);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6 text-foreground">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Budgets</h1>
        <p className="text-muted-foreground font-body">Set limits on spending categories to maximize savings.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* BUDGET CREATION FORM */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm h-fit text-card-foreground">
          <h2 className="text-lg font-bold text-foreground mb-4 font-display">Set Category Budget</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground font-display">Category</label>
              <select
                {...register("category")}
                className="mt-1.5 block w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 capitalize font-body"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground font-display">Limit Amount ({currencySymbol})</label>
              <input
                type="text"
                placeholder="0.00"
                {...register("amount")}
                className={`mt-1.5 block w-full rounded-lg border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 font-body ${
                  errors.amount
                    ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                    : "border-border focus:border-primary focus:ring-primary/20"
                }`}
              />
              {errors.amount && (
                <p className="mt-1 text-xs text-destructive font-body">{errors.amount.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground font-display">Period</label>
              <select
                {...register("period")}
                className="mt-1.5 block w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-body"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={upsertMutation.isPending}
              className="flex w-full justify-center rounded-lg bg-primary py-2.5 px-4 text-sm font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50 font-body"
            >
              {upsertMutation.isPending ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></div>
              ) : (
                <span className="flex items-center space-x-1">
                  <Plus className="h-4 w-4" />
                  <span>Save Limit</span>
                </span>
              )}
            </button>
          </form>
        </div>

        {/* BUDGETS LIST GRID */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-foreground font-display">Active Budget Tracks</h2>

          {isBudgetsLoading || isTxLoading ? (
            <div className="flex flex-col items-center justify-center p-12 space-y-2 border border-border rounded-xl bg-card text-card-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="text-sm text-muted-foreground font-body">Loading active budgets...</p>
            </div>
          ) : budgets.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {budgets.map((budget) => {
                const spent = getCategorySpendingThisMonth(budget.category);
                const limit = Number(budget.amount);
                const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
                const isOverBudget = spent > limit;

                return (
                  <div
                    key={budget.id}
                    className={`rounded-xl border p-5 bg-card text-card-foreground shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${
                      isOverBudget ? "border-destructive/60 bg-destructive/5" : "border-border bg-card"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold capitalize text-foreground font-display">
                          {budget.category}
                        </span>
                        <span className="text-xs uppercase font-bold text-muted-foreground font-body">
                          {budget.period}
                        </span>
                      </div>

                      <div className="mt-3 flex items-baseline justify-between text-foreground">
                        <div>
                          <span className="text-2xl font-bold font-display">{currencySymbol}{spent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                          <span className="text-xs text-muted-foreground font-body"> spent</span>
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground font-body">
                          of {currencySymbol}{limit.toLocaleString("en-IN", { maximumFractionDigits: 0 })} limit
                        </span>
                      </div>

                      {/* Progress bar wrapper */}
                      <div className="mt-3 w-full bg-secondary rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            isOverBudget ? "bg-destructive" : "bg-primary"
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        {isOverBudget ? (
                          <div className="flex items-center space-x-1 text-xs font-bold text-destructive font-body">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>Over limit by {currencySymbol}{(spent - limit).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground font-body">
                            {Math.max(0, 100 - percentage)}% budget remaining
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleDelete(budget.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-border rounded-xl bg-card text-card-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                <Wallet className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground font-display">No Budget Caps</h3>
              <p className="mt-1 text-sm text-muted-foreground font-body">
                Set category limits in the left form to stay on track.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
