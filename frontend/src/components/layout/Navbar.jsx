import { useState } from "react";
import { 
  LogOut, 
  User, 
  Sun, 
  Moon, 
  Palette, 
  Check,
  Bell,
  AlertTriangle,
  Target,
  TrendingUp,
  RefreshCw,
  ShieldAlert
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

const themesList = [
  { id: "original", name: "Original", bg: "#f1f5f9", accent: "#3b82f6" },
  { id: "midnight-ledger", name: "Midnight Ledger", bg: "#0f172a", accent: "#eab308" },
  { id: "sage-paper", name: "Sage Paper", bg: "#f7f6f0", accent: "#1e3f20" },
  { id: "terminal", name: "Terminal", bg: "#050c05", accent: "#22c55e" },
  { id: "coral-bloom", name: "Coral Bloom", bg: "#fdf8f6", accent: "#e15a3e" },
];

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

function getNotificationIcon(type) {
  switch (type) {
    case "budget_exceeded":
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case "goal_milestone":
      return <Target className="h-4 w-4 text-success" />;
    case "large_transaction":
      return <ShieldAlert className="h-4 w-4 text-amber-500" />;
    case "recurring_due":
      return <RefreshCw className="h-4 w-4 text-primary" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function Navbar() {
  const { user, signOut } = useAuth();
  const { theme, setTheme, mode, toggleMode } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // TanStack Query for notifications list & count
  const { data: notificationsData } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { notifications: [], unreadCount: 0 };
      const res = await fetch(`${import.meta.env.VITE_API_URL}/notifications`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 60 * 1000, // Poll every 60 seconds
  });

  const notifications = notificationsData?.notifications || [];
  const unreadCount = notificationsData?.unreadCount || 0;

  // Mutation to mark single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notifId) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/notifications/${notifId}/read`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    }
  });

  // Mutation to mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/notifications/read-all`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });
      if (!res.ok) throw new Error("Failed to mark all as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    }
  });

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      markAsReadMutation.mutate(notif.id);
    }
    setShowNotifications(false);
    
    if (notif.type === "budget_exceeded") {
      navigate("/budgets");
    } else if (notif.type === "goal_milestone") {
      navigate("/goals");
    } else if (notif.type === "large_transaction" || notif.type === "recurring_due") {
      navigate("/transactions");
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
          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowThemeMenu(false);
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground transition-all hover:bg-secondary hover:text-foreground ${
                showNotifications 
                  ? "border-primary bg-primary/5 text-primary" 
                  : "border-border"
              }`}
              title="Notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowNotifications(false)}
                />
                
                <div className="absolute right-0 mt-2.5 w-80 md:w-96 rounded-xl border border-border bg-card p-3 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between border-b border-border pb-2.5 mb-2.5 px-1">
                    <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider font-display">
                      Notifications
                    </h4>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllAsReadMutation.mutate()}
                        className="text-[10px] font-bold text-primary hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground space-y-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                          <Bell className="h-5 w-5 opacity-40" />
                        </div>
                        <p className="text-xs font-bold font-body">You're all caught up</p>
                        <p className="text-[10px] opacity-75">No new alerts or reminders</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`flex items-start gap-3 rounded-lg p-2.5 text-left text-xs transition-all cursor-pointer ${
                            !notif.is_read
                              ? "bg-primary/5 border-l-2 border-primary"
                              : "hover:bg-secondary/50 text-muted-foreground"
                          }`}
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary mt-0.5 animate-transition">
                            {getNotificationIcon(notif.type)}
                          </div>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`font-bold truncate ${!notif.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                                {notif.title}
                              </p>
                              <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                                {formatRelativeTime(notif.created_at)}
                              </span>
                            </div>
                            <p className="text-[11px] leading-relaxed break-words font-medium">
                              {notif.message}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

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
              onClick={() => {
                setShowThemeMenu(!showThemeMenu);
                setShowNotifications(false);
              }}
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
