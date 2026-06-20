import { NavLink } from "react-router-dom";
import { LayoutDashboard, ReceiptText, WalletCards, Target, Settings } from "lucide-react";

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
    {
      name: "Goals",
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
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-card/90 backdrop-blur-md border-t border-border shadow-lg px-2 py-2 flex items-center justify-around pb-safe text-card-foreground">
      {menuItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center space-y-0.5 py-1 px-2.5 rounded-xl transition-all font-body ${
                isActive
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              }`
            }
          >
            <Icon className="h-4.5 w-4.5" />
            <span className="text-[9px] tracking-wide">{item.name}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
