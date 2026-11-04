"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useUI } from "@/contexts/UIContext";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  User as UserIcon,
  Sparkles,
  ExternalLink,
  Settings,
  LogOut,
  Keyboard,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

function SearchInputBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSearchQuery(urlQuery);
  }, [urlQuery]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (val.trim()) {
        router.replace(`/search?q=${encodeURIComponent(val.trim())}`);
      } else {
        router.replace(`/search`);
      }
    }, 200);
  };

  const handleClear = () => {
    setSearchQuery("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    router.replace(`/search`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-[240px] sm:max-w-xs md:max-w-none md:w-96 ml-1 md:ml-2">
      <Search
        size={18}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b3b3b3] pointer-events-none"
      />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="What do you want to play?"
        className="w-full pl-9 md:pl-10 pr-8 md:pr-9 py-2 md:py-2.5 rounded-full bg-[#242424] hover:bg-[#2a2a2a] focus:bg-[#242424] text-xs md:text-sm text-white placeholder-[#b3b3b3] focus:outline-none focus:ring-2 focus:ring-white transition-all"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 md:right-3 top-1/2 -translate-y-1/2 text-[#b3b3b3] hover:text-white p-0.5 rounded-full hover:bg-white/10 transition-colors"
          title="Clear search"
        >
          <X size={16} />
        </button>
      )}
    </form>
  );
}

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout, quickDemoLogin } = useAuth();
  const { openModal, showToast } = useUI();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isSearchPage = pathname.startsWith("/search");

  return (
    <header className="h-14 md:h-16 px-3 md:px-6 flex items-center justify-between sticky top-0 z-30 bg-[#121212]/90 backdrop-blur-md transition-colors border-b border-transparent">
      {/* Left: History Navigation & Search (if applicable) */}
      <div className="flex items-center gap-2 md:gap-3 flex-1 overflow-hidden">
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-full bg-black/70 hover:bg-black text-[#b3b3b3] hover:text-white flex items-center justify-center transition-colors disabled:opacity-50"
            title="Go back"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => router.forward()}
            className="w-8 h-8 rounded-full bg-black/70 hover:bg-black text-[#b3b3b3] hover:text-white flex items-center justify-center transition-colors disabled:opacity-50"
            title="Go forward"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Global / Inline Search Input */}
        {isSearchPage && (
          <Suspense fallback={<div className="w-full max-w-xs md:w-96 h-9 md:h-10 rounded-full bg-[#242424] ml-1 md:ml-2" />}>
            <SearchInputBar />
          </Suspense>
        )}
      </div>

      {/* Right: Actions & User Menu */}
      <div className="flex items-center gap-3">
        {/* Keyboard Shortcuts Trigger */}
        <button
          onClick={() => openModal("shortcuts")}
          className="p-2 rounded-full text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-colors"
          title="Keyboard shortcuts (Ctrl + /)"
        >
          <Keyboard size={18} />
        </button>

        {isAuthenticated && user ? (
          <div className="relative" ref={menuRef}>
            <button
              data-testid="user-menu-button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 p-1 pr-3 rounded-full bg-black/60 hover:bg-[#282828] transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-spotify-green/20 text-spotify-green flex items-center justify-center text-xs font-bold uppercase overflow-hidden">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user.displayName.charAt(0)
                )}
              </div>
              <span className="text-sm font-semibold text-white max-w-[120px] truncate">
                {user.displayName}
              </span>
            </button>

            {/* Profile Dropdown Menu */}
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-md bg-[#282828] shadow-spotify-card border border-[#3e3e3e]/50 py-1.5 z-50 text-sm">
                <Link
                  href={`/user/${user.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between px-4 py-2.5 text-white hover:bg-white/10 transition-colors"
                >
                  <span>Profile</span>
                  <ExternalLink size={14} className="text-[#b3b3b3]" />
                </Link>

                <Link
                  href="/preferences"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-white hover:bg-white/10 transition-colors"
                >
                  <Settings size={16} className="text-[#b3b3b3]" />
                  <span>Settings</span>
                </Link>

                <Link
                  href="/premium"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-white hover:bg-white/10 transition-colors"
                >
                  <Sparkles size={16} className="text-[#b3b3b3]" />
                  <span>Upgrade to Premium</span>
                </Link>

                <div className="h-[1px] bg-[#3e3e3e] my-1" />

                <button
                  data-testid="logout-button"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    showToast("Logged out successfully", "info");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[#f15e6c] hover:bg-white/10 transition-colors text-left"
                >
                  <LogOut size={16} />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* Quick Demo Login Pill for Evaluation */}
            <button
              onClick={() => {
                quickDemoLogin();
                showToast("Logged in as Demo User", "success");
              }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-spotify-green/40 text-spotify-green text-xs font-semibold hover:bg-spotify-green/10 transition-colors"
              title="1-Click Demo Login as Alex Rivers"
            >
              <ShieldCheck size={14} />
              <span>Demo Login</span>
            </button>

            <button
              onClick={() => openModal("auth", "register")}
              className="text-[#b3b3b3] hover:text-white font-bold text-sm px-4 py-2 hover:scale-105 transition-transform"
            >
              Sign up
            </button>
            <button
              onClick={() => openModal("auth", "login")}
              className="bg-white text-black font-bold text-sm px-7 py-2.5 rounded-full hover:scale-105 hover:bg-[#f0f0f0] active:scale-95 transition-all"
            >
              Log in
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
