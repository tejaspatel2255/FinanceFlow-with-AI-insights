import { useTheme } from "../context/ThemeContext";
import { Sun, Moon, Palette, Check, Wallet, Plus, ArrowUpRight, Target } from "lucide-react";

const themesList = [
  { id: "original", name: "Original", bg: "#f1f5f9", accent: "#3b82f6" },
  { id: "midnight-ledger", name: "Midnight Ledger", bg: "#0f172a", accent: "#eab308" },
  { id: "sage-paper", name: "Sage Paper", bg: "#f7f6f0", accent: "#1e3f20" },
  { id: "terminal", name: "Terminal", bg: "#050c05", accent: "#22c55e" },
  { id: "coral-bloom", name: "Coral Bloom", bg: "#fdf8f6", accent: "#e15a3e" },
];

export default function Settings() {
  const { theme, setTheme, mode, setMode, toggleMode } = useTheme();

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Settings</h1>
        <p className="text-muted-foreground font-body">Manage your account preferences and theme settings.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Theme Settings Form */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm lg:col-span-2 space-y-6 text-card-foreground">
          <div>
            <h2 className="text-lg font-bold flex items-center space-x-2 font-display">
              <Palette className="h-5 w-5 text-primary" />
              <span>Appearance Settings</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-1 font-body">
              Customize the look and feel of your FinanceFlow space. Changes are applied instantly and synced to your profile.
            </p>
          </div>

          <hr className="border-border" />

          {/* Toggle Light / Dark Mode */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-display">Interface Mode</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setMode("light")}
                className={`flex items-center justify-between rounded-xl border p-4 font-bold transition-all ${
                  mode === "light"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:bg-secondary text-foreground"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Sun className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-body">Light Mode</span>
                </div>
                {mode === "light" && <Check className="h-4 w-4" />}
              </button>

              <button
                onClick={() => setMode("dark")}
                className={`flex items-center justify-between rounded-xl border p-4 font-bold transition-all ${
                  mode === "dark"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:bg-secondary text-foreground"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Moon className="h-5 w-5 text-indigo-400" />
                  <span className="text-sm font-body">Dark Mode</span>
                </div>
                {mode === "dark" && <Check className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Swatch List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-display">Active Color Palette</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {themesList.map((t) => {
                const isActive = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex items-center justify-between rounded-xl border p-4 text-left transition-all ${
                      isActive
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-border hover:bg-secondary text-foreground"
                    }`}
                  >
                    <div className="flex items-center space-x-3.5">
                      <span
                        className="flex h-9 w-9 shrink-0 rounded-full border border-border/40 shadow-inner"
                        style={{
                          background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)`,
                        }}
                      />
                      <div>
                        <h4 className="text-sm font-bold font-display">{t.name}</h4>
                        <p className="text-[10px] text-muted-foreground font-body">
                          {t.id === "original" && "Classic Indigo workspace"}
                          {t.id === "midnight-ledger" && "Serif text and gold accents"}
                          {t.id === "sage-paper" && "Soothing cream and forest green"}
                          {t.id === "terminal" && "Monospace retro trading console"}
                          {t.id === "coral-bloom" && "Playful warmth and modern curves"}
                        </p>
                      </div>
                    </div>
                    {isActive && <Check className="h-5 w-5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-display">Live Preview</h3>
          
          {/* Main Preview Container */}
          <div className="rounded-xl border border-border bg-background p-6 shadow-md space-y-5 text-foreground transition-all duration-300">
            {/* Nav Swatch Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <div className="h-6 w-6 rounded-lg bg-primary" />
                <span className="text-sm font-extrabold tracking-tight font-display">FinanceFlow</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="h-6 w-6 rounded-full bg-secondary" />
                <span className="h-2 w-12 rounded bg-muted" />
              </div>
            </div>

            {/* Stat Card Preview */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-body">
                <span>Monthly Net Balance</span>
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-display">₹45,280</span>
                <span className="text-[10px] text-emerald-600 font-bold flex items-center bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">
                  <ArrowUpRight className="h-3 w-3 mr-0.5" /> +12%
                </span>
              </div>
            </div>

            {/* Savings Goal Progress Preview */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground font-display">Car Savings Goal</span>
                <span className="text-[10px] font-bold text-primary font-body">75%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div className="h-2 rounded-full bg-primary" style={{ width: "75%" }} />
              </div>
              <div className="flex justify-between items-center text-[10px] text-muted-foreground font-body">
                <span>₹1,50,000 saved</span>
                <span>of ₹2,00,000 target</span>
              </div>
            </div>

            {/* Mock Chart Indicator */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-2.5">
              <span className="text-xs font-bold text-foreground font-display">Cashflow Breakdown</span>
              <div className="flex space-x-2 items-end h-16 pt-2 justify-center">
                <div className="w-6 bg-primary rounded-t h-[60%]" />
                <div className="w-6 bg-primary/75 rounded-t h-[40%]" />
                <div className="w-6 bg-primary/50 rounded-t h-[80%]" />
                <div className="w-6 bg-secondary rounded-t h-[30%]" />
              </div>
            </div>

            {/* Action Buttons Swatches */}
            <div className="flex gap-2">
              <button className="flex-1 bg-primary text-primary-foreground font-bold py-2 rounded-lg text-xs shadow-sm hover:opacity-90 font-body flex items-center justify-center space-x-1">
                <Plus className="h-3.5 w-3.5" />
                <span>Save Funds</span>
              </button>
              <button className="flex-1 bg-secondary text-secondary-foreground font-bold py-2 rounded-lg text-xs border border-border hover:opacity-90 font-body">
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
