interface Member {
  login: string;
  name?: string;
  avatar_url?: string;
  role: string;
}

interface Invitation {
  login?: string;
  email?: string;
  role: string;
}

interface MemberListData {
  members?: Member[];
  invitations?: Invitation[];
}

interface MemberListCardProps {
  result: unknown;
}

export function MemberListCard({ result }: MemberListCardProps) {
  const data = result as MemberListData;
  const members = data?.members ?? (Array.isArray(result) ? (result as Member[]) : []);
  const invitations = data?.invitations ?? [];

  return (
    <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4 space-y-4">
      {/* Members */}
      {members.length > 0 ? (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.login}
              className="flex items-center gap-3 rounded-lg bg-background/30 border border-purple-accent/10 px-3 py-2.5"
            >
              {member.avatar_url ? (
                <img
                  src={member.avatar_url}
                  alt={member.login}
                  className="w-7 h-7 rounded-full flex-shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-purple-accent/20 flex items-center justify-center text-xs font-mono text-purple-accent flex-shrink-0">
                  {member.login.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-foreground/70 truncate">
                    {member.login}
                  </span>
                  <span
                    className={`inline-block text-xs px-1.5 py-0.5 rounded font-mono ${
                      member.role === "admin"
                        ? "bg-purple-accent/20 text-purple-accent"
                        : "bg-foreground/10 text-foreground/40"
                    }`}
                  >
                    {member.role}
                  </span>
                </div>
                {member.name && (
                  <div className="text-xs text-foreground/40 truncate">{member.name}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-foreground/40">No members found.</div>
      )}

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="pt-3 border-t border-purple-accent/10">
          <div className="text-xs text-foreground/40 uppercase tracking-wider font-mono mb-2">
            Pending invitations
          </div>
          <div className="space-y-1.5">
            {invitations.map((inv, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm text-foreground/50"
              >
                <span className="w-2 h-2 rounded-full bg-amber-warn/60 flex-shrink-0" />
                <span className="font-mono text-xs">
                  {inv.login ?? inv.email ?? "unknown"}
                </span>
                <span className="text-xs text-foreground/30">({inv.role})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
