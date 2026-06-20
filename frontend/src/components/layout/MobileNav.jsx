import { NavLink } from "react-router-dom";
import { LayoutDashboard, ReceiptText, WalletCards } from "lucide-react";

/**
 * Sticky Bottom Navigation bar for mobile viewports.
 * Invisible on medium-and-above desktop viewports (md:hidden).
 */
export default function MobileNav() {
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
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/90 backdrop-blur-md border-t border-slate-200 shadow-lg px-4 py-2 flex items-center justify-around pb-safe">
      {menuItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center space-y-0.5 py-1 px-3 rounded-xl transition-all ${
                isActive
                  ? "text-primary font-bold"
                  : "text-slate-500 hover:text-slate-900 font-medium"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] tracking-wide">{item.name}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
