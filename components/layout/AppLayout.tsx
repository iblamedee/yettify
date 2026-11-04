"use client";

import React, { useRef } from "react";
import { UIProvider } from "@/contexts/UIContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { LibraryProvider } from "@/contexts/LibraryContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { RightDrawer } from "./RightDrawer";
import { BottomNav } from "./BottomNav";
import { PlayerBar } from "../player/PlayerBar";
import { ToastContainer } from "../ui/ToastContainer";
import { ContextMenu } from "../ui/ContextMenu";
import { ShortcutsModal } from "../modals/ShortcutsModal";
import { EditPlaylistModal } from "../modals/EditPlaylistModal";
import { EditProfileModal } from "../modals/EditProfileModal";
import { AuthModal } from "../modals/AuthModal";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const mainScrollRef = useRef<HTMLDivElement | null>(null);

  return (
    <UIProvider>
      <AuthProvider>
        <LibraryProvider>
          <PlayerProvider>
            {/* Main Application Container */}
            <div className="flex flex-col h-screen w-screen overflow-hidden bg-black text-white select-none">
              {/* Main Content & Sidebars Body (Leaves space for bottom player & mobile bottom nav) */}
              <div className="flex-1 flex overflow-hidden p-0 md:p-2 md:gap-2 pb-[136px] md:pb-[90px]">
                {/* Resizable Sidebar */}
                <Sidebar />

                {/* Center Content Viewport with Header */}
                <main
                  ref={mainScrollRef}
                  className="flex-1 flex flex-col bg-[#121212] md:rounded-lg overflow-y-auto relative no-scrollbar"
                >
                  <TopNav />
                  <div className="flex-1 p-3 md:p-6 pt-2">{children}</div>
                </main>

                {/* Collapsible Right Panel */}
                <RightDrawer />
              </div>

              {/* Persistent Bottom Music Player */}
              <PlayerBar />

              {/* Mobile Bottom Navigation Bar */}
              <BottomNav />

              {/* Floating UI Overlays & Modals */}
              <ToastContainer />
              <ContextMenu />
              <ShortcutsModal />
              <EditPlaylistModal />
              <EditProfileModal />
              <AuthModal />
            </div>
          </PlayerProvider>
        </LibraryProvider>
      </AuthProvider>
    </UIProvider>
  );
}
