import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTransactions } from "../hooks/useTransactions";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
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
  Upload,
  Sparkles,
  Loader2,
  Check,
} from "lucide-react";
import { jsPDF } from "jspdf";
import CSVImportModal from "../components/transactions/CSVImportModal";

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
  currency: z.string().default("INR"),
  is_recurring: z.boolean().default(false),
  recurrence_frequency: z.string().optional().nullable(),
  recurrence_interval_days: z
    .union([
      z.string().transform((val) => (val === "" ? null : Number(val))),
      z.number(),
      z.null()
    ])
    .optional()
    .nullable(),
  recurrence_end_date: z.string().optional().nullable(),
}).refine((data) => {
  if (data.is_recurring && data.recurrence_frequency === "custom") {
    const days = Number(data.recurrence_interval_days);
    return !isNaN(days) && days > 0 && Number.isInteger(days) && days <= 3650;
  }
  return true;
}, {
  message: "Repeat interval in days is required and must be a positive integer (max 3650)",
  path: ["recurrence_interval_days"]
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

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "JPY"];

const getNextOccurrenceDate = (template) => {
  if (!template) return "";
  let refDate = template.last_generated_recurring 
    ? new Date(template.last_generated_recurring) 
    : new Date(template.date);
  let nextDate = new Date(refDate);
  if (template.recurrence_frequency === "weekly") {
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (template.recurrence_frequency === "monthly") {
    nextDate.setMonth(nextDate.getMonth() + 1);
  } else if (template.recurrence_frequency === "yearly") {
    nextDate.setFullYear(nextDate.getFullYear() + 1);
  } else if (template.recurrence_frequency === "custom" && template.recurrence_interval_days) {
    nextDate.setDate(nextDate.getDate() + Number(template.recurrence_interval_days));
  }
  return nextDate.toISOString().split("T")[0];
};

const getRecurrenceFrequencyText = (template) => {
  if (!template) return "";
  if (template.recurrence_frequency === "custom") {
    return `Repeats every ${template.recurrence_interval_days || 28} days`;
  }
  return `Repeats ${template.recurrence_frequency}`;
};

const getRecurringPreviewText = (freq, days, startDate) => {
  if (!startDate) return "";
  const formattedDate = new Date(startDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  if (freq === "weekly") {
    return `This will repeat every week starting ${formattedDate}`;
  }
  if (freq === "monthly") {
    return `This will repeat every month starting ${formattedDate}`;
  }
  if (freq === "yearly") {
    return `This will repeat every year starting ${formattedDate}`;
  }
  if (freq === "custom") {
    const intervalDays = days || 28;
    return `This will repeat every ${intervalDays} days starting ${formattedDate}`;
  }
  return "";
};

export default function Transactions() {
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
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  
  // AI Categorization states
  const [aiCategorizing, setAiCategorizing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);

  // Filters State
  const [filterType, setFilterType] = useState("all"); 
  const [filterCategory, setFilterCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Natural Language Quick-Add State
  const [quickAddText, setQuickAddText] = useState("");
  const [quickAdding, setQuickAdding] = useState(false);
  const [quickAddError, setQuickAddError] = useState("");
  const [parsedTransactions, setParsedTransactions] = useState([]);

  // Live Exchange Rate Conversion helper states
  const [exchangeRateHelper, setExchangeRateHelper] = useState(null);
  const [editExchangeRateHelper, setEditExchangeRateHelper] = useState(null);

  // Forms Hook Setup
  const addForm = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      amount: "",
      type: "expense",
      category: "groceries",
      date: new Date().toISOString().split("T")[0],
      description: "",
      currency: "INR",
      is_recurring: false,
      recurrence_frequency: "monthly",
      recurrence_interval_days: "",
      recurrence_end_date: "",
    },
  });

  const editForm = useForm({
    resolver: zodResolver(transactionSchema),
  });

  const watchedDescription = addForm.watch("description");
  const watchedCategory = addForm.watch("category");
  const watchedIsRecurring = addForm.watch("is_recurring");
  const watchedEditIsRecurring = editForm.watch("is_recurring");
  const watchedCurrency = addForm.watch("currency");
  const watchedEditCurrency = editForm.watch("currency");
  const watchedAmount = addForm.watch("amount");
  const watchedEditAmount = editForm.watch("amount");
  const watchedFrequency = addForm.watch("recurrence_frequency");
  const watchedEditFrequency = editForm.watch("recurrence_frequency");
  const watchedIntervalDays = addForm.watch("recurrence_interval_days");
  const watchedEditIntervalDays = editForm.watch("recurrence_interval_days");
  const watchedStartDate = addForm.watch("date");
  const watchedEditStartDate = editForm.watch("date");

  // Fetch exchange rate preview in Add form
  useEffect(() => {
    if (!watchedCurrency || watchedCurrency === homeCurrency) {
      setExchangeRateHelper(null);
      return;
    }
    const fetchRate = async () => {
      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${watchedCurrency}`);
        if (res.ok) {
          const data = await res.json();
          const rate = data.rates[homeCurrency];
          if (rate) {
            setExchangeRateHelper(rate);
          }
        }
      } catch (err) {
        console.error("Failed to fetch exchange helper rate:", err);
      }
    };
    fetchRate();
  }, [watchedCurrency, homeCurrency]);

  // Fetch exchange rate preview in Edit form
  useEffect(() => {
    if (!watchedEditCurrency || watchedEditCurrency === homeCurrency) {
      setEditExchangeRateHelper(null);
      return;
    }
    const fetchRate = async () => {
      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${watchedEditCurrency}`);
        if (res.ok) {
          const data = await res.json();
          const rate = data.rates[homeCurrency];
          if (rate) {
            setEditExchangeRateHelper(rate);
          }
        }
      } catch (err) {
        console.error("Failed to fetch exchange helper rate:", err);
      }
    };
    fetchRate();
  }, [watchedEditCurrency, homeCurrency]);

  // Debounced auto-categorization API call
  useEffect(() => {
    if (!watchedDescription || watchedDescription.trim().length < 3) {
      setAiSuggestion(null);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setAiCategorizing(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(`${import.meta.env.VITE_API_URL}/transactions/categorize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ description: watchedDescription }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.category && data.category !== "other") {
            setAiSuggestion(data);
            addForm.setValue("category", data.category);
          }
        }
      } catch (error) {
        console.error("AI auto-categorize failed:", error);
      } finally {
        setAiCategorizing(false);
      }
    }, 600);

    return () => clearTimeout(delayDebounce);
  }, [watchedDescription]);

  // Remove Suggestion Badge if category is manually overridden
  useEffect(() => {
    if (aiSuggestion && watchedCategory !== aiSuggestion.category) {
      setAiSuggestion(null);
    }
  }, [watchedCategory, aiSuggestion]);

  // Action Submit Handlers
  const onAddSubmit = (data) => {
    createMutation.mutate(
      {
        amount: parseFloat(data.amount),
        type: data.type,
        category: data.category,
        date: data.date,
        description: data.description || "",
        currency: data.currency || "INR",
        is_recurring: data.is_recurring || false,
        recurrence_frequency: data.is_recurring ? data.recurrence_frequency : null,
        recurrence_interval_days: (data.is_recurring && data.recurrence_frequency === "custom") ? Number(data.recurrence_interval_days) : null,
        recurrence_end_date: (data.is_recurring && data.recurrence_end_date) ? data.recurrence_end_date : null,
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
        currency: data.currency || "INR",
        is_recurring: data.is_recurring || false,
        recurrence_frequency: data.is_recurring ? data.recurrence_frequency : null,
        recurrence_interval_days: (data.is_recurring && data.recurrence_frequency === "custom") ? Number(data.recurrence_interval_days) : null,
        recurrence_end_date: (data.is_recurring && data.recurrence_end_date) ? data.recurrence_end_date : null,
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
      currency: tx.currency || "INR",
      is_recurring: tx.is_recurring || false,
      recurrence_frequency: tx.recurrence_frequency || "monthly",
      recurrence_interval_days: tx.recurrence_interval_days || "",
      recurrence_end_date: tx.recurrence_end_date || "",
    });
  };

  const handleDeleteClick = (id) => {
    if (window.confirm("Are you sure you want to delete this transaction?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleStopRecurring = (tx) => {
    if (window.confirm("Stop generating new recurring instances for this transaction?")) {
      updateMutation.mutate(
        {
          id: tx.id,
          amount: Number(tx.amount),
          type: tx.type,
          category: tx.category,
          date: tx.date,
          description: tx.description || "",
          is_recurring: false,
        },
        {
          onSuccess: () => {
            alert("Recurring schedule stopped successfully.");
          }
        }
      );
    }
  };

  const updateParsedTransactionField = (index, field, value) => {
    setParsedTransactions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeParsedTransaction = (index) => {
    setParsedTransactions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddAllParsed = async () => {
    try {
      for (const tx of parsedTransactions) {
        await createMutation.mutateAsync({
          amount: parseFloat(tx.amount),
          type: tx.type,
          category: tx.category,
          date: tx.date,
          description: tx.description || "Quick add transaction",
          currency: tx.currency || homeCurrency,
          is_recurring: false,
          recurrence_frequency: null,
          recurrence_end_date: null
        });
      }
      setParsedTransactions([]);
      setQuickAddText("");
      alert("All transactions added successfully!");
    } catch (error) {
      console.error("Failed to add all parsed transactions:", error);
      alert("Error adding some transactions. Please check input formats.");
    }
  };

  const handleQuickAddSubmit = async (e) => {
    e.preventDefault();
    if (!quickAddText.trim()) return;

    setQuickAdding(true);
    setQuickAddError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/transactions/quick-add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ text: quickAddText }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.transactions && data.transactions.length === 1) {
          const tx = data.transactions[0];
          // Prefill manual single addForm
          addForm.setValue("amount", tx.amount ? tx.amount.toString() : "");
          addForm.setValue("type", tx.type || "expense");
          addForm.setValue("category", tx.category || "other");
          addForm.setValue("date", tx.date || new Date().toISOString().split("T")[0]);
          addForm.setValue("description", tx.description || "");
          addForm.setValue("currency", tx.currency || "INR");
          addForm.setValue("is_recurring", false);
          
          setIsAddOpen(true);
          setQuickAddText("");
        } else if (data.transactions && data.transactions.length > 1) {
          setParsedTransactions(data.transactions);
        } else {
          setQuickAddError("No transactions extracted from the prompt.");
        }
      } else {
        const err = await response.json().catch(() => ({}));
        setQuickAddError(err.error || "AI could not parse with high confidence. Please use manual form.");
        setIsAddOpen(true); // reveal manual form below
      }
    } catch (err) {
      console.error("Quick add failed:", err);
      setQuickAddError("Failed to connect to NLP parsing service.");
      setIsAddOpen(true); // reveal manual form below
    } finally {
      setQuickAdding(false);
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

  // Export PDF Statement Report
  const exportBrandedPDF = () => {
    const doc = new jsPDF();
    const currentMonthName = new Date().toLocaleString("default", { month: "long" }) + " " + new Date().getFullYear();

    const incomeTotal = filteredTransactions.reduce((acc, tx) => tx.type === "income" ? acc + (Number(tx.amount) * (tx.exchange_rate_to_home || 1.0)) : acc, 0);
    const expenseTotal = filteredTransactions.reduce((acc, tx) => tx.type === "expense" ? acc + (Number(tx.amount) * (tx.exchange_rate_to_home || 1.0)) : acc, 0);
    const netValue = incomeTotal - expenseTotal;

    const catBreakdown = {};
    filteredTransactions.forEach((tx) => {
      if (tx.type === "expense") {
        const amt = Number(tx.amount) * (tx.exchange_rate_to_home || 1.0);
        catBreakdown[tx.category] = (catBreakdown[tx.category] || 0) + amt;
      }
    });

    const topTransactions = [...filteredTransactions]
      .sort((a, b) => (Number(b.amount) * (b.exchange_rate_to_home || 1.0)) - (Number(a.amount) * (a.exchange_rate_to_home || 1.0)))
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
    doc.text(`PERSONAL FINANCE DATA STATEMENT (${homeCurrency})`, 20, 30);

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
    doc.text(`+${homeCurrency} ${incomeTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 26, 64);

    // 2. Expense Card
    doc.setFillColor(254, 242, 242); 
    doc.roundedRect(79, 48, 52, 24, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(220, 38, 38); 
    doc.text("TOTAL EXPENSES", 85, 55);
    doc.setFontSize(11);
    doc.text(`-${homeCurrency} ${expenseTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 85, 64);

    // 3. Net Balance Card
    doc.setFillColor(243, 244, 246); 
    doc.roundedRect(138, 48, 52, 24, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...slateDark);
    doc.text("NET ACCOUNT VALUE", 144, 55);
    doc.setFontSize(11);
    const sign = netValue >= 0 ? "+" : "";
    doc.text(`${sign}${homeCurrency} ${netValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 144, 64);

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
    doc.text(`Total Expended (${homeCurrency})`, 150, yPosition);
    doc.line(20, yPosition + 2, 190, yPosition + 2);

    yPosition += 8;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...slateDark);

    const breakdownEntries = Object.entries(catBreakdown);
    if (breakdownEntries.length > 0) {
      breakdownEntries.forEach(([category, amount]) => {
        doc.text(category.charAt(0).toUpperCase() + category.slice(1), 22, yPosition);
        doc.text(`${homeCurrency} ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 150, yPosition);
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
    doc.text(`Amount (${homeCurrency})`, 160, yPosition);
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
        const totalHome = Number(tx.amount) * (tx.exchange_rate_to_home || 1.0);
        doc.text(`${symbol}${homeCurrency} ${totalHome.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 160, yPosition);
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
    <div className="space-y-6 pb-20 md:pb-6 text-foreground font-body">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Transactions</h1>
          <p className="text-muted-foreground">Record payments and filter transaction records.</p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center justify-center space-x-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-secondary/20"
          >
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={exportBrandedPDF}
            disabled={filteredTransactions.length === 0}
            className="inline-flex items-center justify-center space-x-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-secondary/20 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>Export Statement PDF</span>
          </button>

          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center justify-center space-x-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* QUICK ADD NATURAL LANGUAGE INPUT PANEL */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 shadow-sm space-y-3">
        <div className="flex items-center space-x-1.5 text-sm font-bold text-primary">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          <span>AI Quick Add (Natural Language)</span>
        </div>
        <form onSubmit={handleQuickAddSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. 'spent 500 on groceries yesterday' or 'salary 1500 USD today'"
            value={quickAddText}
            onChange={(e) => setQuickAddText(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 font-body"
          />
          <button
            type="submit"
            disabled={quickAdding}
            className="bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground font-bold px-4 py-2 rounded-lg text-xs transition-all flex items-center space-x-1.5 shrink-0"
          >
            {quickAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span>Parse Entry</span>
          </button>
        </form>
        {quickAddError && (
          <p className="text-xs text-destructive font-bold animate-pulse">{quickAddError}</p>
        )}
      </div>

      {/* FILTER CONTROL PANEL */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4 text-card-foreground">
        <div className="flex items-center space-x-1.5 text-sm font-bold text-foreground border-b border-border pb-3">
          <Filter className="h-4 w-4 text-primary" />
          <span>Filter Records</span>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Type
            </span>
            <div className="flex rounded-lg bg-secondary/50 p-1 border border-border">
              {["all", "income", "expense"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilterType(type)}
                  className={`rounded-md px-3.5 py-1 text-xs font-bold capitalize transition-all ${
                    filterType === type
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Category
            </span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-lg border border-border bg-background text-foreground px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 capitalize h-[34px]"
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
              <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                From Date
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-border bg-background text-foreground px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 h-[34px]"
              />
            </div>
            <div className="space-y-1.5">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                To Date
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-border bg-background text-foreground px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 h-[34px]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center space-x-1 rounded-lg border border-border bg-card px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors h-[34px]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Transactions Table Section */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-sm text-muted-foreground">Loading your transactions...</p>
          </div>
        ) : filteredTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-muted-foreground">
              <thead className="bg-secondary/40 text-xs font-semibold uppercase text-foreground border-b border-border">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground/90">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-foreground font-medium">
                      {tx.date}
                    </td>
                    <td className="px-6 py-4 text-foreground/90">
                      <div className="flex items-center space-x-2">
                        <span>{tx.description || <span className="text-muted-foreground/60 italic">None</span>}</span>
                        {tx.is_recurring && !tx.parent_transaction_id && (
                          <span 
                            title={`${tx.recurrence_frequency === "custom" ? `Repeats every ${tx.recurrence_interval_days} days` : `Repeats ${tx.recurrence_frequency}`} · Next: ${getNextOccurrenceDate(tx)}`}
                            className="inline-flex items-center space-x-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[9px] font-bold text-primary cursor-help"
                          >
                            <RefreshCw className="h-2.5 w-2.5" />
                            <span>{tx.recurrence_frequency === "custom" ? `Every ${tx.recurrence_interval_days}d` : tx.recurrence_frequency}</span>
                          </span>
                        )}
                        {tx.parent_transaction_id && (
                          <span className="inline-flex items-center space-x-1 rounded-full bg-secondary border border-border px-2 py-0.5 text-[9px] font-bold text-muted-foreground">
                            <RefreshCw className="h-2.5 w-2.5" />
                            <span>Instance</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="capitalize px-2 py-1 rounded bg-secondary text-foreground text-xs font-semibold">
                        {tx.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          tx.type === "income"
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {tx.type === "income" ? "Income" : "Expense"}
                      </span>
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-right font-bold ${
                        tx.type === "income" ? "text-success" : "text-destructive"
                      }`}
                    >
                      <div>
                        <span>
                          {tx.type === "income" ? "+" : "-"}
                          {getCurrencySymbol(tx.currency)}
                          {Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {tx.currency !== homeCurrency && (
                          <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                            ({currencySymbol}{(Number(tx.amount) * (tx.exchange_rate_to_home || 1.0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center space-x-2">
                      <button
                        onClick={() => handleEditClick(tx)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-primary hover:bg-secondary transition-all"
                        title="Edit Transaction"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {tx.is_recurring && !tx.parent_transaction_id && (
                        <button
                          onClick={() => handleStopRecurring(tx)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-warning hover:bg-secondary transition-all"
                          title="Stop Recurrence"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteClick(tx.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-destructive hover:bg-secondary transition-all"
                        title="Delete Transaction"
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground font-display">No Transactions Found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your filter settings or logging a new record.
            </p>
          </div>
        )}
      </div>

      {/* ADD TRANSACTION MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border border-border relative text-card-foreground">
            <button
              onClick={() => setIsAddOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-foreground mb-4 font-display">Add Transaction</h3>

            <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase text-muted-foreground">Amount</label>
                  <input
                    type="text"
                    placeholder="0.00"
                    {...addForm.register("amount")}
                    className={`mt-1.5 block w-full rounded-lg border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      addForm.formState.errors.amount
                        ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                        : "border-border focus:border-primary focus:ring-primary/20"
                    }`}
                  />
                  {addForm.formState.errors.amount && (
                    <p className="mt-1 text-xs text-destructive">
                      {addForm.formState.errors.amount.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-muted-foreground">Currency</label>
                  <select
                    {...addForm.register("currency")}
                    className="mt-1.5 block w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live exchange preview helper note */}
              {exchangeRateHelper && watchedAmount && !isNaN(Number(watchedAmount)) && (
                <p className="text-xs text-primary font-bold bg-primary/5 rounded-lg p-2 border border-primary/10">
                  Estimated Conversion: {getCurrencySymbol(watchedCurrency)}{Number(watchedAmount).toLocaleString()} = {currencySymbol}{(Number(watchedAmount) * exchangeRateHelper).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {homeCurrency}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-muted-foreground">Type</label>
                  <select
                    {...addForm.register("type")}
                    className="mt-1.5 block w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center">
                    <label className="block text-xs font-bold uppercase text-muted-foreground">Category</label>
                    {aiSuggestion && (
                      <span className="inline-flex items-center space-x-0.5 ml-2 rounded-full bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-primary animate-fade-in shrink-0">
                        <Sparkles className="h-2.5 w-2.5 text-primary animate-pulse" />
                        <span>AI suggested</span>
                      </span>
                    )}
                    {aiCategorizing && (
                      <span className="text-[9px] text-muted-foreground ml-2 animate-pulse">Analyzing...</span>
                    )}
                  </div>
                  <select
                    {...addForm.register("category")}
                    className="mt-1.5 block w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 capitalize"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-muted-foreground">Date</label>
                <input
                  type="date"
                  {...addForm.register("date")}
                  className="mt-1.5 block w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-muted-foreground">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly Groceries"
                  {...addForm.register("description")}
                  className="mt-1.5 block w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Recurring Switch and Settings */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_recurring"
                    {...addForm.register("is_recurring")}
                    className="rounded border-border bg-background text-primary focus:ring-primary/20 h-4 w-4 cursor-pointer"
                  />
                  <label htmlFor="is_recurring" className="text-xs font-bold uppercase text-muted-foreground select-none cursor-pointer">
                    Enable Recurring Payments Schedule?
                  </label>
                </div>

                {watchedIsRecurring && (
                  <div className="grid grid-cols-2 gap-3 pl-6 border-l-2 border-primary/20 animate-fade-in">
                    <div>
                      <label className="block text-xs font-bold uppercase text-muted-foreground">Billing Interval</label>
                      <select
                        {...addForm.register("recurrence_frequency")}
                        className="mt-1.5 block w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="custom">Custom (days)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-muted-foreground">End Date (Optional)</label>
                      <input
                        type="date"
                        {...addForm.register("recurrence_end_date")}
                        className="mt-1.5 block w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    {watchedFrequency === "custom" && (
                      <div className="col-span-2 animate-fade-in">
                        <label className="block text-xs font-bold uppercase text-muted-foreground">Repeat every (days)</label>
                        <input
                          type="number"
                          placeholder="e.g. 28"
                          {...addForm.register("recurrence_interval_days")}
                          className={`mt-1.5 block w-full rounded-lg border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                            addForm.formState.errors.recurrence_interval_days
                              ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                              : "border-border focus:border-primary focus:ring-primary/20"
                          }`}
                        />
                        {addForm.formState.errors.recurrence_interval_days && (
                          <p className="mt-1 text-xs text-destructive">
                            {addForm.formState.errors.recurrence_interval_days.message}
                          </p>
                        )}
                      </div>
                    )}
                    {getRecurringPreviewText(watchedFrequency, watchedIntervalDays, watchedStartDate) && (
                      <div className="col-span-2 p-2.5 bg-primary/5 border border-primary/10 rounded-lg text-[11px] font-bold text-primary">
                        {getRecurringPreviewText(watchedFrequency, watchedIntervalDays, watchedStartDate)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {createMutation.isPending ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MULTI-TRANSACTION CONFIRMATION MODAL */}
      {parsedTransactions.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl max-h-[85vh] rounded-xl bg-card p-6 shadow-xl border border-border relative text-card-foreground flex flex-col animate-fade-in">
            <button
              onClick={() => setParsedTransactions([])}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-4">
              <h3 className="text-lg font-bold text-foreground font-display flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                <span>Confirm Parsed Transactions</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                We found {parsedTransactions.length} transactions. Please review, edit, or remove them before saving.
              </p>
            </div>

            {/* Scrollable list of cards */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-6">
              {parsedTransactions.map((tx, idx) => (
                <div key={idx} className="rounded-xl border border-border bg-secondary/20 p-4 shadow-sm relative space-y-3">
                  <button
                    type="button"
                    onClick={() => removeParsedTransaction(idx)}
                    className="absolute right-3 top-3 text-xs font-bold text-destructive hover:opacity-80 flex items-center space-x-1"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </button>

                  <div className="text-xs font-bold text-primary uppercase tracking-wider">
                    Transaction #{idx + 1}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-6">
                    {/* Description */}
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Description</label>
                      <input
                        type="text"
                        value={tx.description || ""}
                        onChange={(e) => updateParsedTransactionField(idx, "description", e.target.value)}
                        className="block w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 font-body"
                      />
                    </div>

                    {/* Amount */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Amount</label>
                      <input
                        type="number"
                        step="any"
                        value={tx.amount || ""}
                        onChange={(e) => updateParsedTransactionField(idx, "amount", e.target.value)}
                        className="block w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 font-body"
                      />
                    </div>

                    {/* Currency */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Currency</label>
                      <select
                        value={tx.currency || "INR"}
                        onChange={(e) => updateParsedTransactionField(idx, "currency", e.target.value)}
                        className="block w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 font-body capitalize"
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Type */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Type</label>
                      <select
                        value={tx.type || "expense"}
                        onChange={(e) => updateParsedTransactionField(idx, "type", e.target.value)}
                        className="block w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 font-body capitalize"
                      >
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                      </select>
                    </div>

                    {/* Category */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Category</label>
                      <select
                        value={tx.category || "other"}
                        onChange={(e) => updateParsedTransactionField(idx, "category", e.target.value)}
                        className="block w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 font-body capitalize"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="w-full sm:w-1/3 md:w-1/4 space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Date</label>
                    <input
                      type="date"
                      value={tx.date || ""}
                      onChange={(e) => updateParsedTransactionField(idx, "date", e.target.value)}
                      className="block w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 font-body"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setParsedTransactions([])}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary/20 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddAllParsed}
                disabled={parsedTransactions.length === 0 || createMutation.isPending}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-colors flex items-center space-x-1.5"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>Add All ({parsedTransactions.length}) Transactions</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TRANSACTION MODAL */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border border-border relative text-card-foreground">
            <button
              onClick={() => setEditingTransaction(null)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-foreground mb-4 font-display">Edit Transaction</h3>

            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase text-muted-foreground">Amount</label>
                  <input
                    type="text"
                    placeholder="0.00"
                    {...editForm.register("amount")}
                    className={`mt-1.5 block w-full rounded-lg border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      editForm.formState.errors.amount
                        ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                        : "border-border focus:border-primary focus:ring-primary/20"
                    }`}
                  />
                  {editForm.formState.errors.amount && (
                    <p className="mt-1 text-xs text-destructive">
                      {editForm.formState.errors.amount.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-muted-foreground">Currency</label>
                  <select
                    {...editForm.register("currency")}
                    className="mt-1.5 block w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live exchange preview helper note */}
              {editExchangeRateHelper && watchedEditAmount && !isNaN(Number(watchedEditAmount)) && (
                <p className="text-xs text-primary font-bold bg-primary/5 rounded-lg p-2 border border-primary/10">
                  Estimated Conversion: {getCurrencySymbol(watchedEditCurrency)}{Number(watchedEditAmount).toLocaleString()} = {currencySymbol}{(Number(watchedEditAmount) * editExchangeRateHelper).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {homeCurrency}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-muted-foreground">Type</label>
                  <select
                    {...editForm.register("type")}
                    className="mt-1.5 block w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-muted-foreground">Category</label>
                  <select
                    {...editForm.register("category")}
                    className="mt-1.5 block w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 capitalize"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-muted-foreground">Date</label>
                <input
                  type="date"
                  {...editForm.register("date")}
                  className="mt-1.5 block w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-muted-foreground">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly Groceries"
                  {...editForm.register("description")}
                  className="mt-1.5 block w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Recurring Switch and Settings */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="edit_is_recurring"
                    {...editForm.register("is_recurring")}
                    className="rounded border-border bg-background text-primary focus:ring-primary/20 h-4 w-4 cursor-pointer"
                  />
                  <label htmlFor="edit_is_recurring" className="text-xs font-bold uppercase text-muted-foreground select-none cursor-pointer">
                    Enable Recurring Payments Schedule?
                  </label>
                </div>

                {watchedEditIsRecurring && (
                  <div className="grid grid-cols-2 gap-3 pl-6 border-l-2 border-primary/20 animate-fade-in">
                    <div>
                      <label className="block text-xs font-bold uppercase text-muted-foreground">Billing Interval</label>
                      <select
                        {...editForm.register("recurrence_frequency")}
                        className="mt-1.5 block w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="custom">Custom (days)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-muted-foreground">End Date (Optional)</label>
                      <input
                        type="date"
                        {...editForm.register("recurrence_end_date")}
                        className="mt-1.5 block w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    {watchedEditFrequency === "custom" && (
                      <div className="col-span-2 animate-fade-in">
                        <label className="block text-xs font-bold uppercase text-muted-foreground">Repeat every (days)</label>
                        <input
                          type="number"
                          placeholder="e.g. 28"
                          {...editForm.register("recurrence_interval_days")}
                          className={`mt-1.5 block w-full rounded-lg border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                            editForm.formState.errors.recurrence_interval_days
                              ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                              : "border-border focus:border-primary focus:ring-primary/20"
                          }`}
                        />
                        {editForm.formState.errors.recurrence_interval_days && (
                          <p className="mt-1 text-xs text-destructive">
                            {editForm.formState.errors.recurrence_interval_days.message}
                          </p>
                        )}
                      </div>
                    )}
                    {getRecurringPreviewText(watchedEditFrequency, watchedEditIntervalDays, watchedEditStartDate) && (
                      <div className="col-span-2 p-2.5 bg-primary/5 border border-primary/10 rounded-lg text-[11px] font-bold text-primary">
                        {getRecurringPreviewText(watchedEditFrequency, watchedEditIntervalDays, watchedEditStartDate)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* CSV IMPORT MODAL */}
      <CSVImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
    </div>
  );
}
