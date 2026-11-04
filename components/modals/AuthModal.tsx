"use client";

import React, { useState } from "react";
import { useUI } from "@/contexts/UIContext";
import { useAuth } from "@/contexts/AuthContext";
import { X, Sparkles, LogIn, UserPlus } from "lucide-react";

export function AuthModal() {
  const { activeModal, closeModal, showToast } = useUI();
  const { login, register, quickDemoLogin } = useAuth();

  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (activeModal !== "auth") return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (tab === "login") {
        const res = await login(email, password);
        if (!res.success) {
          setError(res.error || "Login failed");
        } else {
          showToast("Welcome back!", "success");
          closeModal();
        }
      } else {
        const res = await register(email, password, displayName);
        if (!res.success) {
          setError(res.error || "Registration failed");
        } else {
          showToast("Account created successfully!", "success");
          closeModal();
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemo = async () => {
    setIsLoading(true);
    try {
      await quickDemoLogin();
      showToast("Logged in as Alex Rivers (Demo User)", "success");
      closeModal();
    } catch {
      showToast("Demo login failed", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9998] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={closeModal}
    >
      <div
        className="bg-[#121212] text-white w-full max-w-md rounded-2xl shadow-2xl p-8 border border-[#282828] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closeModal}
          className="absolute top-5 right-5 text-[#b3b3b3] hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-spotify-green rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-black">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.502 9.722 1.113.294.18.386.563.207.857zm1.225-2.723c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.517-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.233 1.328.366.226.48.707.257 1.071zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.493.15-1.016-.129-1.166-.621-.149-.494.13-1.016.622-1.166 3.532-1.072 9.404-.865 13.115 1.338.445.264.59.838.327 1.282-.264.443-.838.59-1.28.323z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {tab === "login" ? "Log in to Spotify" : "Sign up for free"}
          </h2>
        </div>

        {/* Quick Demo Login Option */}
        <button
          type="button"
          onClick={handleDemo}
          disabled={isLoading}
          className="w-full mb-5 py-3 px-4 rounded-pill border border-[#535353] hover:border-white font-semibold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all bg-[#181818]"
        >
          <Sparkles className="text-spotify-green" size={18} />
          <span>Quick 1-Click Demo Login</span>
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-[#282828]" />
          <span className="text-xs text-[#b3b3b3] uppercase font-bold">Or</span>
          <div className="flex-1 h-px bg-[#282828]" />
        </div>

        {/* Tab switch */}
        <div className="flex bg-[#181818] rounded-lg p-1 mb-5">
          <button
            type="button"
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
              tab === "login" ? "bg-[#282828] text-white" : "text-[#b3b3b3] hover:text-white"
            }`}
            onClick={() => {
              setTab("login");
              setError(null);
            }}
          >
            Log in
          </button>
          <button
            type="button"
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
              tab === "signup" ? "bg-[#282828] text-white" : "text-[#b3b3b3] hover:text-white"
            }`}
            onClick={() => {
              setTab("signup");
              setError(null);
            }}
          >
            Sign up
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "signup" && (
            <div>
              <label className="block text-xs font-bold text-[#b3b3b3] mb-1.5">
                What should we call you?
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your profile name"
                className="w-full px-3.5 py-2.5 rounded-md bg-[#242424] border border-[#3e3e3e] focus:border-white focus:outline-none text-white text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#b3b3b3] mb-1.5">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@domain.com"
              className="w-full px-3.5 py-2.5 rounded-md bg-[#242424] border border-[#3e3e3e] focus:border-white focus:outline-none text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#b3b3b3] mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-3.5 py-2.5 rounded-md bg-[#242424] border border-[#3e3e3e] focus:border-white focus:outline-none text-white text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-spotify-green hover:bg-spotify-green-hover text-black font-bold rounded-pill shadow-md hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-2 mt-6"
          >
            {tab === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
            <span>{isLoading ? "Please wait..." : tab === "login" ? "Log In" : "Sign Up"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
