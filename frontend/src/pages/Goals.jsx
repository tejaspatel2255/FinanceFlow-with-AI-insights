import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGoals } from "../hooks/useGoals";
import { useTheme } from "../context/ThemeContext";
import { Target, Calendar, Plus, Trash2, Loader2 } from "lucide-react";

// Form validation schema with Zod
const goalSchema = z.object({
  name: z.string().min(1, "Goal name is required").max(100, "Goal name is too long"),
  target_amount: z
    .string()
    .min(1, "Target amount is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Target amount must be a positive number",
    }),
  deadline: z
    .string()
    .min(1, "Deadline date is required")
    .refine(
      (val) => {
        const parts = val.split("-");
        if (parts.length !== 3) return false;
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const selectedDate = new Date(year, month, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return selectedDate >= today;
      },
      {
        message: "Deadline must be today or a future date",
      }
    ),
});

export default function Goals() {
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

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const currencySymbol = getCurrencySymbol(homeCurrency);

  const { useGetGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } = useGoals();
  const { data: goals = [], isLoading: isGoalsLoading } = useGetGoals();

  const createMutation = useCreateGoal();
  const updateMutation = useUpdateGoal();
  const deleteMutation = useDeleteGoal();

  const [fundAmounts, setFundAmounts] = useState({});

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: "",
      target_amount: "",
      deadline: "",
    },
  });

  const onSubmit = (data) => {
    createMutation.mutate(
      {
        name: data.name,
        target_amount: parseFloat(data.target_amount),
        current_amount: 0,
        deadline: data.deadline,
      },
      {
        onSuccess: () => {
          reset();
        },
      }
    );
  };

  const handleAddFunds = (goal, e) => {
    e.preventDefault();
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

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this savings goal?")) {
      deleteMutation.mutate(id);
    }
  };

  const getDaysLeft = (deadline) => {
    if (!deadline) return "No deadline";
    const diffTime = new Date(deadline) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "Overdue";
    if (diffDays === 0) return "Today";
    return `${diffDays} days left`;
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6 text-foreground">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Savings Goals</h1>
        <p className="text-muted-foreground font-body">Track and forecast your progress toward major milestones.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ADD GOAL FORM */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm h-fit text-card-foreground">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center space-x-2 font-display">
            <Target className="h-5 w-5 text-primary" />
            <span>Create New Goal</span>
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground font-display">Goal Name</label>
              <input
                type="text"
                placeholder="e.g. Goa Trip, New Laptop"
                {...register("name")}
                className={`mt-1.5 block w-full rounded-lg border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 font-body ${
                  errors.name
                    ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                    : "border-border focus:border-primary focus:ring-primary/20"
                }`}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-destructive font-body">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground font-display">Target Amount ({currencySymbol})</label>
              <input
                type="text"
                placeholder="0.00"
                {...register("target_amount")}
                className={`mt-1.5 block w-full rounded-lg border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 font-body ${
                  errors.target_amount
                    ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                    : "border-border focus:border-primary focus:ring-primary/20"
                }`}
              />
              {errors.target_amount && (
                <p className="mt-1 text-xs text-destructive font-body">{errors.target_amount.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground font-display">Deadline</label>
              <input
                type="date"
                min={getTodayString()}
                {...register("deadline")}
                className={`mt-1.5 block w-full rounded-lg border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 font-body ${
                  errors.deadline
                    ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                    : "border-border focus:border-primary focus:ring-primary/20"
                }`}
              />
              {errors.deadline && (
                <p className="mt-1 text-xs text-destructive font-body">{errors.deadline.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex w-full justify-center rounded-lg bg-primary py-2.5 px-4 text-sm font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50 font-body"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" />
              ) : (
                <span className="flex items-center space-x-1">
                  <Plus className="h-4 w-4" />
                  <span>Add Goal</span>
                </span>
              )}
            </button>
          </form>
        </div>

        {/* GOALS GRID */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-foreground font-display">Your Savings Progress</h2>

          {isGoalsLoading ? (
            <div className="flex flex-col items-center justify-center p-12 space-y-2 border border-border rounded-xl bg-card text-card-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-body">Loading savings goals...</p>
            </div>
          ) : goals.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
              {goals.map((goal) => {
                const target = Number(goal.target_amount);
                const current = Number(goal.current_amount);
                const percentage = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
                const daysLeft = getDaysLeft(goal.deadline);

                return (
                  <div
                    key={goal.id}
                    className="rounded-xl border border-border p-5 bg-card text-card-foreground shadow-sm flex flex-col justify-between transition-all hover:shadow-md space-y-4"
                  >
                    <div>
                      {/* Name & Days Left */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-foreground text-base font-display">{goal.name}</h3>
                          <div className="flex items-center space-x-1 text-muted-foreground text-xs mt-0.5 font-body">
                            <Calendar className="h-3 w-3" />
                            <span>{daysLeft}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(goal.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Amounts Display */}
                      <div className="mt-4 flex items-baseline justify-between text-foreground">
                        <div>
                          <span className="text-xl font-bold font-display">{currencySymbol}{current.toLocaleString("en-IN")}</span>
                          <span className="text-xs text-muted-foreground font-body"> saved</span>
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground font-body">
                          of {currencySymbol}{target.toLocaleString("en-IN")} target
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-2.5 w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-2.5 rounded-full transition-all duration-500 bg-primary"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="mt-1 flex justify-end">
                        <span className="text-[10px] font-bold text-primary font-body">{percentage}% completed</span>
                      </div>
                    </div>

                    {/* Add Funds Inline Form */}
                    <form
                      onSubmit={(e) => handleAddFunds(goal, e)}
                      className="flex gap-2 pt-3 border-t border-border"
                    >
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">{currencySymbol}</span>
                        <input
                          type="number"
                          placeholder="Amount"
                          value={fundAmounts[goal.id] || ""}
                          onChange={(e) =>
                            setFundAmounts((prev) => ({
                              ...prev,
                              [goal.id]: e.target.value,
                            }))
                          }
                          className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-body"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={updateMutation.isPending}
                        className="bg-primary text-primary-foreground font-bold text-xs rounded-lg px-3 py-1.5 hover:opacity-90 transition-colors disabled:opacity-50 flex items-center space-x-1 font-body"
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            {Number(fundAmounts[goal.id]) < 0 ? (
                              <span>Withdraw</span>
                            ) : (
                              <>
                                <Plus className="h-3 w-3" />
                                <span>Save</span>
                              </>
                            )}
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-border rounded-xl bg-card text-card-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground font-display">Set Your First Goal</h3>
              <p className="mt-1 text-sm text-muted-foreground font-body">
                Save for a trip, a new device, or emergency funds. Track it with AI insights.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
