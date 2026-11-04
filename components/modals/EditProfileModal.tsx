"use client";

import React, { useState, useEffect } from "react";
import { useUI } from "@/contexts/UIContext";
import { useAuth } from "@/contexts/AuthContext";
import { X, User } from "lucide-react";

export function EditProfileModal() {
  const { activeModal, closeModal, showToast } = useUI();
  const { user, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setAvatarUrl(user.avatarUrl || "");
    }
  }, [user]);

  if (activeModal !== "edit-profile" || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      showToast("Display name cannot be blank", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateProfile({
        displayName: displayName.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
      });

      if (res.success) {
        showToast("Profile updated successfully", "success");
        closeModal();
      } else {
        showToast(res.error || "Failed to update profile", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9998] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={closeModal}
    >
      <div
        className="bg-[#282828] text-white w-full max-w-md rounded-xl shadow-2xl p-6 border border-[#3e3e3e]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#3e3e3e]">
          <h2 className="text-xl font-bold">Profile details</h2>
          <button
            onClick={closeModal}
            className="text-[#b3b3b3] hover:text-white p-1 rounded-full hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-[#181818] border border-[#3e3e3e] flex items-center justify-center shrink-0 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar preview" className="w-full h-full object-cover" />
              ) : (
                <User size={32} className="text-[#b3b3b3]" />
              )}
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#b3b3b3] mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#3e3e3e] border border-transparent focus:border-white focus:outline-none rounded-md text-sm text-white"
                  placeholder="Your display name"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#b3b3b3] mb-1">
                  Avatar URL (optional)
                </label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-[#3e3e3e] border border-transparent focus:border-white focus:outline-none rounded-md text-sm text-white"
                  placeholder="https://images.unsplash.com/..."
                />
              </div>
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-2.5 bg-white hover:scale-104 active:scale-98 text-black font-bold rounded-pill transition-all"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
