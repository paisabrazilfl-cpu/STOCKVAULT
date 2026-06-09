import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { AUTH_ENABLED } from "@/lib/auth";
import {
  Activity,
  BarChart2,
  Briefcase,
  Settings,
  History,
  List,
  ShieldAlert,
  Newspaper,
  StickyNote,
  CandlestickChart,
  Bot,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Grouped nav so the 12 destinations read as a few small, scannable clusters
// instead of one long list — much easier for a newcomer to find their way.
const NAV_SECTIONS: { title: string; items: { href: string; label: string; icon: typeof Activity }[] }[] = [
  {
    title: "Analyze",
    items: [
      { href: "/", label: "Dashboard", icon: Activity },
      { href: "/scanner", label: "Stock Finder", icon: BarChart2 },
      { href: "/charts", label: "Charts", icon: CandlestickChart },
      { href: "/agent", label: "AI Assistant", icon: Bot },
      { href: "/sector", label: "Sector Rotation", icon: BarChart2 },
    ],
  },
  {
    title: "Organize",
    items: [
      { href: "/watchlists", label: "Watchlists", icon: List },
      { href: "/notes", label: "Notes", icon: StickyNote },
      { href: "/news", label: "News", icon: Newspaper },
    ],
  },
  {
    title: "Trade & Records",
    items: [
      { href: "/broker", label: "Broker", icon: Briefcase },
      { href: "/history", label: "History", icon: History },
      { href: "/audit", label: "Audit Logs", icon: ShieldAlert },
    ],
  },
];

// Single-tenant footer shown when Clerk auth isn't configured. Renders no Clerk
// hooks, so it's safe to mount without a ClerkProvider ancestor.
function DemoUserMenu() {
  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-primary/15 border border-border flex items-center justify-center text-xs font-bold text-primary shrink-0">
          M
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate text-foreground">Motion Scanner</div>
          <div className="text-xs text-muted-foreground truncate">Single-tenant mode</div>
        </div>
      </div>
    </div>
  );
}

function ClerkUserMenu() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  if (!isLoaded || !user) return null;

  const initial =
    user.firstName?.[0] ??
    user.emailAddresses[0]?.emailAddress?.[0]?.toUpperCase() ??
    "U";

  const displayName =
    user.fullName ??
    user.firstName ??
    user.emailAddresses[0]?.emailAddress ??
    "User";

  const email = user.emailAddresses[0]?.emailAddress ?? "";

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-2 group">
        <div className="w-7 h-7 rounded-full bg-primary/15 border border-border flex items-center justify-center text-xs font-bold text-primary shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate text-foreground">{displayName}</div>
          <div className="text-xs text-muted-foreground truncate">{email}</div>
        </div>
        <button
          onClick={() => signOut({ redirectUrl: basePath || "/" })}
          title="Sign out"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground shrink-0"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const settingsActive = location === "/settings";

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden text-sm">
      <nav className="w-60 border-r border-border bg-sidebar flex flex-col">
        {/* Brand */}
        <div className="px-4 h-14 border-b border-border flex items-center gap-2.5 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Activity className="h-4 w-4 text-[hsl(var(--go-color))]" />
          </div>
          <div className="leading-tight">
            <div className="font-bold tracking-tight text-[15px]">STOCKVAULT</div>
            <div className="text-[10px] text-muted-foreground">Motion Scanner v3.0</div>
          </div>
        </div>

        {/* Grouped navigation */}
        <div className="flex-1 overflow-y-auto py-3">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="px-3 mb-4">
              <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.title}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location === item.href;
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link href={item.href}>
                        <div
                          className={cn(
                            "relative flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                          )}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />
                          )}
                          <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                          {item.label}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Settings pinned at the bottom of the nav */}
        <div className="px-3 pb-2">
          <Link href="/settings">
            <div
              className={cn(
                "relative flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer",
                settingsActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50",
              )}
            >
              <Settings className={cn("h-4 w-4 shrink-0", settingsActive ? "text-primary" : "text-muted-foreground")} />
              Settings
            </div>
          </Link>
        </div>

        {AUTH_ENABLED ? <ClerkUserMenu /> : <DemoUserMenu />}
      </nav>
      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}
