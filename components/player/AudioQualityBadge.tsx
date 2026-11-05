"use client";

import React from "react";
import { QualityTier } from "@/lib/audioQuality";

export interface AudioQualityBadgeProps {
  tier?: QualityTier | null;
  className?: string;
  testId?: string;
}

export function AudioQualityBadge({
  tier,
  className = "",
  testId,
}: AudioQualityBadgeProps) {
  if (!tier) return null;

  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center justify-center text-[9px] font-mono font-semibold tracking-wider px-1.5 py-0.5 rounded border border-zinc-700/60 bg-zinc-800/50 text-zinc-300 uppercase select-none leading-none whitespace-nowrap shrink-0 ${className}`}
      title={`Audio Quality: ${tier}`}
    >
      {tier}
    </span>
  );
}
