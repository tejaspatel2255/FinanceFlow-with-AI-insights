import { useState } from "react";
import { LogOut, User, Sun, Moon, Palette, Check } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useNavigate } from "react-router-dom";

const themesList = [
  { id: "original", name: "Original", bg: "#f1f5f9", accent: "#3b82f6" },
  { id: "midnight-ledger", name: "Midnight Ledger", bg: "#0f172a", accent: "#eab308" },
  { id: "sage-paper", name: "Sage Paper", bg: "#f7f6f0", accent: "#1e3f20" },
  { id: "terminal", name: "Terminal", bg: "#050c05", accent: "#22c55e" },
  { id: "coral-bloom", name: "Coral Bloom", bg: "#fdf8f6", accent: "#e15a3e" },
];

export default function Navbar() {
  const { user, signOut } = useAuth();
  const { theme, setTheme, mode, toggleMode } = useTheme();
  const navigate = useNavigate();
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const displayName = user?.user_metadata?.name || user?.email?.split("@")[0] || "User";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/85 backdrop-blur-md text-card-foreground">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Logo and App Title */}
        <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => navigate("/dashboard")}>
          <img
            src="/logo.png"
            alt="FinanceFlow Logo"
            className="h-9 w-9 rounded-xl object-cover border border-border shadow-sm"
          />
          <span className="text-xl font-extrabold bg-gradient-to-r from-primary to-primary bg-clip-text text-transparent tracking-tight font-display">
            FinanceFlow
          </span>
        </div>

        {/* Controls and Profile */}
        <div className="flex items-center space-x-3.5">
          {/* Light/Dark Toggle */}
          <button
            onClick={toggleMode}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-transparent text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
            title="Toggle Light/Dark Mode"
          >
            {mode === "light" ? (
              <Moon className="h-4.5 w-4.5 transition-transform duration-300 hover:rotate-12" />
            ) : (
              <Sun className="h-4.5 w-4.5 transition-transform duration-300 hover:rotate-45" />
            )}
          </button>

          {/* Theme Dropdown Swatch Picker */}
          <div className="relative">
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground transition-all hover:bg-secondary hover:text-foreground ${
                showThemeMenu 
                  ? "border-primary bg-primary/5 text-primary" 
                  : "border-border"
              }`}
              title="Select Color Theme"
            >
              <Palette className="h-4.5 w-4.5" />
            </button>

            {showThemeMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowThemeMenu(false)}
                />
                
                <div className="absolute right-0 mt-2.5 w-56 rounded-xl border border-border bg-card p-3 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <h4 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mb-2.5 px-1 font-display">
                    Select Theme
                  </h4>
                  <div className="space-y-1">
                    {themesList.map((t) => {
                      const isActive = theme === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setTheme(t.id);
                            setShowThemeMenu(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-bold transition-all ${
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-secondary"
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <span 
                              className="flex h-5 w-5 shrink-0 rounded-full border border-border/40 shadow-inner"
                              style={{
                                background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)`
                              }}
                            />
                            <span className="font-body">{t.name}</span>
                          </div>
                          {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User Profile Info */}
          <div className="flex items-center space-x-2 rounded-full bg-secondary py-1.5 px-3 text-secondary-foreground">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary">
              <User className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-bold max-w-[100px] truncate font-body">
              {displayName}
            </span>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-all hover:bg-secondary hover:text-rose-600 font-body"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
