"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUI } from "@/contexts/UIContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { X, Upload, Trash2, Camera } from "lucide-react";
import { PlaylistCover } from "@/components/playlist/PlaylistCover";

export function EditPlaylistModal() {
  const { activeModal, modalData, closeModal, showToast } = useUI();
  const { updatePlaylist } = useLibrary();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modalData) {
      setTitle(modalData.title || "");
      setDescription(modalData.description || "");
      setCoverUrl(modalData.coverUrl || "");
    }
  }, [modalData]);

  if (activeModal !== "edit-playlist" || !modalData) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Image must be smaller than 5MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCoverUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast("Playlist title cannot be empty", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await updatePlaylist(modalData.id, {
        title: title.trim(),
        description: description.trim(),
        coverUrl: coverUrl.trim() || "",
      });

      if (success) {
        closeModal();
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
        className="bg-[#282828] text-white w-full max-w-lg rounded-xl shadow-2xl p-6 border border-[#3e3e3e]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#3e3e3e]">
          <h2 className="text-xl font-bold">Edit details</h2>
          <button
            onClick={closeModal}
            className="text-[#b3b3b3] hover:text-white p-1 rounded-full hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div className="flex gap-4">
            {/* Artwork preview with Choose Photo on click */}
            <div className="flex flex-col items-center gap-2">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-36 h-36 bg-[#181818] rounded-md border border-[#3e3e3e] flex flex-col items-center justify-center shrink-0 overflow-hidden relative group cursor-pointer shadow-md"
                title="Click to choose a photo"
              >
                <PlaylistCover
                  coverUrl={coverUrl || null}
                  tracks={modalData.tracks}
                  title={title}
                  iconSize={40}
                  className="w-full h-full"
                />

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-bold gap-1 transition-opacity">
                  <Camera size={24} />
                  <span>Choose photo</span>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {coverUrl && (
                <button
                  type="button"
                  onClick={() => setCoverUrl("")}
                  className="text-xs text-[#b3b3b3] hover:text-red-400 flex items-center gap-1 transition-colors"
                >
                  <Trash2 size={12} />
                  <span>Remove photo</span>
                </button>
              )}
            </div>

            {/* Inputs */}
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#b3b3b3] mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#3e3e3e] border border-transparent focus:border-white focus:outline-none rounded-md text-sm text-white"
                  placeholder="Playlist name"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#b3b3b3] mb-1">
                  Cover Image URL (or upload above)
                </label>
                <input
                  type="text"
                  value={coverUrl.startsWith("data:") ? "Custom Image Uploaded" : coverUrl}
                  disabled={coverUrl.startsWith("data:")}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-[#3e3e3e] border border-transparent focus:border-white focus:outline-none rounded-md text-sm text-white disabled:opacity-60"
                  placeholder="https://images.unsplash.com/..."
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#b3b3b3] mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-[#3e3e3e] border border-transparent focus:border-white focus:outline-none rounded-md text-sm text-white resize-none"
              placeholder="Add an optional description"
            />
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
