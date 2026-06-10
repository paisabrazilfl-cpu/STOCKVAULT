import { useState } from "react";
import { useGetConfig, useUpdateConfig, useGetApiKeys, useUpdateApiKeys } from "@workspace/api-client-react";
import type { ScanConfig, ApiKeyStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, ExternalLink, Sparkles, KeyRound, Info } from "lucide-react";

function StatusDot({ configured }: { configured?: boolean }) {
  return configured
    ? <><CheckCircle className="h-4 w-4 text-[hsl(var(--go-color))]" /><span className="text-[hsl(var(--go-color))]">Connected</span></>
    : <><XCircle className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Not connected</span></>;
}

function num(v: unknown, fallback: number): number {
  const n = parseFloat(String(v ?? ""));
  return isNaN(n) ? fallback : n;
}

function ConfigSection({ config }: { config: ScanConfig }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const raw = config.config as Record<string, unknown>;
  const tcfg = (raw.technical ?? {}) as Record<string, unknown>;
  const rsiBand = (tcfg.rsi_band as [number, number]) ?? [30, 85];

  // ── Base thresholds ──────────────────────────────────────────────────────
  const [rsiOversold, setRsiOversold]     = useState(String(rsiBand[0]));
  const [rsiOverbought, setRsiOverbought] = useState(String(rsiBand[1]));
  const [adxThreshold, setAdxThreshold]   = useState(String(tcfg.adx_threshold ?? 25));
  const [volThreshold, setVolThreshold]   = useState(String(tcfg.volume_ratio_min ?? 1.2));
  const [emaStackReq, setEmaStackReq]     = useState(Boolean(tcfg.ema_stack_required ?? false));

  // ── EMA 10 ───────────────────────────────────────────────────────────────
  const [ema10Filter, setEma10Filter] = useState(Boolean(tcfg.ema10_filter ?? false));

  // ── SMA 20 ───────────────────────────────────────────────────────────────
  const [sma20Filter, setSma20Filter] = useState(Boolean(tcfg.sma20_filter ?? false));

  // ── Full Stochastic ───────────────────────────────────────────────────────
  const [stochFilter, setStochFilter]         = useState(Boolean(tcfg.stoch_filter ?? false));
  const [stochKPeriod, setStochKPeriod]       = useState(String(tcfg.stoch_k_period ?? 14));
  const [stochSlowPeriod, setStochSlowPeriod] = useState(String(tcfg.stoch_slow_period ?? 3));
  const [stochDPeriod, setStochDPeriod]       = useState(String(tcfg.stoch_d_period ?? 3));
  const [stochOversold, setStochOversold]     = useState(String(tcfg.stoch_oversold ?? 20));
  const [stochOverbought, setStochOverbought] = useState(String(tcfg.stoch_overbought ?? 80));

  // ── 3-Month MACD ──────────────────────────────────────────────────────────
  const [macd3mFilter, setMacd3mFilter]               = useState(Boolean(tcfg.macd3m_filter ?? false));
  const [macd3mAboveZero, setMacd3mAboveZero]         = useState(Boolean(tcfg.macd3m_require_above_zero ?? false));
  const [macd3mHistPos, setMacd3mHistPos]             = useState(Boolean(tcfg.macd3m_require_hist_positive ?? false));

  // ── Monte Carlo & Discord ─────────────────────────────────────────────────
  const [monteCarloEnabled, setMonteCarloEnabled] = useState(Boolean(raw.monte_carlo_enabled ?? true));
  const [discordEnabled, setDiscordEnabled]       = useState(Boolean(raw.discord_enabled ?? false));
  const [discordWebhook, setDiscordWebhook]       = useState(String(raw.discord_webhook ?? ""));

  const { mutate: update, isPending } = useUpdateConfig({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/config"] });
        toast({ title: "Settings saved" });
      },
    },
  });

  function handleSave() {
    update({
      data: {
        config: {
          ...raw,
          technical: {
            ...tcfg,
            rsi_band: [num(rsiOversold, 30), num(rsiOverbought, 85)],
            adx_threshold: num(adxThreshold, 25),
            volume_ratio_min: num(volThreshold, 1.2),
            ema_stack_required: emaStackReq,
            ema10_filter: ema10Filter,
            sma20_filter: sma20Filter,
            stoch_filter: stochFilter,
            stoch_k_period: num(stochKPeriod, 14),
            stoch_slow_period: num(stochSlowPeriod, 3),
            stoch_d_period: num(stochDPeriod, 3),
            stoch_oversold: num(stochOversold, 20),
            stoch_overbought: num(stochOverbought, 80),
            macd3m_filter: macd3mFilter,
            macd3m_require_above_zero: macd3mAboveZero,
            macd3m_require_hist_positive: macd3mHistPos,
          },
          monte_carlo_enabled: monteCarloEnabled,
          discord_enabled: discordEnabled,
          discord_webhook: discordEnabled ? discordWebhook : "",
        },
      },
    });
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider">Scan Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* ── Base thresholds ────────────────────────────────────────────── */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Base Thresholds</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              ["RSI Oversold", rsiOversold, setRsiOversold],
              ["RSI Overbought", rsiOverbought, setRsiOverbought],
              ["ADX Threshold", adxThreshold, setAdxThreshold],
              ["RVOL Min", volThreshold, setVolThreshold],
            ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
              <div key={label} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase">{label}</Label>
                <Input value={val} onChange={(e) => setter(e.target.value)} className="font-mono h-8 text-sm" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4">
            <div>
              <div className="text-sm font-medium">Require EMA Stack (9 &gt; 21 &gt; 50)</div>
              <div className="text-xs text-muted-foreground">HOLD if price is below the EMA stack alignment</div>
            </div>
            <Switch checked={emaStackReq} onCheckedChange={setEmaStackReq} />
          </div>
        </div>

        <Separator />

        {/* ── EMA 10 ────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">EMA 10 Filter</div>
              <div className="text-xs text-muted-foreground">HOLD any ticker where close is below the 10-period EMA</div>
            </div>
            <Switch checked={ema10Filter} onCheckedChange={setEma10Filter} />
          </div>
          {ema10Filter && (
            <div className="mt-3 px-3 py-2 rounded bg-muted/20 text-xs text-muted-foreground font-mono">
              Gate: close &gt; EMA(10) → otherwise HOLD
            </div>
          )}
        </div>

        <Separator />

        {/* ── SMA 20 ────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">SMA 20 Day Filter</div>
              <div className="text-xs text-muted-foreground">HOLD any ticker trading below its 20-day simple moving average</div>
            </div>
            <Switch checked={sma20Filter} onCheckedChange={setSma20Filter} />
          </div>
          {sma20Filter && (
            <div className="mt-3 px-3 py-2 rounded bg-muted/20 text-xs text-muted-foreground font-mono">
              Gate: close &gt; SMA(20) → otherwise HOLD
            </div>
          )}
        </div>

        <Separator />

        {/* ── Full Stochastic ────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Full Stochastic Filter</div>
              <div className="text-xs text-muted-foreground">Slow %K/%D — blocks overbought / allows only oversold entries</div>
            </div>
            <Switch checked={stochFilter} onCheckedChange={setStochFilter} />
          </div>
          {stochFilter && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  ["%K Period", stochKPeriod, setStochKPeriod],
                  ["Slow %K Period", stochSlowPeriod, setStochSlowPeriod],
                  ["%D Period", stochDPeriod, setStochDPeriod],
                ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                  <div key={label} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase">{label}</Label>
                    <Input value={val} onChange={(e) => setter(e.target.value)} className="font-mono h-8 text-sm" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  ["Oversold ≤", stochOversold, setStochOversold],
                  ["Overbought ≥", stochOverbought, setStochOverbought],
                ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                  <div key={label} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase">{label}</Label>
                    <Input value={val} onChange={(e) => setter(e.target.value)} className="font-mono h-8 text-sm" />
                  </div>
                ))}
              </div>
              <div className="px-3 py-2 rounded bg-muted/20 text-xs text-muted-foreground font-mono space-y-0.5">
                <div>Slow %K({stochKPeriod},{stochSlowPeriod}) outside [{stochOversold},{stochOverbought}] → HOLD</div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* ── 3-Month MACD ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">3-Month MACD Filter</div>
              <div className="text-xs text-muted-foreground">MACD computed on last ~65 bars (≈3 trading months)</div>
            </div>
            <Switch checked={macd3mFilter} onCheckedChange={setMacd3mFilter} />
          </div>
          {macd3mFilter && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm">Require MACD Line &gt; 0</div>
                  <div className="text-xs text-muted-foreground">3M MACD must be above zero (bullish momentum)</div>
                </div>
                <Switch checked={macd3mAboveZero} onCheckedChange={setMacd3mAboveZero} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm">Require Histogram Positive</div>
                  <div className="text-xs text-muted-foreground">MACD line must be above signal line (accelerating)</div>
                </div>
                <Switch checked={macd3mHistPos} onCheckedChange={setMacd3mHistPos} />
              </div>
              <div className="px-3 py-2 rounded bg-muted/20 text-xs text-muted-foreground font-mono space-y-0.5">
                {macd3mAboveZero && <div>3M MACD &gt; 0 → otherwise HOLD</div>}
                {macd3mHistPos   && <div>3M MACD Hist &gt; 0 → otherwise HOLD</div>}
                {!macd3mAboveZero && !macd3mHistPos && <div>Filter enabled — select a condition above</div>}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* ── Monte Carlo & Notifications ────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Monte Carlo Simulation</div>
              <div className="text-xs text-muted-foreground">500-run probabilistic hold-period scoring</div>
            </div>
            <Switch checked={monteCarloEnabled} onCheckedChange={setMonteCarloEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Discord Notifications</div>
              <div className="text-xs text-muted-foreground">Send GO signals to a webhook</div>
            </div>
            <Switch checked={discordEnabled} onCheckedChange={setDiscordEnabled} />
          </div>
          {discordEnabled && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase">Discord Webhook URL</Label>
              <Input value={discordWebhook} onChange={(e) => setDiscordWebhook(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..." className="font-mono text-xs" />
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={isPending} className="w-full">
          {isPending ? "Saving..." : "Save Configuration"}
        </Button>
      </CardContent>
    </Card>
  );
}

interface ProviderRowProps {
  name: string;
  description: string;
  configured?: boolean;
  signupUrl: string;
  keyLabel: string;
  keyPlaceholder: string;
  keyValue: string;
  onKeyChange: (v: string) => void;
  secretLabel?: string;
  secretPlaceholder?: string;
  secretValue?: string;
  onSecretChange?: (v: string) => void;
  extra?: React.ReactNode;
}

function ProviderRow(p: ProviderRowProps) {
  return (
    <div className="rounded border border-border p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium">{p.name}</div>
          <div className="text-xs text-muted-foreground">{p.description}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <StatusDot configured={p.configured} />
          </div>
          <a href={p.signupUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <ExternalLink className="h-3 w-3" />Sign up
          </a>
        </div>
      </div>
      <div className={`grid gap-3 ${p.secretLabel ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase">{p.keyLabel}</Label>
          <Input type="password" value={p.keyValue} onChange={(e) => p.onKeyChange(e.target.value)}
            placeholder={p.configured ? "••••••••••••" : p.keyPlaceholder} className="font-mono text-xs" />
        </div>
        {p.secretLabel && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase">{p.secretLabel}</Label>
            <Input type="password" value={p.secretValue ?? ""} onChange={(e) => p.onSecretChange?.(e.target.value)}
              placeholder={p.configured ? "••••••••••••" : (p.secretPlaceholder ?? "")} className="font-mono text-xs" />
          </div>
        )}
      </div>
      {p.extra}
    </div>
  );
}

function ApiKeysSection({ keys, apiDown }: { keys?: ApiKeyStatus; apiDown?: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [alpacaApiKey, setAlpacaApiKey] = useState("");
  const [alpacaSecretKey, setAlpacaSecretKey] = useState("");
  const [alpacaPaper, setAlpacaPaper] = useState(keys?.alpacaPaper ?? true);
  const [brokerApiKey, setBrokerApiKey] = useState("");
  const [brokerSecretKey, setBrokerSecretKey] = useState("");
  const [brokerSandbox, setBrokerSandbox] = useState(keys?.alpacaBrokerSandbox ?? true);
  const [polygonApiKey, setPolygonApiKey] = useState("");
  const [finnhubApiKey, setFinnhubApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState(keys?.aiBaseUrl ?? "");
  const [aiModel, setAiModel] = useState(keys?.aiModel ?? "");

  const { mutate: update, isPending } = useUpdateApiKeys({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/api-keys"] });
        qc.invalidateQueries({ queryKey: ["/api/broker/accounts/me"] });
        toast({ title: "API keys saved", description: "All keys encrypted with AES-256-GCM." });
        setAlpacaApiKey(""); setAlpacaSecretKey(""); setBrokerApiKey(""); setBrokerSecretKey("");
        setPolygonApiKey(""); setFinnhubApiKey(""); setGeminiApiKey(""); setAiApiKey("");
      },
      onError: () => {
        toast({ title: "Could not save", description: "API server is unreachable. Keys will save once it's back online.", variant: "destructive" });
      },
    },
  });

  const aiChanged = aiApiKey || aiBaseUrl !== (keys?.aiBaseUrl ?? "") || aiModel !== (keys?.aiModel ?? "");
  const hasChanges =
    alpacaApiKey || alpacaSecretKey || brokerApiKey || brokerSecretKey || polygonApiKey || finnhubApiKey || geminiApiKey || aiChanged;

  const handleSave = () => {
    update({
      data: {
        alpacaApiKey: alpacaApiKey || undefined,
        alpacaSecretKey: alpacaSecretKey || undefined,
        alpacaPaper,
        alpacaBrokerApiKey: brokerApiKey || undefined,
        alpacaBrokerSecretKey: brokerSecretKey || undefined,
        alpacaBrokerSandbox: brokerSandbox,
        polygonApiKey: polygonApiKey || undefined,
        finnhubApiKey: finnhubApiKey || undefined,
        geminiApiKey: geminiApiKey || undefined,
        aiApiKey: aiApiKey || undefined,
        aiBaseUrl: aiBaseUrl || undefined,
        aiModel: aiModel || undefined,
      },
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Your accounts &amp; keys</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Paste a key to turn on a feature. Only the <strong>AI Engine</strong> is needed to start — the rest are optional.
            </p>
          </div>
          <Badge variant="outline" className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
            <KeyRound className="h-3 w-3" /> Encrypted
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {apiDown && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-50 p-4 text-sm text-yellow-900">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <div className="font-semibold">We can't reach the server right now</div>
                <div className="text-yellow-800">
                  That's why the <strong>Save</strong> button won't store your key yet. Nothing you typed is lost —
                  fill everything in, and as soon as the server is back online, hit Save and it will go through.
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Yahoo Finance — always active */}
        <div className="rounded border border-[hsl(var(--go-color))]/20 bg-[hsl(var(--go-color))]/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Yahoo Finance</div>
              <div className="text-xs text-muted-foreground">OHLCV data, EMA stack, RSI, ATR, RVOL, fundamentals — always active, no key needed</div>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <CheckCircle className="h-4 w-4 text-[hsl(var(--go-color))]" />
              <span className="text-[hsl(var(--go-color))]">Always active</span>
            </div>
          </div>
        </div>

        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-1">Optional — extra data (skip if unsure)</div>

        <ProviderRow
          name="Polygon.io"
          description="Optional. Adds real-time quotes and options data. Skip this if you're just starting out."
          configured={keys?.polygonConfigured}
          signupUrl="https://polygon.io"
          keyLabel="API Key"
          keyPlaceholder="Enter Polygon API key..."
          keyValue={polygonApiKey}
          onKeyChange={setPolygonApiKey}
        />

        <ProviderRow
          name="Finnhub"
          description="Optional. Adds news sentiment and earnings data. Safe to skip for now."
          configured={keys?.finnhubConfigured}
          signupUrl="https://finnhub.io"
          keyLabel="API Key"
          keyPlaceholder="Enter Finnhub API key..."
          keyValue={finnhubApiKey}
          onKeyChange={setFinnhubApiKey}
        />

        {keys?.geminiManaged ? (
          <div className="rounded border border-[hsl(var(--go-color))]/20 bg-[hsl(var(--go-color))]/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Google Gemini</div>
                <div className="text-xs text-muted-foreground">
                  Wired in via server configuration (GEMINI_API_KEY env var).
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <CheckCircle className="h-4 w-4 text-[hsl(var(--go-color))]" />
                <span className="text-[hsl(var(--go-color))]">Connected (server)</span>
              </div>
            </div>
          </div>
        ) : (
          <ProviderRow
            name="Google Gemini"
            description="AI completions, embeddings, multimodal analysis — powers the Market Analysis Agent"
            configured={keys?.geminiConfigured}
            signupUrl="https://ai.google.dev"
            keyLabel="API Key"
            keyPlaceholder="Enter Gemini API key..."
            keyValue={geminiApiKey}
            onKeyChange={setGeminiApiKey}
          />
        )}

        {/* ── AI Engine (the Market Analysis Agent's brain) ─────────────────── */}
        {keys?.aiManaged ? (
          <div className="rounded border border-[hsl(var(--go-color))]/20 bg-[hsl(var(--go-color))]/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">AI Engine</div>
                <div className="text-xs text-muted-foreground">
                  Wired in via server configuration (AI_INTEGRATIONS_OPENAI_API_KEY).
                  Model: <span className="font-mono">{keys?.aiModel}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <CheckCircle className="h-4 w-4 text-[hsl(var(--go-color))]" />
                <span className="text-[hsl(var(--go-color))]">Connected (server)</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div>
                  <div className="text-sm font-semibold">AI Engine — the brain of your AI Assistant</div>
                  <div className="text-xs text-muted-foreground">
                    This is the key the chat assistant uses to read live charts and answer your questions.
                    Add it once and the Assistant comes alive.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs shrink-0">
                <StatusDot configured={keys?.aiConfigured} />
              </div>
            </div>

            {/* Plain-English, numbered setup steps */}
            <div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
              <div className="font-semibold text-foreground">How to connect it (takes ~2 minutes)</div>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  Open{" "}
                  <a href="https://build.nvidia.com" target="_blank" rel="noopener noreferrer"
                    className="underline font-medium inline-flex items-center gap-0.5">
                    build.nvidia.com <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  and sign in (it's free).
                </li>
                <li>Click <span className="font-medium">"Get API Key"</span> and copy the key that starts with <span className="font-mono">nvapi-</span>.</li>
                <li>Paste it into the <span className="font-medium">API Key</span> box below.</li>
                <li>Leave Base URL and Model as-is (they're already filled in for you), then press <span className="font-medium">Save</span>.</li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase flex items-center gap-1.5">
                <KeyRound className="h-3 w-3" /> API Key <span className="text-muted-foreground normal-case">(paste your nvapi-… key here)</span>
              </Label>
              <Input type="password" value={aiApiKey} onChange={(e) => setAiApiKey(e.target.value)}
                placeholder={keys?.aiConfigured ? "••••••••••••" : "nvapi-…"} className="font-mono text-xs" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase">Base URL <span className="normal-case">(leave as-is)</span></Label>
                <Input value={aiBaseUrl} onChange={(e) => setAiBaseUrl(e.target.value)}
                  placeholder="https://integrate.api.nvidia.com/v1" className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase">Model <span className="normal-case">(leave as-is)</span></Label>
                <Input value={aiModel} onChange={(e) => setAiModel(e.target.value)}
                  placeholder="minimaxai/minimax-m2.7" className="font-mono text-xs" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="h-3 w-3 shrink-0" />
              Advanced: you can point this at any OpenAI-compatible service (OpenAI, Together, Groq…) by changing the Base URL and Model.
            </div>
          </div>
        )}

        {keys?.alpacaManaged ? (
          <div className="rounded border border-[hsl(var(--go-color))]/20 bg-[hsl(var(--go-color))]/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Alpaca Trading</div>
                <div className="text-xs text-muted-foreground">
                  Wired in via server configuration. To trade your own account,
                  generate API keys at alpaca.markets and run a separate instance.
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <CheckCircle className="h-4 w-4 text-[hsl(var(--go-color))]" />
                <span className="text-[hsl(var(--go-color))]">Connected (server)</span>
              </div>
            </div>
          </div>
        ) : (
          <ProviderRow
            name="Alpaca Paper Trading"
            description="Automated paper trade execution, account positions, P&L"
            configured={keys?.alpacaConfigured}
            signupUrl="https://alpaca.markets"
            keyLabel="API Key"
            keyPlaceholder="PKXXXXXXXX..."
            keyValue={alpacaApiKey}
            onKeyChange={setAlpacaApiKey}
            secretLabel="Secret Key"
            secretPlaceholder="Enter secret..."
            secretValue={alpacaSecretKey}
            onSecretChange={setAlpacaSecretKey}
            extra={
              <div className="flex items-center gap-3">
                <Switch checked={alpacaPaper} onCheckedChange={setAlpacaPaper} />
                <div>
                  <div className="text-sm">Paper Trading Mode</div>
                  <div className="text-xs text-muted-foreground">Use paper trading endpoint (recommended)</div>
                </div>
              </div>
            }
          />
        )}

        {/* ── Alpaca Broker API (per-user brokerage accounts) ───────────────── */}
        {keys?.alpacaBrokerManaged ? (
          <div className="rounded border border-[hsl(var(--go-color))]/20 bg-[hsl(var(--go-color))]/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Alpaca Broker API</div>
                <div className="text-xs text-muted-foreground">
                  Managed via server configuration. Per-user brokerage accounts are enabled.
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <CheckCircle className="h-4 w-4 text-[hsl(var(--go-color))]" />
                <span className="text-[hsl(var(--go-color))]">Connected (server)</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded border border-border p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium">Alpaca Broker API</div>
                <div className="text-xs text-muted-foreground">
                  Opens a separate brokerage account for each user (KYC onboarding, account-scoped trading).
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <StatusDot configured={keys?.alpacaBrokerConfigured} />
                </div>
                <a href="https://broker-app.alpaca.markets/" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  <ExternalLink className="h-3 w-3" />Get keys
                </a>
              </div>
            </div>

            {/* How-to instructions */}
            <div className="rounded bg-muted/20 p-3 text-xs text-muted-foreground space-y-1.5">
              <div className="font-semibold text-foreground">How to get your Broker API keys</div>
              <ol className="list-decimal list-inside space-y-1">
                <li>Sign up / log in at{" "}
                  <a href="https://broker-app.alpaca.markets/" target="_blank" rel="noopener noreferrer" className="underline">broker-app.alpaca.markets</a>.
                </li>
                <li>Open the <span className="font-mono">API Keys</span> section of the Broker dashboard.</li>
                <li>Generate a key pair — copy the <span className="font-mono">API Key ID</span> and{" "}
                  <span className="font-mono">Secret</span> (the secret is shown only once).</li>
                <li>Paste both below and keep <span className="font-medium">Sandbox</span> on for testing.</li>
                <li>Save. Keys are encrypted at rest (AES-256-GCM) and never leave this server.</li>
              </ol>
              <div className="pt-1">
                Sandbox calls hit <span className="font-mono">broker-api.sandbox.alpaca.markets</span>;
                turning Sandbox off uses live <span className="font-mono">broker-api.alpaca.markets</span> (real money).
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase">Broker API Key ID</Label>
                <Input type="password" value={brokerApiKey} onChange={(e) => setBrokerApiKey(e.target.value)}
                  placeholder={keys?.alpacaBrokerConfigured ? "••••••••••••" : "CKXXXXXXXXXXXXXXXXXX"} className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase">Broker Secret</Label>
                <Input type="password" value={brokerSecretKey} onChange={(e) => setBrokerSecretKey(e.target.value)}
                  placeholder={keys?.alpacaBrokerConfigured ? "••••••••••••" : "Enter secret..."} className="font-mono text-xs" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={brokerSandbox} onCheckedChange={setBrokerSandbox} />
              <div>
                <div className="text-sm">Sandbox Mode</div>
                <div className="text-xs text-muted-foreground">Use the Broker API sandbox (recommended for testing)</div>
              </div>
            </div>
          </div>
        )}

        <Button onClick={handleSave} disabled={isPending || !hasChanges} className="w-full">
          {isPending ? "Saving..." : "Save API Keys"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function Settings() {
  const { data: config, isLoading: configLoading, isError: configError } = useGetConfig();
  const { data: keys, isLoading: keysLoading, isError: keysError } = useGetApiKeys();

  const apiDown = configError || keysError;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your accounts here so the app can fetch data and power the AI Assistant.
          New here? You only need <strong>one</strong> thing to get started — the <strong>AI Engine</strong> key below.
        </p>
      </div>

      {/* Friendly 3-step guide for first-time users */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" /> Quick start
          </div>
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Find the <strong>AI Engine</strong> card below and paste in your free key — that's the only required step.</li>
            <li>Press <strong>Save API Keys</strong>. Your keys are encrypted and stay private.</li>
            <li>Everything else on this page is <strong>optional</strong> — add it later only if you want extra data or trading.</li>
          </ol>
        </CardContent>
      </Card>

      {/* API keys first — it's what most people come here to do */}
      {keysLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <ApiKeysSection keys={keys} apiDown={apiDown} />
      )}

      {/* Advanced scan tuning — hidden by default so newcomers aren't overwhelmed */}
      {configLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : config ? (
        <Accordion type="single" collapsible className="rounded-lg border border-border bg-card px-4">
          <AccordionItem value="advanced" className="border-0">
            <AccordionTrigger className="text-sm hover:no-underline">
              <div className="text-left">
                <div className="font-semibold">Advanced scan settings <span className="text-muted-foreground font-normal">(optional)</span></div>
                <div className="text-xs text-muted-foreground font-normal mt-0.5">
                  Fine-tune the technical rules (RSI, MACD, moving averages…). Most people can skip this.
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <ConfigSection config={config} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </div>
  );
}
