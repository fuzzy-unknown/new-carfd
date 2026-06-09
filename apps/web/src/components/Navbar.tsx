import { NavLink } from "react-router";
import { LayoutDashboard, Compass, FolderOpen, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "工作台", icon: LayoutDashboard, end: true },
  { to: "/explore", label: "探索", icon: Compass, end: false },
  { to: "/assets", label: "资产", icon: FolderOpen, end: false },
  { to: "/billing", label: "计费", icon: Receipt, end: false },
] as const;

export function Navbar() {
  return (
    <aside className="fixed left-0 top-0 z-50 h-screen w-20 border-r bg-background flex flex-col items-center py-4 gap-2">
      {/* Logo */}
      <NavLink to="/" className="mb-4">
        <img
          src="/logo.webp"
          alt="Angry Mushroom"
          className="w-12 h-12 rounded-lg object-contain"
        />
      </NavLink>

      {/* Navigation */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center rounded-md p-2 text-xs font-medium transition-colors w-16 h-14",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span className="mt-1 leading-tight">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}