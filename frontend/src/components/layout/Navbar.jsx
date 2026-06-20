import { LogOut, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Logo and App Title */}
        <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => navigate("/dashboard")}>
          <img
            src="/logo.png"
            alt="FinanceFlow Logo"
            className="h-9 w-9 rounded-xl object-cover border border-slate-100 shadow-sm"
          />
          <span className="text-xl font-extrabold bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent tracking-tight">
            FinanceFlow
          </span>
        </div>

        {/* User Profile and Sign Out */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 rounded-full bg-slate-100 py-1.5 px-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary">
              <User className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-700 max-w-[120px] truncate">
              {displayName}
            </span>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 hover:text-rose-600"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
