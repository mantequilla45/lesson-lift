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
        <button className="flex items-center gap-2 px-4 py-2 border border-line rounded-2xl text-sm font-semibold transition-colors hover:bg-gray-50">
          Connect Storage
          <ChevronDown className="w-4 h-4 text-muted" />
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded-2xl border border-line bg-white hover:bg-gray-50 transition-colors">
          <Bell className="w-4 h-4 text-muted" />
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded-2xl border border-line bg-white hover:bg-gray-50 transition-colors">
          <UserCircle className="w-5 h-5 text-muted" />
        </button>
      </div>
    </header>
  );
}
