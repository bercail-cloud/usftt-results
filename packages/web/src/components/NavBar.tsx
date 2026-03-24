import { NavLink } from "react-router";
import { SyncButton } from "./SyncButton.js";

const NAV_LINKS = [
  {
    to: "/equipes",
    label: "Equipes",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: "/criterium",
    label: "Criterium",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
      >
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    ),
  },
  {
    to: "/progression",
    label: "Progression",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
      >
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
];

function desktopLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? "text-primary border-b-2 border-primary font-medium pb-1"
    : "text-text-secondary hover:text-text-primary pb-1";
}

function mobileLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    "flex flex-col items-center gap-0.5 text-[11px] py-2 px-3 transition-colors",
    isActive
      ? "text-primary font-medium"
      : "text-text-secondary active:text-text-primary",
  ].join(" ");
}

export function NavBar() {
  return (
    <>
      {/* Top bar - always visible on desktop, simplified on mobile */}
      <nav className="bg-bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
          <span className="font-bold text-primary text-lg">
            USFTT Resultats
          </span>

          {/* Desktop links */}
          <div className="hidden sm:flex items-center gap-6">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink key={to} to={to} className={desktopLinkClass}>
                {label}
              </NavLink>
            ))}
            <SyncButton />
          </div>

          {/* Mobile sync button in top bar */}
          <div className="sm:hidden">
            <SyncButton />
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-card border-t border-border safe-area-bottom">
        <div className="flex items-stretch justify-around">
          {NAV_LINKS.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} className={mobileLinkClass}>
              {icon}
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </>
  );
}
