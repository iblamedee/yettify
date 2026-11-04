"use client";

import React from "react";
import { useUI } from "@/contexts/UIContext";

export function ContextMenu() {
  const { contextMenu, closeContextMenu } = useUI();

  if (!contextMenu.isOpen || contextMenu.items.length === 0) return null;

  return (
    <div
      className="fixed z-[9990] min-w-[200px] max-w-[280px] bg-[#282828] border border-[#3e3e3e] rounded-md shadow-2xl py-1 text-sm text-[#e0e0e0] animate-in fade-in zoom-in-95 duration-100"
      style={{
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {contextMenu.items.map((item, idx) => {
        if (item.divider) {
          return <div key={idx} className="h-px bg-[#3e3e3e] my-1" />;
        }

        return (
          <button
            key={idx}
            className={`w-full text-left px-3.5 py-2 flex items-center justify-between hover:bg-[#3e3e3e] hover:text-white transition-colors ${
              item.destructive ? "text-red-400 hover:text-red-300" : ""
            }`}
            onClick={() => {
              item.onClick(contextMenu.targetData);
              closeContextMenu();
            }}
          >
            <div className="flex items-center gap-2.5">
              {item.icon && <span className="text-[#b3b3b3]">{item.icon}</span>}
              <span>{item.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
