import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import * as z from "zod";
import { supabase } from "../../lib/supabase";
import {
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Loader2,
  Sparkles
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL;

// Zod validation schema for individual transaction row import
const importRowSchema = z.object({
  amount: z.number().positive("Amount must be a positive number"),
  type: z.enum(["income", "expense"]),
  category: z.string().optional(),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Must be a valid date format",
  }),
  description: z.string().optional(),
});

export default function CSVImportModal({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  
  // Workflow step: 'upload', 'map', 'preview', 'importing'
  const [step, setStep] = useState("upload");
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // CSV Parsing Data
  const [headers, setHeaders] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [mappings, setMappings] = useState({
    date: "",
    amount: "",
    type: "",
    category: "",
    description: "",
  });

  // Validation Results
  const [validRows, setValidRows] = useState([]);
  const [invalidRows, setInvalidRows] = useState([]);
  const [showErrorsList, setShowErrorsList] = useState(false);
  
  // AI Categorization Checkbox
  const [autoCategorize, setAutoCategorize] = useState(false);

  // Helper to fetch authorization header
  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    };
  };

  // Drag handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith(".csv")) {
        processFile(droppedFile);
      } else {
        setErrorMsg("Please upload a valid CSV (.csv) file.");
      }
    }
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (selectedFile) => {
    if (selectedFile.size > 2 * 1024 * 1024) {
      setErrorMsg("File is too large. Maximum size allowed is 2MB.");
      return;
    }
    setFile(selectedFile);
    setErrorMsg("");

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          setErrorMsg("CSV file appears to be empty.");
          return;
        }
        setHeaders(results.meta.fields || []);
        setParsedRows(results.data);
        autoDetectMappings(results.meta.fields || []);
        setStep("map");
      },
      error: (err) => {
        setErrorMsg("Error parsing CSV: " + err.message);
      },
    });
  };

  // Auto-detect matching headers
  const autoDetectMappings = (fields) => {
    const detected = { date: "", amount: "", type: "", category: "", description: "" };
    
    const searchTerms = {
      date: ["date", "timestamp", "txn date", "transaction date", "booking date", "dt"],
      amount: ["amount", "value", "price", "sum", "transaction amount", "cost"],
      type: ["type", "transaction type", "cr/dr", "income/expense", "direction"],
      category: ["category", "tag", "group", "class"],
      description: ["description", "memo", "details", "narrative", "merchant", "payee", "particulars"],
    };

    Object.keys(searchTerms).forEach((key) => {
      const match = fields.find((field) =>
        searchTerms[key].some((term) => field.toLowerCase().includes(term.toLowerCase()))
      );
      if (match) {
        detected[key] = match;
      }
    });

    setMappings(detected);
  };

  const handleMappingChange = (field, value) => {
    setMappings((prev) => ({ ...prev, [field]: value }));
  };

  // Process mapping and run Zod validation
  const validateMappedData = () => {
    const valid = [];
    const invalid = [];

    parsedRows.forEach((row, index) => {
      const rawDate = row[mappings.date];
      const rawAmount = row[mappings.amount];
      const rawType = row[mappings.type];
      const rawCategory = row[mappings.category];
      const rawDescription = row[mappings.description];

      // 1. Normalize amount
      let amountNum = NaN;
      if (rawAmount) {
        // Strip out commas, dollar signs, and currency symbols
        const cleanAmount = rawAmount.replace(/[$,₹\s]/g, "");
        amountNum = parseFloat(cleanAmount);
      }

      // 2. Normalize type
      let resolvedType = "expense";
      if (rawType) {
        const typeLower = rawType.toLowerCase();
        if (
          typeLower.includes("income") ||
          typeLower.includes("credit") ||
          typeLower.includes("in") ||
          typeLower.includes("deposit") ||
          typeLower === "cr"
        ) {
          resolvedType = "income";
        }
      }

      // 3. Normalize Date
      let formattedDate = "";
      if (rawDate) {
        try {
          const parsedDate = new Date(rawDate);
          if (!isNaN(parsedDate.getTime())) {
            formattedDate = parsedDate.toISOString().split("T")[0];
          }
        } catch (_) {}
      }

      const txObject = {
        amount: amountNum,
        type: resolvedType,
        category: rawCategory ? rawCategory.trim().toLowerCase() : undefined,
        date: formattedDate,
        description: rawDescription ? rawDescription.trim() : "",
      };

      const zodResult = importRowSchema.safeParse(txObject);
      if (zodResult.success) {
        valid.push(zodResult.data);
      } else {
        const errors = zodResult.error.errors.map((e) => e.message).join(", ");
        invalid.push({
          index: index + 1,
          row,
          error: errors || "Invalid values provided",
        });
      }
    });

    setValidRows(valid);
    setInvalidRows(invalid);
    setStep("preview");
  };

  // Perform bulk import
  const handleConfirmImport = async () => {
    setStep("importing");
    try {
      let finalRows = [...validRows];

      // Part C: AI Auto-categorization
      if (autoCategorize) {
        // Identify rows with empty/other/missing categories
        const rowsToCategorize = finalRows.filter(
          (row) => !row.category || row.category === "" || row.category === "other"
        );

        if (rowsToCategorize.length > 0) {
          // Extract unique descriptions to batch
          const uniqueDescriptions = Array.from(
            new Set(rowsToCategorize.map((r) => r.description).filter(Boolean))
          );

          if (uniqueDescriptions.length > 0) {
            const headers = await getAuthHeader();
            const categorizeRes = await fetch(`${API_BASE_URL}/transactions/categorize`, {
              method: "POST",
              headers,
              body: JSON.stringify({ descriptions: uniqueDescriptions }),
            });

            if (categorizeRes.ok) {
              const categoryMappings = await categorizeRes.json();
              // Create dictionary for fast lookups
              const catMap = {};
              categoryMappings.forEach((item) => {
                catMap[item.description] = item.category;
              });

              // Apply categories to final rows
              finalRows = finalRows.map((row) => {
                if (!row.category || row.category === "" || row.category === "other") {
                  return {
                    ...row,
                    category: catMap[row.description] || "other",
                  };
                }
                return row;
              });
            }
          }
        }
      }

      // Execute Bulk Import API
      const headers = await getAuthHeader();
      const importResponse = await fetch(`${API_BASE_URL}/transactions/bulk-import`, {
        method: "POST",
        headers,
        body: JSON.stringify({ transactions: finalRows }),
      });

      if (!importResponse.ok) {
        const err = await importResponse.json().catch(() => ({}));
        throw new Error(err.error || "Failed to insert transactions.");
      }

      const summary = await importResponse.json();
      
      // Invalidate queries to refresh charts & tables
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      
      alert(`Import completed! ${summary.insertedCount} transactions successfully loaded.`);
      resetState();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Failed to complete bulk import.");
      setStep("preview");
    }
  };

  const resetState = () => {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setParsedRows([]);
    setValidRows([]);
    setInvalidRows([]);
    setMappings({ date: "", amount: "", type: "", category: "", description: "" });
    setErrorMsg("");
    setShowErrorsList(false);
    setAutoCategorize(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in font-body">
      <div className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-2xl border border-border relative max-h-[85vh] flex flex-col justify-between text-card-foreground">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground font-display">Bulk Import Transactions</h3>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto my-4 pr-1 space-y-4 text-sm text-foreground/90">
          {errorMsg && (
            <div className="flex items-start space-x-2 rounded-xl bg-destructive/10 p-4 border border-destructive/20 text-destructive font-medium">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD FILE */}
          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-xs">
                Upload your transaction data via a CSV file. The file should contain headers like Date, Amount, Type, Category, and Description. Cap is 1000 rows.
              </p>
              
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center space-y-3 cursor-pointer transition-all ${
                  dragActive
                    ? "border-primary bg-primary/5 scale-[0.99]"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Upload className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-foreground">Drag and drop your CSV here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse from system files</p>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-file-picker"
                />
                <label
                  htmlFor="csv-file-picker"
                  className="mt-2 rounded-lg border border-border bg-background px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary/30 cursor-pointer shadow-sm"
                >
                  Select CSV File
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === "map" && (
            <div className="space-y-4">
              <div className="bg-secondary/40 rounded-xl p-4 border border-border space-y-2">
                <h4 className="font-bold text-foreground text-xs uppercase tracking-wider font-display">Map CSV Columns</h4>
                <p className="text-xs text-muted-foreground">
                  Select which column in your CSV matches the corresponding FinanceFlow fields.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {Object.keys(mappings).map((field) => (
                  <div key={field} className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase text-muted-foreground font-display capitalize">
                      {field} {field === "amount" || field === "date" || field === "type" ? <span className="text-destructive">*</span> : ""}
                    </label>
                    <select
                      value={mappings[field]}
                      onChange={(e) => handleMappingChange(field, e.target.value)}
                      className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">-- Choose Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-border flex justify-end space-x-3">
                <button
                  onClick={resetState}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary/30"
                >
                  Back
                </button>
                <button
                  onClick={validateMappedData}
                  disabled={!mappings.date || !mappings.amount}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Map & Validate
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & VALIDATION SUMMARY */}
          {step === "preview" && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-success/20 bg-success/5 p-4 flex items-center space-x-3 text-success">
                  <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
                  <div>
                    <p className="font-extrabold text-base">{validRows.length}</p>
                    <p className="text-xs font-semibold text-success/80">Valid rows (ready for import)</p>
                  </div>
                </div>

                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-center space-x-3 text-destructive">
                  <AlertCircle className="h-6 w-6 text-destructive shrink-0" />
                  <div>
                    <p className="font-extrabold text-base">{invalidRows.length}</p>
                    <p className="text-xs font-semibold text-destructive/80">Rows with errors (will be skipped)</p>
                  </div>
                </div>
              </div>

              {/* AI Auto-categorization Checkbox */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="auto-categorize-ai"
                  checked={autoCategorize}
                  onChange={(e) => setAutoCategorize(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary/50 cursor-pointer"
                />
                <div>
                  <label htmlFor="auto-categorize-ai" className="font-bold text-foreground flex items-center space-x-1.5 cursor-pointer font-display">
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    <span>Auto-categorize missing categories with AI</span>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    If checked, descriptions with empty categories will be analyzed and classified using Gemini.
                  </p>
                </div>
              </div>

              {/* FIRST 10 PARSED ROWS PREVIEW */}
              <div>
                <h4 className="font-bold text-foreground mb-2 text-xs uppercase tracking-wider font-display">Preview (First 10 Valid Rows)</h4>
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full text-left text-xs text-muted-foreground">
                    <thead className="bg-secondary/40 text-foreground uppercase font-semibold border-b border-border">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {validRows.slice(0, 10).map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2.5 whitespace-nowrap text-foreground font-medium">{row.date}</td>
                          <td className="px-4 py-2.5 truncate max-w-[150px] text-foreground/90">{row.description || "N/A"}</td>
                          <td className="px-4 py-2.5 capitalize whitespace-nowrap text-foreground/90">{row.type}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-foreground">₹{row.amount.toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Skipped Rows Error Logs */}
              {invalidRows.length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowErrorsList(!showErrorsList)}
                    className="w-full bg-secondary/40 p-3 text-xs font-bold text-foreground flex justify-between items-center"
                  >
                    <span>View skipped rows detail ({invalidRows.length})</span>
                    {showErrorsList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {showErrorsList && (
                    <div className="p-3 bg-card max-h-40 overflow-y-auto text-xs space-y-1.5 divide-y divide-border">
                      {invalidRows.map((err) => (
                        <div key={err.index} className="pt-1.5 flex justify-between text-foreground/80 font-medium">
                          <span>Row {err.index}</span>
                          <span className="text-destructive font-semibold">{err.error}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-border flex justify-end space-x-3">
                <button
                  onClick={() => setStep("map")}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary/30"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={validRows.length === 0}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center space-x-1"
                >
                  <span>Confirm and Import</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: IMPORTING LOADER */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-bold text-foreground">Processing bulk transactions...</p>
                <p className="text-xs text-muted-foreground mt-1">This may take a moment to synchronize.</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
