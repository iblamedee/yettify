"use client";

import React from "react";
import { MediaHeader } from "./MediaHeader";
import { useLibrary } from "@/contexts/LibraryContext";

interface ArtistHeaderClientProps {
  artist: any;
}

export function ArtistHeaderClient({ artist }: ArtistHeaderClientProps) {
  const { isArtistFollowed, toggleFollowArtist } = useLibrary();
  const isFollowed = isArtistFollowed(artist.id);

  return (
    <MediaHeader
      type="Artist"
      title={artist.name}
      coverUrl={artist.avatarUrl}
      isVerified={artist.verified}
      monthlyListeners={artist.monthlyListeners}
      tracks={artist.tracks || []}
      isFollowed={isFollowed}
      onToggleFollow={() => toggleFollowArtist(artist.id, artist)}
      gradientColor="rgba(30, 70, 110, 0.7)"
    />
  );
}
