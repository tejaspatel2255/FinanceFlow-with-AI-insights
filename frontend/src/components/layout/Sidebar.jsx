import { NavLink } from "react-router-dom";
import { LayoutDashboard, ReceiptText, WalletCards } from "lucide-react";

export default function Sidebar() {
  const menuItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Transactions",
      path: "/transactions",
      icon: ReceiptText,
    },
    {
      name: "Budgets",
      path: "/budgets",
      icon: WalletCards,
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between">
      <div className="space-y-6">
        <div className="px-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Navigation
          </p>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-primary text-white shadow-md shadow-primary/20"
                      : "text-slate-600 hover:bg-slate-50 hover:text-primary"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
        <p className="text-xs font-semibold text-slate-700">Need AI Insights?</p>
        <p className="text-[11px] text-slate-400 mt-1">
          Run reports on the backend using Gemini Flash on your dashboard.
        </p>
      </div>
    </aside>
  );
}
