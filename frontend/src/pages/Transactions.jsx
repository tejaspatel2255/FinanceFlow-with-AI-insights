import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTransactions } from "../hooks/useTransactions";
import {
  Calendar,
  Download,
  Edit2,
  FileText,
  Plus,
  Trash2,
  X,
  Filter,
  RefreshCw,
} from "lucide-react";
import { jsPDF } from "jspdf";

// Form validation schema using Zod
const transactionSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be a positive number",
    }),
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "Category is required"),
  date: z.string().min(1, "Date is required"),
  description: z.string().optional(),
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

export default function Transactions() {
  const {
    useGetTransactions,
    useCreateTransaction,
    useUpdateTransaction,
    useDeleteTransaction,
  } = useTransactions();

  const { data: transactions = [], isLoading } = useGetTransactions();
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  // State Management
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  // Filters State
  const [filterType, setFilterType] = useState("all"); 
  const [filterCategory, setFilterCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Forms Hook Setup
  const addForm = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      amount: "",
      type: "expense",
      category: "groceries",
      date: new Date().toISOString().split("T")[0],
      description: "",
    },
  });

  const editForm = useForm({
    resolver: zodResolver(transactionSchema),
  });

  // Action Submit Handlers
  const onAddSubmit = (data) => {
    createMutation.mutate(
      {
        amount: parseFloat(data.amount),
        type: data.type,
        category: data.category,
        date: data.date,
        description: data.description || "",
      },
      {
        onSuccess: () => {
          setIsAddOpen(false);
          addForm.reset();
        },
      }
    );
  };

  const onEditSubmit = (data) => {
    if (!editingTransaction) return;
    updateMutation.mutate(
      {
        id: editingTransaction.id,
        amount: parseFloat(data.amount),
        type: data.type,
        category: data.category,
        date: data.date,
        description: data.description || "",
      },
      {
        onSuccess: () => {
          setEditingTransaction(null);
          editForm.reset();
        },
      }
    );
  };

  const handleEditClick = (tx) => {
    setEditingTransaction(tx);
    editForm.reset({
      amount: tx.amount.toString(),
      type: tx.type,
      category: tx.category,
      date: tx.date,
      description: tx.description || "",
    });
  };

  const handleDeleteClick = (id) => {
    if (window.confirm("Are you sure you want to delete this transaction?")) {
      deleteMutation.mutate(id);
    }
  };

  // Filter Logic Execution
  const filteredTransactions = transactions.filter((tx) => {
    if (filterType !== "all" && tx.type !== filterType) {
      return false;
    }
    if (filterCategory !== "all" && tx.category.toLowerCase() !== filterCategory.toLowerCase()) {
      return false;
    }
    if (startDate && tx.date < startDate) {
      return false;
    }
    if (endDate && tx.date > endDate) {
      return false;
    }
    return true;
  });

  // Reset Filters
  const clearFilters = () => {
    setFilterType("all");
    setFilterCategory("all");
    setStartDate("");
    setEndDate("");
  };

  // Phase 3: Export Branded PDF Report (uses INR to avoid character encoding errors with raw unicode ₹)
  const exportBrandedPDF = () => {
    const doc = new jsPDF();
    const currentMonthName = new Date().toLocaleString("default", { month: "long" }) + " " + new Date().getFullYear();

    const incomeTotal = filteredTransactions.reduce((acc, tx) => tx.type === "income" ? acc + Number(tx.amount) : acc, 0);
    const expenseTotal = filteredTransactions.reduce((acc, tx) => tx.type === "expense" ? acc + Number(tx.amount) : acc, 0);
    const netValue = incomeTotal - expenseTotal;

    const catBreakdown = {};
    filteredTransactions.forEach((tx) => {
      if (tx.type === "expense") {
        catBreakdown[tx.category] = (catBreakdown[tx.category] || 0) + Number(tx.amount);
      }
    });

    const topTransactions = [...filteredTransactions]
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5);

    const primaryColor = [79, 70, 229]; // Indigo-600
    const slateDark = [15, 23, 42]; // Slate-900
    const slateMuted = [100, 116, 139]; // Slate-500
    const lineLight = [226, 232, 240]; // Slate-200

    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...primaryColor);
    doc.text("FinanceFlow", 20, 24);

    doc.setFillColor(...primaryColor);
    doc.roundedRect(178, 14, 12, 12, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text("FF", 182, 22);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...slateMuted);
    doc.text("PERSONAL FINANCE DATA STATEMENT (INR)", 20, 30);

    doc.setFont("helvetica", "normal");
    doc.text(`Reporting Period: ${currentMonthName}`, 20, 36);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 145, 36);

    doc.setDrawColor(...lineLight);
    doc.line(20, 42, 190, 42);

    // 1. Income Card
    doc.setFillColor(240, 253, 250); 
    doc.roundedRect(20, 48, 52, 24, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(5, 150, 105); 
    doc.text("TOTAL INCOME", 26, 55);
    doc.setFontSize(11);
    doc.text(`+INR ${incomeTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 26, 64);

    // 2. Expense Card
    doc.setFillColor(254, 242, 242); 
    doc.roundedRect(79, 48, 52, 24, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(220, 38, 38); 
    doc.text("TOTAL EXPENSES", 85, 55);
    doc.setFontSize(11);
    doc.text(`-INR ${expenseTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 85, 64);

    // 3. Net Balance Card
    doc.setFillColor(243, 244, 246); 
    doc.roundedRect(138, 48, 52, 24, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...slateDark);
    doc.text("NET ACCOUNT VALUE", 144, 55);
    doc.setFontSize(11);
    const sign = netValue >= 0 ? "+" : "";
    doc.text(`${sign}INR ${netValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 144, 64);

    doc.setDrawColor(...lineLight);
    doc.line(20, 80, 190, 80);

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...slateDark);
    doc.text("Spending by Category", 20, 89);

    let yPosition = 96;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...slateMuted);
    doc.text("Category Name", 22, yPosition);
    doc.text("Total Expended (INR)", 150, yPosition);
    doc.line(20, yPosition + 2, 190, yPosition + 2);

    yPosition += 8;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...slateDark);

    const breakdownEntries = Object.entries(catBreakdown);
    if (breakdownEntries.length > 0) {
      breakdownEntries.forEach(([category, amount]) => {
        doc.text(category.charAt(0).toUpperCase() + category.slice(1), 22, yPosition);
        doc.text(`INR ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 150, yPosition);
        doc.setDrawColor(241, 245, 249);
        doc.line(20, yPosition + 2, 190, yPosition + 2);
        yPosition += 8;
      });
    } else {
      doc.setTextColor(...slateMuted);
      doc.text("No expense transactions match active filters.", 22, yPosition);
      yPosition += 8;
    }

    yPosition += 6;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...slateDark);
    doc.text("Top 5 Largest Transactions", 20, yPosition);

    yPosition += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...slateMuted);
    doc.text("Date", 22, yPosition);
    doc.text("Description", 55, yPosition);
    doc.text("Type", 115, yPosition);
    doc.text("Amount (INR)", 160, yPosition);
    doc.setDrawColor(...slateMuted);
    doc.line(20, yPosition + 2, 190, yPosition + 2);

    yPosition += 8;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...slateDark);

    if (topTransactions.length > 0) {
      topTransactions.forEach((tx) => {
        doc.text(tx.date, 22, yPosition);
        doc.text(tx.description || "N/A", 55, yPosition);
        doc.text(tx.type.toUpperCase(), 115, yPosition);
        const symbol = tx.type === "income" ? "+" : "-";
        doc.text(`${symbol}INR ${Number(tx.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 160, yPosition);
        doc.setDrawColor(241, 245, 249);
        doc.line(20, yPosition + 2, 190, yPosition + 2);
        yPosition += 8;
      });
    } else {
      doc.setTextColor(...slateMuted);
      doc.text("No transaction history matches active filters.", 22, yPosition);
    }

    doc.setFontSize(8);
    doc.setTextColor(...slateMuted);
    doc.text("Report generated by FinanceFlow AI Platform. Confidential.", 20, 285);
    doc.text("Page 1 of 1", 175, 285);

    doc.save(`FinanceFlow_Report_${currentMonthName.replace(" ", "_")}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Transactions</h1>
          <p className="text-slate-500">Record payments and filter transaction records.</p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={exportBrandedPDF}
            disabled={filteredTransactions.length === 0}
            className="inline-flex items-center justify-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>Export Statement PDF</span>
          </button>

          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center justify-center space-x-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* FILTER CONTROL PANEL */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center space-x-1.5 text-sm font-bold text-slate-700 border-b border-slate-100 pb-3">
          <Filter className="h-4 w-4 text-primary" />
          <span>Filter Records</span>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Type
            </span>
            <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
              {["all", "income", "expense"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilterType(type)}
                  className={`rounded-md px-3.5 py-1 text-xs font-bold capitalize transition-all ${
                    filterType === type
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-955"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Category
            </span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 capitalize h-[34px]"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <div className="space-y-1.5">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                From Date
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 h-[34px]"
              />
            </div>
            <div className="space-y-1.5">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                To Date
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 h-[34px]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors h-[34px]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Transactions Table Section */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-sm text-slate-500">Loading your transactions...</p>
          </div>
        ) : filteredTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-slate-500">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-900 font-medium">
                      {tx.date}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {tx.description || <span className="text-slate-300 italic">None</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="capitalize px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
                        {tx.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          tx.type === "income"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {tx.type === "income" ? "Income" : "Expense"}
                      </span>
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-right font-bold ${
                        tx.type === "income" ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}₹{Number(tx.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center space-x-2">
                      <button
                        onClick={() => handleEditClick(tx)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-primary hover:bg-slate-50 transition-all"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(tx.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-rose-600 hover:bg-slate-50 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">No Transactions Found</h3>
            <p className="mt-1 text-sm text-slate-500">
              Try adjusting your filter settings or logging a new record.
            </p>
          </div>
        )}
      </div>

      {/* ADD TRANSACTION MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-100 relative">
            <button
              onClick={() => setIsAddOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-4">Add Transaction</h3>

            <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500">Amount (₹)</label>
                <input
                  type="text"
                  placeholder="0.00"
                  {...addForm.register("amount")}
                  className={`mt-1.5 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                    addForm.formState.errors.amount
                      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
                      : "border-slate-200 focus:border-primary focus:ring-primary/20"
                  }`}
                />
                {addForm.formState.errors.amount && (
                  <p className="mt-1 text-xs text-rose-500">
                    {addForm.formState.errors.amount.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500">Type</label>
                <select
                  {...addForm.register("type")}
                  className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500">Category</label>
                <select
                  {...addForm.register("category")}
                  className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 capitalize"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500">Date</label>
                <input
                  type="date"
                  {...addForm.register("date")}
                  className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly Groceries"
                  {...addForm.register("description")}
                  className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-indigo-600 disabled:opacity-50"
                >
                  {createMutation.isPending ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TRANSACTION MODAL */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-100 relative">
            <button
              onClick={() => setEditingTransaction(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Transaction</h3>

            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500">Amount (₹)</label>
                <input
                  type="text"
                  placeholder="0.00"
                  {...editForm.register("amount")}
                  className={`mt-1.5 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                    editForm.formState.errors.amount
                      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
                      : "border-slate-200 focus:border-primary focus:ring-primary/20"
                  }`}
                />
                {editForm.formState.errors.amount && (
                  <p className="mt-1 text-xs text-rose-500">
                    {editForm.formState.errors.amount.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500">Type</label>
                <select
                  {...editForm.register("type")}
                  className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500">Category</label>
                <select
                  {...editForm.register("category")}
                  className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 capitalize"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500">Date</label>
                <input
                  type="date"
                  {...editForm.register("date")}
                  className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly Groceries"
                  {...editForm.register("description")}
                  className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-indigo-600 disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
