import { useState } from "react";
import { NavLink } from "react-router";
import { SyncButton } from "./SyncButton.js";

const NAV_LINKS = [
  { to: "/equipes", label: "Équipes" },
  { to: "/criterium", label: "Critérium" },
  { to: "/progression", label: "Progression" },
];

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? "text-primary border-b-2 border-primary font-medium pb-1"
    : "text-text-secondary hover:text-text-primary pb-1";
}

export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="bg-bg-card border-b border-border">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <span className="font-bold text-primary text-lg">USFTT Résultats</span>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-6">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink key={to} to={to} className={navLinkClass}>
              {label}
            </NavLink>
          ))}
          <SyncButton />
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden flex flex-col gap-1 p-2"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((prev) => !prev)}
        >
          <span className="block w-5 h-0.5 bg-text-primary" />
          <span className="block w-5 h-0.5 bg-text-primary" />
          <span className="block w-5 h-0.5 bg-text-primary" />
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-border px-4 py-2 flex flex-col gap-2">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={navLinkClass}
              onClick={() => setMobileOpen(false)}
            >
              {label}
            </NavLink>
          ))}
          <div className="pt-1">
            <SyncButton />
          </div>
        </div>
      )}
    </nav>
  );
}
