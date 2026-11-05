"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUI } from "@/contexts/UIContext";
import { ShieldCheck, Sliders, Volume2, Globe, Music } from "lucide-react";
import Link from "next/link";

export default function PreferencesPage() {
  const { user } = useAuth();
  const { showToast } = useUI();

  const [autoplay, setAutoplay] = useState(true);
  const [crossfadeSeconds, setCrossfadeSeconds] = useState(0);
  const [normalizeVolume, setNormalizeVolume] = useState(true);
  const [audioQuality, setAudioQuality] = useState("HIGH");
  const [explicitContent, setExplicitContent] = useState(true);
  const [language, setLanguage] = useState("en");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me/preferences")
      .then((res) => res.json())
      .then((data) => {
        const p = data.preferences;
        if (p) {
          setAutoplay(p.autoplay);
          setCrossfadeSeconds(p.crossfadeSeconds);
          setNormalizeVolume(p.normalizeVolume);
          setAudioQuality(p.audioQuality);
          setExplicitContent(!p.explicitContentFilter);
          setLanguage(p.language || "en");
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const savePreference = async (key: string, value: any) => {
    try {
      if (key === "audioQuality" && typeof window !== "undefined") {
        try {
          localStorage.setItem("spotify_audio_quality", value);
        } catch {}
      }
      await fetch("/api/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      showToast("Settings updated", "success", 1500);
    } catch {
      showToast("Failed to save setting", "error");
    }
  };

  return (
    <div className="max-w-3xl space-y-8 pb-24 text-sm">
      <h1 className="text-3xl font-extrabold text-white">Settings</h1>

      {/* Account Section */}
      <section className="bg-[#181818] rounded-xl p-6 border border-[#282828] space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <ShieldCheck size={20} className="text-spotify-green" />
          <span>Account & Subscription</span>
        </h2>

        <div className="flex items-center justify-between py-2 border-b border-[#282828]">
          <div>
            <p className="font-semibold text-white">Current Plan</p>
            <p className="text-xs text-[#b3b3b3]">
              {user ? `You are on the ${user.plan} plan.` : "You are browsing as Guest."}
            </p>
          </div>
          <Link
            href="/premium"
            className="px-5 py-2 rounded-pill bg-white text-black font-bold text-xs hover:scale-104 transition-transform shadow-md"
          >
            Manage Plan
          </Link>
        </div>
      </section>

      {/* Playback Section */}
      <section className="bg-[#181818] rounded-xl p-6 border border-[#282828] space-y-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Sliders size={20} className="text-spotify-green" />
          <span>Playback</span>
        </h2>

        {/* Autoplay */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">Autoplay</p>
            <p className="text-xs text-[#b3b3b3]">
              Enjoy nonstop listening. When your music ends, we will play similar songs.
            </p>
          </div>
          <button
            onClick={() => {
              const val = !autoplay;
              setAutoplay(val);
              savePreference("autoplay", val);
            }}
            className={`w-12 h-6 rounded-full p-1 transition-colors ${
              autoplay ? "bg-spotify-green" : "bg-[#3e3e3e]"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-black transition-transform ${
                autoplay ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Crossfade */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">Crossfade songs</p>
              <p className="text-xs text-[#b3b3b3]">
                Allows a seamless transition between tracks ({crossfadeSeconds}s)
              </p>
            </div>
            <span className="font-mono text-xs text-[#b3b3b3]">{crossfadeSeconds}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={12}
            value={crossfadeSeconds}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setCrossfadeSeconds(val);
              savePreference("crossfadeSeconds", val);
            }}
            className="w-full h-1 bg-[#3e3e3e] rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Normalize volume */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">Normalize volume</p>
            <p className="text-xs text-[#b3b3b3]">
              Set the same volume level for all songs.
            </p>
          </div>
          <button
            onClick={() => {
              const val = !normalizeVolume;
              setNormalizeVolume(val);
              savePreference("normalizeVolume", val);
            }}
            className={`w-12 h-6 rounded-full p-1 transition-colors ${
              normalizeVolume ? "bg-spotify-green" : "bg-[#3e3e3e]"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-black transition-transform ${
                normalizeVolume ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Audio Quality Section */}
      <section className="bg-[#181818] rounded-xl p-6 border border-[#282828] space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Volume2 size={20} className="text-spotify-green" />
          <span>Audio Quality</span>
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">Streaming quality</p>
            <p className="text-xs text-[#b3b3b3]">
              Higher bitrate uses more bandwidth but delivers sharper fidelity.
            </p>
          </div>
          <select
            value={audioQuality}
            onChange={(e) => {
              const val = e.target.value;
              setAudioQuality(val);
              savePreference("audioQuality", val);
            }}
            className="bg-[#282828] text-white px-3 py-1.5 rounded-md border border-[#3e3e3e] text-xs font-semibold focus:outline-none"
          >
            <option value="LOW">Low (96 kbps)</option>
            <option value="NORMAL">Normal (160 kbps)</option>
            <option value="HIGH">High (320 kbps)</option>
            <option value="VERY_HIGH">Very High (Lossless Simulation)</option>
          </select>
        </div>
      </section>

      {/* Language Section */}
      <section className="bg-[#181818] rounded-xl p-6 border border-[#282828] space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Globe size={20} className="text-spotify-green" />
          <span>Language & Region</span>
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">Language</p>
            <p className="text-xs text-[#b3b3b3]">Choose your preferred display language.</p>
          </div>
          <select
            value={language}
            onChange={(e) => {
              const val = e.target.value;
              setLanguage(val);
              savePreference("language", val);
            }}
            className="bg-[#282828] text-white px-3 py-1.5 rounded-md border border-[#3e3e3e] text-xs font-semibold focus:outline-none"
          >
            <option value="en">English</option>
            <option value="es">Español (Spanish)</option>
            <option value="fr">Français (French)</option>
            <option value="de">Deutsch (German)</option>
            <option value="ja">日本語 (Japanese)</option>
            <option value="pt">Português (Portuguese)</option>
          </select>
        </div>
      </section>
    </div>
  );
}
