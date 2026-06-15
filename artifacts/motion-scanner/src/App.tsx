import { AlexScreener } from './components/AlexScreener';
import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation, Link } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Activity, BarChart2, Bot, TrendingUp, Zap } from "lucide-react";
import { Layout } from "@/components/layout";
import { AUTH_ENABLED, HAS_REAL_CLERK_KEY, IS_REPLIT_HOST, RAW_CLERK_PUBLISHABLE_KEY } from "@/lib/auth";
import { Dashboard } from "@/pages/dashboard";
import { Scanner } from "@/pages/scanner";
import { SectorRotation } from "@/pages/sector";
import { Watchlists } from "@/pages/watchlists";
import { Broker } from "@/pages/broker";
import { History } from "@/pages/history";
import { AuditLogs } from "@/pages/audit";
import { Settings } from "@/pages/settings";
import { News } from "@/pages/news";
import { Notes } from "@/pages/notes";
import { Charts } from "@/pages/charts";
import { Agent } from "@/pages/agent";
import { MrBot } from "@/pages/mrbot";
import { FPTM } from "@/pages/fptm";
import NotFound from "@/pages/not-found";

// ── QueryClient singleton ─────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

// ── Clerk setup ───────────────────────────────────────────────────────────────

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Auth-mode detection lives in ./lib/auth (shared with the layout, no cycle).
// When AUTH_ENABLED is false the app runs single-tenant against the API's demo
// tenant fallback instead of rendering a blank screen behind a broken Clerk.
//
// With a real pk_test_/pk_live_ key we pass it through unchanged: clerk-js then
// loads from the frontend API encoded in the key, which works on ANY host
// (Render included). The publishableKeyFromHost + proxy dance is only needed on
// Replit, where Clerk is served from a clerk.<host> proxy.
const clerkPubKey = HAS_REAL_CLERK_KEY
  ? (RAW_CLERK_PUBLISHABLE_KEY as string)
  : IS_REPLIT_HOST
    ? publishableKeyFromHost(window.location.hostname, RAW_CLERK_PUBLISHABLE_KEY)
    : "";

// Only use the Replit proxy URL when we're actually relying on the Replit proxy.
const clerkProxyUrl = HAS_REAL_CLERK_KEY ? undefined : import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (AUTH_ENABLED && !clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

// ── Clerk appearance ──────────────────────────────────────────────────────────

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "top" as const,
  },
  variables: {
    colorPrimary: "#1a2d44",
    colorForeground: "#0a1628",
    colorMutedForeground: "#64748b",
    colorDanger: "#dc2626",
    colorBackground: "#ffffff",
    colorInput: "#f8fafc",
    colorInputForeground: "#0a1628",
    colorNeutral: "#e2e8f0",
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    borderRadius: "0.25rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white border border-gray-200 rounded w-[440px] max-w-full overflow-hidden shadow-lg",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-gray-900 font-bold",
    headerSubtitle: "text-gray-500",
    socialButtonsBlockButtonText: "text-gray-700 font-medium",
    formFieldLabel: "text-gray-500 text-xs uppercase tracking-wider",
    footerActionLink: "text-blue-600",
    footerActionText: "text-gray-500",
    dividerText: "text-gray-400",
    identityPreviewEditButton: "text-blue-600",
    formFieldSuccessText: "text-green-600",
    alertText: "text-gray-900",
    logoBox: "mb-2",
    logoImage: "h-9 w-auto",
    socialButtonsBlockButton: "border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700",
    formButtonPrimary: "bg-gray-900 hover:bg-gray-800 text-white",
    formFieldInput: "bg-gray-50 border-gray-200 text-gray-900 text-sm",
    footerAction: "border-t border-gray-200",
    dividerLine: "bg-gray-200",
    alert: "border-gray-200 bg-gray-50",
    otpCodeFieldInput: "bg-gray-50 border-gray-200 text-gray-900",
    formFieldRow: "",
    main: "",
  },
};

// ── Landing page (public) ─────────────────────────────────────────────────────

