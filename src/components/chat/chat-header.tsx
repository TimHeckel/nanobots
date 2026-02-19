"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Logo } from "@/components/shared/logo";

interface ChatHeaderProps {
  user: {
    id: string;
    name: string | null;
    login: string;
    avatarUrl: string | null;
  };
  org: {
    id: string;
    name: string | null;
    login: string;
    avatarUrl: string | null;
  };
  onLogout: () => void;
  isPlatformAdmin?: boolean;
}

export function ChatHeader({ user, org, onLogout, isPlatformAdmin }: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="flex-shrink-0 h-14 flex items-center justify-between px-4 md:px-6 bg-background/80 backdrop-blur-md border-b border-purple-accent/10">
      {/* Left: Logo */}
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 font-mono font-bold text-lg tracking-tight">
          <Logo size={24} />
          <span>
            <span className="text-green-neon">nano</span>
            <span className="text-foreground">bots</span>
            <span className="text-purple-accent">.sh</span>
          </span>
        </Link>
      </div>

      {/* Center: Org + live indicator */}
      <div className="flex items-center gap-2">
        {org.avatarUrl && (
          <Image
            src={org.avatarUrl}
            alt={org.login}
            width={20}
            height={20}
            className="w-5 h-5 rounded-full"
          />
        )}
        <span className="text-sm text-foreground/70 font-mono">
          {org.name ?? org.login}
        </span>
        <span className="w-2 h-2 rounded-full bg-green-neon pulse-dot" />
      </div>

      {/* Right: User dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.login}
              width={28}
              height={28}
              className="w-7 h-7 rounded-full"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-purple-accent/20 flex items-center justify-center text-xs font-mono text-purple-accent">
              {(user.name ?? user.login).charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm text-foreground/50 hidden sm:block">
            {user.name ?? user.login}
          </span>
          <svg
            className={`w-3 h-3 text-foreground/30 transition-transform ${menuOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-44 rounded-lg border border-foreground/10 bg-indigo-deep shadow-xl shadow-black/40 py-1 z-50">
            <div className="px-3 py-2 border-b border-foreground/5">
              <div className="text-xs font-mono text-foreground/70 truncate">
                {user.name ?? user.login}
              </div>
              <div className="text-[10px] font-mono text-foreground/30 truncate">
                {user.login}
              </div>
            </div>

            {isPlatformAdmin && (
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-purple-accent/70 hover:text-purple-accent hover:bg-purple-accent/5 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                Admin
              </Link>
            )}

            <button
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-foreground/40 hover:text-foreground/70 hover:bg-foreground/5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
