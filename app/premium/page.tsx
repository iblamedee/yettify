"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUI } from "@/contexts/UIContext";
import { Check, Sparkles } from "lucide-react";

export default function PremiumPage() {
  const { user } = useAuth();
  const { showToast, openModal } = useUI();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgrade = async (planName: string) => {
    if (!user) {
      openModal("auth");
      return;
    }

    setIsUpgrading(true);
    setSelectedPlan(planName);

    try {
      const res = await fetch("/api/me/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planName.toUpperCase() }),
      });

      if (res.ok) {
        showToast(`Successfully upgraded to Spotify ${planName}!`, "success");
        setTimeout(() => window.location.reload(), 1200);
      } else {
        showToast("Upgrade failed", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setIsUpgrading(false);
      setSelectedPlan(null);
    }
  };

  const plans = [
    {
      name: "Individual",
      price: "$11.99",
      period: "month",
      badge: "Free for 3 months",
      features: [
        "1 Premium account",
        "Cancel anytime",
        "15 hours/month of audiobook listening time",
        "Ad-free music listening",
        "Download to listen offline",
      ],
      color: "from-pink-500/20 to-purple-500/10",
      accent: "#f43f5e",
    },
    {
      name: "Duo",
      price: "$16.99",
      period: "month",
      badge: "Free for 1 month",
      features: [
        "2 Premium accounts",
        "For couples under one roof",
        "Cancel anytime",
        "Ad-free music listening",
        "Download to listen offline",
      ],
      color: "from-amber-500/20 to-orange-500/10",
      accent: "#f59e0b",
    },
    {
      name: "Family",
      price: "$19.99",
      period: "month",
      badge: "Free for 1 month",
      features: [
        "Up to 6 Premium accounts",
        "Block explicit music",
        "Spotify Kids app access",
        "Cancel anytime",
      ],
      color: "from-blue-500/20 to-cyan-500/10",
      accent: "#3b82f6",
    },
    {
      name: "Student",
      price: "$5.99",
      period: "month",
      badge: "Free for 1 month",
      features: [
        "1 verified Premium account",
        "Discount for eligible college students",
        "Cancel anytime",
      ],
      color: "from-emerald-500/20 to-teal-500/10",
      accent: "#10b981",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-12 pb-24">
      {/* Hero Header */}
      <div className="text-center space-y-4">
        <span className="text-xs font-bold uppercase tracking-widest text-spotify-green">
          Spotify Premium
        </span>
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight">
          Listen without limits.
        </h1>
        <p className="text-lg text-[#b3b3b3] max-w-xl mx-auto">
          Play millions of songs ad-free, on demand, and offline with maximum audio quality.
        </p>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((p) => {
          const isCurrent = user?.plan?.toUpperCase() === p.name.toUpperCase();
          return (
            <div
              key={p.name}
              className="bg-[#181818] border border-[#282828] rounded-2xl p-6 flex flex-col justify-between hover:border-[#3e3e3e] transition-all relative overflow-hidden"
            >
              <div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-white/10 text-white inline-block mb-4">
                  {p.badge}
                </span>

                <h3 className="text-2xl font-bold text-white mb-1">{p.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-black text-white">{p.price}</span>
                  <span className="text-xs text-[#b3b3b3]">/ {p.period}</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {p.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-[#e0e0e0]">
                      <Check size={16} className="text-spotify-green shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleUpgrade(p.name)}
                disabled={isUpgrading || isCurrent}
                className={`w-full py-3 rounded-pill font-bold text-xs uppercase tracking-wider transition-all shadow-md ${
                  isCurrent
                    ? "bg-[#282828] text-spotify-green cursor-default"
                    : "bg-spotify-green hover:bg-spotify-green-hover text-black hover:scale-102 active:scale-98"
                }`}
              >
                {isCurrent
                  ? "Current Plan"
                  : isUpgrading && selectedPlan === p.name
                  ? "Processing..."
                  : `Get ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Comparison Matrix */}
      <div className="bg-[#181818] rounded-2xl p-8 border border-[#282828]">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          Experience the difference
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-[#282828] text-xs text-[#b3b3b3] uppercase font-bold">
                <th className="py-3">What you get</th>
                <th className="py-3 text-center">Free Plan</th>
                <th className="py-3 text-center text-spotify-green">Premium</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#282828] text-[#e0e0e0]">
              <tr>
                <td className="py-3.5 font-medium">Ad-free music listening</td>
                <td className="py-3.5 text-center text-[#b3b3b3]">—</td>
                <td className="py-3.5 text-center text-spotify-green font-bold">✓</td>
              </tr>
              <tr>
                <td className="py-3.5 font-medium">Download to listen offline</td>
                <td className="py-3.5 text-center text-[#b3b3b3]">—</td>
                <td className="py-3.5 text-center text-spotify-green font-bold">✓</td>
              </tr>
              <tr>
                <td className="py-3.5 font-medium">Play songs in any order</td>
                <td className="py-3.5 text-center text-[#b3b3b3]">—</td>
                <td className="py-3.5 text-center text-spotify-green font-bold">✓</td>
              </tr>
              <tr>
                <td className="py-3.5 font-medium">High audio quality (320kbps)</td>
                <td className="py-3.5 text-center text-[#b3b3b3]">—</td>
                <td className="py-3.5 text-center text-spotify-green font-bold">✓</td>
              </tr>
              <tr>
                <td className="py-3.5 font-medium">Organize listening queue</td>
                <td className="py-3.5 text-center text-spotify-green font-bold">✓</td>
                <td className="py-3.5 text-center text-spotify-green font-bold">✓</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