function LandingPage() {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground font-mono">
      <header className="border-b border-border px-8 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[hsl(var(--go-color))]" />
          <span className="font-bold tracking-tight text-sm">MOTION SCANNER</span>
        </div>
        <div className="flex gap-2">
          <Link href="/sign-in">
            <Button variant="ghost" size="sm" className="text-xs font-mono">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button size="sm" className="text-xs font-mono">Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 gap-10">
        <div className="inline-flex items-center gap-2 border border-green-500/30 rounded px-3 py-1 text-xs text-green-600">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
          Live Market Intelligence · v3.0
        </div>

        <div className="space-y-5">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
            Tri-State Stock Scanner
          </h1>
          <div className="flex items-center justify-center gap-5 text-xl font-bold">
            <span className="text-[hsl(var(--go-color))]">GO</span>
            <span className="text-border text-base">·</span>
            <span className="text-[hsl(var(--hold-color))]">HOLD</span>
            <span className="text-border text-base">·</span>
            <span className="text-[hsl(var(--abort-color))]">ABORT</span>
          </div>
          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
            RSI · ADX · EMA · Volume analysis with an AI-powered autonomous market agent.
            Multi-tenant, SOC 2-aligned, AES-256-GCM encrypted.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/sign-up">
            <Button size="lg" className="font-mono text-sm gap-2 w-full sm:w-auto">
              <Zap className="h-4 w-4" /> Get Started Free
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" className="font-mono text-sm w-full sm:w-auto">
              Sign In
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2 max-w-2xl w-full text-left">
          {[
            { Icon: BarChart2, label: "Technical Scanner", desc: "RSI, ADX, EMA composite scoring with live GO/HOLD/ABORT signals across any watchlist." },
            { Icon: Bot, label: "AI Agent", desc: "DeepSeek V4 Pro with live tool access — runs real scans, loads watchlists, and analyzes sector data autonomously." },
            { Icon: TrendingUp, label: "Sector Rotation", desc: "Live sector leadership/laggard classification and RISK_ON / RISK_OFF / NEUTRAL regime detection." },
          ].map(({ Icon, label, desc }) => (
            <div key={label} className="border border-border rounded p-4 bg-card text-left">
              <Icon className="h-4 w-4 text-primary mb-2 opacity-70" />
              <div className="text-xs font-bold text-foreground mb-1">{label}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border px-8 py-3 text-center">
        <p className="text-xs text-muted-foreground">
          Motion Scanner v3.0 · SOC 2-aligned · Powered by DeepSeek V4 Pro on NVIDIA NIM
        </p>
      </footer>
    </div>
  );
}

// ── Auth pages ────────────────────────────────────────────────────────────────

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

// ── Home: landing for signed-out, dashboard for signed-in ────────────────────

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Layout className="bg-gray-50/30">
          <Dashboard />
        </Layout>
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

// ── Cache invalidation on user change ────────────────────────────────────────

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

// ── Authenticated page routes (shared by auth + no-auth trees) ────────────────

function AuthedPages() {
  return (
    <Layout className="bg-gray-50/30">
      <Switch>
        <Route path="/scanner" component={Scanner} />
        <Route path="/sector" component={SectorRotation} />
        <Route path="/watchlists" component={Watchlists} />
        <Route path="/broker" component={Broker} />
        <Route path="/history" component={History} />
        <Route path="/audit" component={AuditLogs} />
        <Route path="/settings" component={Settings} />
        <Route path="/notes" component={Notes} />
        <Route path="/news" component={News} />
        <Route path="/charts" component={Charts} />
        <Route path="/agent" component={Agent} />
        <Route path="/mrbot" component={MrBot} />
        <Route path="/fptm" component={FPTM} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

// ── App routes (Clerk auth enabled) ───────────────────────────────────────────

function AppRoutes() {
  return (
    <Switch>
      {/* Public auth routes — must be exact pattern */}
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />

      {/* Home: landing or dashboard */}
      <Route path="/" component={HomeRedirect} />

      {/* All other routes require auth */}
      <Route>
        <>
          <Show when="signed-in">
            <AuthedPages />
          </Show>
          <Show when="signed-out">
            <Redirect to="/sign-in" />
          </Show>
        </>
      </Route>
    </Switch>
  );
}

// ── No-auth routes (single tenant; Clerk not configured) ──────────────────────

function NoAuthRoutes() {
  return (
    <Switch>
      {/* No auth: send sign-in/up straight to the app */}
      <Route path="/sign-in/*?"><Redirect to="/" /></Route>
      <Route path="/sign-up/*?"><Redirect to="/" /></Route>
      <Route path="/"><Layout className="bg-gray-50/30"><Dashboard /></Layout></Route>
      <Route><AuthedPages /></Route>
    </Switch>
  );
}

function NoAuthApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NoAuthRoutes />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to Motion Scanner",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Start scanning the market",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <AppRoutes />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

function App() {

  return (
    <WouterRouter base={basePath}>
      {AUTH_ENABLED ? <ClerkProviderWithRoutes /> : <NoAuthApp />}
    </WouterRouter>
  );
}

export default App;
