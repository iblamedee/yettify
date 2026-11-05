export type QualityTier = "ULTRA HD" | "HD" | "SD";

export interface QualityInfo {
  tier: QualityTier;
  bitrate: number;
  label: string;
}

/**
 * Maps a numeric or string bitrate to a standardized QualityTier:
 * - >= 320 kbps -> ULTRA HD
 * - 160 - 256 kbps -> HD
 * - <= 128 kbps -> SD
 */
export function getQualityTierFromBitrate(
  bitrate: number | string | null | undefined
): QualityTier {
  if (bitrate === null || bitrate === undefined) return "ULTRA HD";

  const num = typeof bitrate === "string" ? parseInt(bitrate, 10) : bitrate;
  if (isNaN(num)) return "ULTRA HD";

  // Handle both kbps (e.g. 320) and bps (e.g. 320000)
  const normalizedKbps = num > 1000 ? Math.round(num / 1000) : num;

  if (normalizedKbps >= 320) {
    return "ULTRA HD";
  } else if (normalizedKbps >= 160) {
    return "HD";
  } else {
    return "SD";
  }
}

/**
 * Inspects the playing audio stream URL, source, or user preference
 * to resolve the exact QualityTier and bitrate details.
 */
export function resolveStreamQuality(
  audioUrl?: string | null,
  source?: string | null,
  preferredQuality?: string | null
): QualityInfo {
  // 1. Direct JioSaavn CDN URL bitrate indicators
  if (audioUrl) {
    if (audioUrl.includes("_320.")) {
      return {
        tier: "ULTRA HD",
        bitrate: 320,
        label: "Ultra HD (320 kbps)",
      };
    }
    if (audioUrl.includes("_160.")) {
      return {
        tier: "HD",
        bitrate: 160,
        label: "HD (160 kbps)",
      };
    }
    if (audioUrl.includes("_96.")) {
      return {
        tier: "SD",
        bitrate: 96,
        label: "SD (96 kbps)",
      };
    }
  }

  // 2. YouTube audio source (standard opus/aac streams ~128 kbps)
  if (
    source === "youtube" ||
    (audioUrl && (audioUrl.includes("youtube.com") || audioUrl.includes("ytId=")))
  ) {
    return {
      tier: "SD",
      bitrate: 128,
      label: "SD (YouTube 128 kbps)",
    };
  }

  // 3. Fallback based on user streaming quality preference
  if (preferredQuality) {
    const prefUpper = preferredQuality.toUpperCase();
    if (prefUpper === "LOW") {
      return {
        tier: "SD",
        bitrate: 96,
        label: "SD (96 kbps)",
      };
    }
    if (prefUpper === "NORMAL") {
      return {
        tier: "HD",
        bitrate: 160,
        label: "HD (160 kbps)",
      };
    }
    if (prefUpper === "HIGH" || prefUpper === "VERY_HIGH") {
      return {
        tier: "ULTRA HD",
        bitrate: 320,
        label: "Ultra HD (320 kbps)",
      };
    }
  }

  // 4. Default high-fidelity playback
  return {
    tier: "ULTRA HD",
    bitrate: 320,
    label: "Ultra HD (320 kbps)",
  };
}
