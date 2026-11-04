"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface ToastItem {
  id: string;
  message: string;
  type?: "info" | "success" | "error";
  duration?: number;
}

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: (data?: any) => void;
  destructive?: boolean;
  divider?: boolean;
}

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  targetData?: any;
}

interface UIContextType {
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  isRightDrawerOpen: boolean;
  rightDrawerView: "queue" | "now-playing" | "friend-activity";
  openRightDrawer: (view?: "queue" | "now-playing" | "friend-activity") => void;
  closeRightDrawer: () => void;
  toggleRightDrawer: (view?: "queue" | "now-playing" | "friend-activity") => void;
  activeModal: string | null;
  modalData: any;
  openModal: (modalId: string, data?: any) => void;
  closeModal: () => void;
  toasts: ToastItem[];
  showToast: (message: string, type?: "info" | "success" | "error", duration?: number) => void;
  contextMenu: ContextMenuState;
  showContextMenu: (e: React.MouseEvent, items: ContextMenuItem[], targetData?: any) => void;
  closeContextMenu: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidthState] = useState<number>(280);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState<boolean>(false);
  const [rightDrawerView, setRightDrawerView] = useState<"queue" | "now-playing" | "friend-activity">("queue");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [modalData, setModalData] = useState<any>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    items: [],
  });

  // Restore sidebar width from localStorage
  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem("spotify_sidebar_width");
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (parsed >= 240 && parsed <= 420) {
          setSidebarWidthState(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const setSidebarWidth = (width: number) => {
    const clamped = Math.max(240, Math.min(420, width));
    setSidebarWidthState(clamped);
    try {
      localStorage.setItem("spotify_sidebar_width", clamped.toString());
    } catch {
      // ignore
    }
  };

  const openRightDrawer = (view: "queue" | "now-playing" | "friend-activity" = "queue") => {
    setRightDrawerView(view);
    setIsRightDrawerOpen(true);
  };

  const closeRightDrawer = () => {
    setIsRightDrawerOpen(false);
  };

  const toggleRightDrawer = (view: "queue" | "now-playing" | "friend-activity" = "queue") => {
    if (isRightDrawerOpen && rightDrawerView === view) {
      setIsRightDrawerOpen(false);
    } else {
      setRightDrawerView(view);
      setIsRightDrawerOpen(true);
    }
  };

  const openModal = (modalId: string, data?: any) => {
    setModalData(data || null);
    setActiveModal(modalId);
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalData(null);
  };

  const showToast = (message: string, type: "info" | "success" | "error" = "info", duration = 3500) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  };

  const showContextMenu = (e: React.MouseEvent, items: ContextMenuItem[], targetData?: any) => {
    e.preventDefault();
    e.stopPropagation();

    // Clamp coordinates to viewport
    const menuWidth = 220;
    const menuHeight = items.length * 36 + 20;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    setContextMenu({
      isOpen: true,
      x,
      y,
      items,
      targetData,
    });
  };

  const closeContextMenu = () => {
    if (contextMenu.isOpen) {
      setContextMenu((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // Close context menu on global click or Escape
  useEffect(() => {
    const handleGlobalClick = () => closeContextMenu();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeContextMenu();
        closeModal();
      }
    };

    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu.isOpen]);

  return (
    <UIContext.Provider
      value={{
        sidebarWidth,
        setSidebarWidth,
        isRightDrawerOpen,
        rightDrawerView,
        openRightDrawer,
        closeRightDrawer,
        toggleRightDrawer,
        activeModal,
        modalData,
        openModal,
        closeModal,
        toasts,
        showToast,
        contextMenu,
        showContextMenu,
        closeContextMenu,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used within UIProvider");
  return context;
}
