"use client";

import { ChevronDown, Bell, UserCircle } from "lucide-react";
import { CiSearch } from "react-icons/ci";

interface TopBarProps {
  title: string;
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
}

export default function TopBar({ title, showSearch = false, searchValue = "", onSearchChange }: TopBarProps) {
  return (
    <header className="flex items-center justify-between px-10 py-5 shrink-0">
      <h2 className="text-2xl font-bold shrink-0">{title}</h2>
      <div className="flex items-center gap-3">
        {showSearch && (
          <div className="relative">
            <CiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search anything"
              className="w-64 pl-9 pr-4 py-2 border border-line font-light rounded-2xl text-sm placeholder-muted focus:outline-none focus:border-line transition-all"
            />
          </div>
        )}
        <div className="relative group/storage">
          <button disabled className="flex items-center gap-2 px-4 py-2 border border-line rounded-2xl text-sm font-semibold text-muted/50 cursor-not-allowed opacity-50">
            Connect Storage
            <ChevronDown className="w-4 h-4" />
          </button>
          <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-800 px-2 py-1 text-xs text-white opacity-0 group-hover/storage:opacity-100 transition-opacity">
            Coming soon
          </span>
        </div>
        <div className="relative group/bell">
          <button disabled className="w-9 h-9 flex items-center justify-center rounded-2xl border border-line bg-white opacity-50 cursor-not-allowed">
            <Bell className="w-4 h-4 text-muted" />
          </button>
          <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-800 px-2 py-1 text-xs text-white opacity-0 group-hover/bell:opacity-100 transition-opacity">
            Coming soon
          </span>
        </div>
        <div className="relative group/profile">
          <button disabled className="w-9 h-9 flex items-center justify-center rounded-2xl border border-line bg-white opacity-50 cursor-not-allowed">
            <UserCircle className="w-5 h-5 text-muted" />
          </button>
          <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-800 px-2 py-1 text-xs text-white opacity-0 group-hover/profile:opacity-100 transition-opacity">
            Coming soon
          </span>
        </div>
      </div>
    </header>
  );
}
