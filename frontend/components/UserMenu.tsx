"use client";

import { useState } from "react";
import { User } from "lucide-react";

type UserMenuProps = {
  name?: string | null;
};

function getInitials(name?: string | null): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function UserMenu({ name }: UserMenuProps) {
  const [open, setOpen] = useState(false);

  const initials = getInitials(name);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/80 text-slate-200 hover:border-sky-500/70 hover:text-sky-100 transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {initials ? (
          <span className="text-[11px] font-semibold">{initials}</span>
        ) : (
          <User className="h-4 w-4" />
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 z-40 mt-2 w-40 rounded-md border border-slate-800 bg-slate-950/95 py-1 text-[13px] text-slate-200 shadow-xl shadow-slate-950/60"
          role="menu"
        >
          {name && (
            <div className="px-3 pb-1 pt-1.5 text-[11px] text-slate-400 border-b border-slate-800">
              Signed in as
              <div className="truncate text-slate-100 text-[12px] font-medium">
                {name}
              </div>
            </div>
          )}
          <button
            type="button"
            className="flex w-full items-center px-3 py-1.5 text-left hover:bg-slate-800/80"
            role="menuitem"
          >
            Profile
          </button>
          <button
            type="button"
            className="flex w-full items-center px-3 py-1.5 text-left hover:bg-slate-800/80"
            role="menuitem"
          >
            Settings
          </button>
          <button
            type="button"
            className="flex w-full items-center px-3 py-1.5 text-left hover:bg-slate-800/80"
            role="menuitem"
          >
            Download data
          </button>
          <button
            type="button"
            className="mt-0.5 flex w-full items-center px-3 py-1.5 text-left text-red-300 hover:bg-red-950/40 hover:text-red-200"
            role="menuitem"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

