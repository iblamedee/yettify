"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Library } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  const isHome = pathname === "/";
  const isSearch = pathname.startsWith("/search");
  const isLibrary = pathname.startsWith("/collection") || pathname.startsWith("/playlist");

  return (
    <nav
      data-testid="mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#121212]/95 backdrop-blur-lg border-t border-[#282828] z-40 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom,0px)] select-none"
    >
      {/* Home Tab */}
      <Link
        href="/"
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
          isHome ? "text-white" : "text-[#b3b3b3] hover:text-white"
        }`}
      >
        <Home size={22} className={isHome ? "stroke-[2.5]" : "stroke-[1.8]"} />
        <span className={`text-[11px] mt-1 ${isHome ? "font-bold text-white" : "font-medium"}`}>
          Home
        </span>
      </Link>

      {/* Search Tab */}
      <Link
        href="/search"
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
          isSearch ? "text-white" : "text-[#b3b3b3] hover:text-white"
        }`}
      >
        <Search size={22} className={isSearch ? "stroke-[2.5]" : "stroke-[1.8]"} />
        <span className={`text-[11px] mt-1 ${isSearch ? "font-bold text-white" : "font-medium"}`}>
          Search
        </span>
      </Link>

      {/* Your Library Tab */}
      <Link
        href="/collection"
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
          isLibrary ? "text-white" : "text-[#b3b3b3] hover:text-white"
        }`}
      >
        <Library size={22} className={isLibrary ? "stroke-[2.5]" : "stroke-[1.8]"} />
        <span className={`text-[11px] mt-1 ${isLibrary ? "font-bold text-white" : "font-medium"}`}>
          Your Library
        </span>
      </Link>
    </nav>
  );
}
