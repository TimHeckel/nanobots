"use client";

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
}

export function ChatHeader({ user, org, onLogout }: ChatHeaderProps) {
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

      {/* Right: User + logout */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.login}
              width={24}
              height={24}
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-purple-accent/20 flex items-center justify-center text-xs font-mono text-purple-accent">
              {(user.name ?? user.login).charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm text-foreground/50 hidden sm:block">
            {user.name ?? user.login}
          </span>
        </div>
        <button
          onClick={onLogout}
          className="text-xs text-foreground/30 hover:text-foreground/60 transition-colors font-mono"
        >
          logout
        </button>
      </div>
    </header>
  );
}
