import { NavLink } from "react-router";
import { LayoutDashboard, Compass, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "工作台", icon: LayoutDashboard, end: true },
  { to: "/explore", label: "探索", icon: Compass, end: false },
  { to: "/billing", label: "计费", icon: Receipt, end: false },
] as const;

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
        <span className="mr-8 text-lg font-bold tracking-tight">
          Angry Mushroom
        </span>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
