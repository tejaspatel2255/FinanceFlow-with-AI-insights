import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";

/**
 * Shared container layout for authenticated dashboard pages.
 * Renders top Navbar, Left Sidebar (desktop), Mobile Bottom Nav (mobile), and active subpage.
 */
export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-all duration-300">
      {/* Top Banner Menu */}
      <Navbar />

      <div className="flex flex-1">
        {/* Left Navigation Drawer (Desktop viewports only) */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Core page canvas with padding-bottom offset for mobile sticky navigation */}
        <main className="flex-1 p-6 md:p-8 pb-20 md:pb-8 overflow-y-auto max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {/* Bottom Navigation Menu (Mobile viewports only) */}
      <MobileNav />
    </div>
  );
}
