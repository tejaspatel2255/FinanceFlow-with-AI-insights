import { NavLink } from "react-router-dom";
import { LayoutDashboard, ReceiptText, WalletCards, Target, Settings } from "lucide-react";

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
    {
      name: "Savings Goals",
      path: "/goals",
      icon: Target,
    },
    {
      name: "Settings",
      path: "/settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 border-r border-border bg-card min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between text-card-foreground">
      <div className="space-y-6">
        <div className="px-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-display">
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
                  `flex items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-all font-body ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:bg-secondary hover:text-primary"
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

      <div className="rounded-lg bg-secondary p-4 border border-border/50">
        <p className="text-xs font-bold text-foreground font-display">Need AI Insights?</p>
        <p className="text-[11px] text-muted-foreground mt-1 font-body">
          Run reports on the backend using Gemini Flash on your dashboard.
        </p>
      </div>
    </aside>
  );
}
