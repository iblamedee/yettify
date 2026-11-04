"use client";

import React from "react";
import { MediaHeader } from "./MediaHeader";
import { useLibrary } from "@/contexts/LibraryContext";

interface AlbumHeaderClientProps {
  album: any;
  totalDurationSeconds: number;
}

export function AlbumHeaderClient({ album, totalDurationSeconds }: AlbumHeaderClientProps) {
  const { isAlbumSaved, toggleSaveAlbum } = useLibrary();
  const isSaved = isAlbumSaved(album.id);

  return (
    <MediaHeader
      type="Album"
      title={album.title}
      coverUrl={album.coverUrl}
      creatorName={album.artist?.name}
      creatorAvatar={album.artist?.avatarUrl}
      creatorId={album.artistId}
      creatorType="artist"
      releaseYear={album.releaseYear}
      trackCount={album.tracks?.length || 0}
      totalDurationSeconds={totalDurationSeconds}
      tracks={album.tracks || []}
      isSaved={isSaved}
      onToggleSave={() => toggleSaveAlbum(album.id, album)}
      gradientColor="rgba(40, 60, 90, 0.7)"
    />
  );
}
