"use client";

import React, { useEffect } from "react";
import { useUI } from "@/contexts/UIContext";
import { X, Keyboard } from "lucide-react";

export function ShortcutsModal() {
  const { activeModal, closeModal, openModal } = useUI();

  // Listen for Ctrl + / or ?
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        openModal("shortcuts");
      } else if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        openModal("shortcuts");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (activeModal !== "shortcuts") return null;

  const shortcutGroups = [
    {
      title: "Playback Controls",
      shortcuts: [
        { label: "Play / Pause", key: "Space" },
        { label: "Next track", key: "Ctrl + Right Arrow" },
        { label: "Previous track", key: "Ctrl + Left Arrow" },
        { label: "Toggle shuffle", key: "Ctrl + S" },
        { label: "Toggle repeat", key: "Ctrl + R" },
        { label: "Mute / Unmute", key: "M" },
        { label: "Volume up", key: "Ctrl + Up Arrow" },
        { label: "Volume down", key: "Ctrl + Down Arrow" },
      ],
    },
    {
      title: "Navigation & Actions",
      shortcuts: [
        { label: "Focus search input", key: "Ctrl + K / Ctrl + Shift + L" },
        { label: "Create new playlist", key: "Ctrl + N" },
        { label: "Go back / forward", key: "Alt + Left / Right" },
        { label: "Show keyboard shortcuts", key: "Ctrl + /" },
        { label: "Close modal / menu", key: "Esc" },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={closeModal}
    >
      <div
        className="bg-[#282828] text-white w-full max-w-2xl rounded-xl shadow-2xl p-6 border border-[#3e3e3e]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#3e3e3e]">
          <div className="flex items-center gap-2.5">
            <Keyboard className="text-spotify-green" size={24} />
            <h2 className="text-xl font-bold">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={closeModal}
            className="text-[#b3b3b3] hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 max-h-[65vh] overflow-y-auto pr-2">
          {shortcutGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-bold text-[#b3b3b3]">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((sc, sIdx) => (
                  <div
                    key={sIdx}
                    className="flex items-center justify-between py-1.5 border-b border-[#333333] text-sm"
                  >
                    <span className="text-[#e0e0e0]">{sc.label}</span>
                    <kbd className="px-2 py-1 bg-[#181818] border border-[#3e3e3e] rounded text-xs font-mono text-[#b3b3b3]">
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-[#3e3e3e] flex justify-end">
          <button
            onClick={closeModal}
            className="px-6 py-2 bg-white text-black font-bold rounded-pill hover:scale-104 active:scale-98 transition-transform"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
