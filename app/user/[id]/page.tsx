"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { MediaHeader } from "@/components/media/MediaHeader";
import { MediaCard } from "@/components/media/MediaCard";
import { useAuth } from "@/contexts/AuthContext";
import { useUI } from "@/contexts/UIContext";
import { Playlist, User } from "@/types";

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const { user } = useAuth();
  const { openModal } = useUI();

  const [profile, setProfile] = useState<User | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/me/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        setPlaylists(data.user?.playlists || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !profile) {
    return <div className="py-20 text-center text-[#b3b3b3]">Loading profile...</div>;
  }

  const isOwner = user && user.id === profile.id;

  return (
    <div className="pb-16">
      <MediaHeader
        type="Playlist" // renders badge correctly
        title={profile.displayName}
        coverUrl={profile.avatarUrl}
        creatorName="Profile"
        onEdit={isOwner ? () => openModal("edit-profile", profile) : undefined}
        gradientColor="rgba(50, 70, 90, 0.7)"
      />

      <div className="mt-8">
        <h3 className="text-2xl font-bold text-white mb-4">Public Playlists</h3>
        {playlists.length === 0 ? (
          <p className="text-sm text-[#b3b3b3]">No public playlists yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {playlists.map((pl) => (
              <MediaCard
                key={pl.id}
                id={pl.id}
                type="playlist"
                title={pl.title}
                subtitle={`By ${profile.displayName}`}
                imageUrl={pl.coverUrl}
                tracks={pl.tracks?.map((pt: any) => pt.track || pt)}
                playContext={pl.tracks}
                targetUrl={`/playlist/${pl.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
