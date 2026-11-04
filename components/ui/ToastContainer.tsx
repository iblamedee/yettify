"use client";

import React from "react";
import { useUI } from "@/contexts/UIContext";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

export function ToastContainer() {
  const { toasts } = useUI();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none items-center">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-md bg-[#2e77d0] text-white text-sm font-medium shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 pointer-events-auto"
          style={{
            backgroundColor:
              toast.type === "success"
                ? "#1ed760"
                : toast.type === "error"
                ? "#f3727f"
                : "#2e77d0",
            color: toast.type === "success" ? "#000000" : "#ffffff",
          }}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={18} className="shrink-0" />
          ) : toast.type === "error" ? (
            <AlertCircle size={18} className="shrink-0" />
          ) : (
            <Info size={18} className="shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
