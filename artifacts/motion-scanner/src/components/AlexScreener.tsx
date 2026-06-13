import React from 'react';
import { useRunScreener, getRunScreenerQueryKey } from "@workspace/api-client-react";
import type { CandidateRecord } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Zap, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const ALEX_PARAMS = {
  universe: "all" as const,
  priceMin: 1,
  priceMax: 100,
  mom1mMin: 0.02,
  nearHigh52wPct: 0.30,
  range52wMin: 1.5,
};

// NYSE regular session: Mon–Fri 9:30–16:00 ET
function getMarketStatus(): { isOpen: boolean; label: string } {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay(); // 0=Sun, 6=Sat
  const hour = et.getHours();
  const min = et.getMinutes();
  const mins = hour * 60 + min;
  const isWeekday = day >= 1 && day <= 5;
  const isDuringSession = mins >= 9 * 60 + 30 && mins < 16 * 60;
  const isOpen = isWeekday && isDuringSession;
  return { isOpen, label: isOpen ? "LIVE" : "CLOSED" };
}

function MarketStatusBadge() {
  const { isOpen, label } = getMarketStatus();
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold tracking-wide",
      isOpen
        ? "bg-[hsl(var(--go-color))]/15 text-[hsl(var(--go-color))] border-[hsl(var(--go-color))]/30"
        : "bg-muted text-muted-foreground border-border"
    )}>
      <span className={cn(
        "w-1.5 h-1.5 rounded-full",
        isOpen ? "bg-[hsl(var(--go-color))] animate-pulse" : "bg-muted-foreground"
      )} />
      {label}
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded border text-xs font-bold tracking-wide",
      verdict === "GO"    && "bg-[hsl(var(--go-color))]/20 text-[hsl(var(--go-color))] border-[hsl(var(--go-color))]/40",
      verdict === "HOLD"  && "bg-yellow-500/20 text-yellow-500 border-yellow-500/40",
      verdict === "ABORT" && "bg-red-500/20 text-red-500 border-red-500/40",
      !["GO","HOLD","ABORT"].includes(verdict) && "bg-muted text-muted-foreground border-border",
    )}>
      {verdict}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 60 ? "bg-[hsl(var(--go-color))]" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-8 text-right text-muted-foreground">{pct.toFixed(0)}</span>
    </div>
  );
}

export const AlexScreener: React.FC = () => {
  const { data, isFetching, error, refetch } = useRunScreener(ALEX_PARAMS, {
    query: {
      enabled: true,
      retry: 1,
      staleTime: 5 * 60 * 1000,
      queryKey: getRunScreenerQueryKey(ALEX_PARAMS),
    },
  });

  const candidates: CandidateRecord[] = (data?.results ?? []);

  const cachedAt = data?.cachedAt ? new Date(data.cachedAt as string) : null;
  const dataLabel = cachedAt
    ? cachedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " · " + cachedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" })
    : null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-[hsl(var(--go-color))]" />
            Alex's Screener
            <MarketStatusBadge />
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            1.5× 52w Range · $1–$100 · ≥2% MoM · ≤30% from High
            {dataLabel && (
              <span className="ml-2 text-muted-foreground/60">· {dataLabel}</span>
            )}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="font-mono text-xs tracking-widest shrink-0"
        >
          {isFetching
            ? <><RefreshCw className="h-3 w-3 animate-spin mr-1" />SCANNING</>
            : "▶  RUN"}
        </Button>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Error */}
        {error && (
          <p className="text-xs text-red-500 py-3">
            {(error as Error)?.message ?? "Failed to run screener — is the API server running?"}
          </p>
        )}

        {/* Loading skeletons */}
        {isFetching && (
          <div className="space-y-2 py-1">
            {[1,2,3,4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        )}

        {/* No results after scan */}
        {!isFetching && data && candidates.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No tickers matched all criteria in the last session's data.
            {data.scanned != null && (
              <span className="block mt-1 text-muted-foreground/60">
                Scanned {data.scanned} tickers · Yahoo Finance daily data
              </span>
            )}
          </p>
        )}

        {/* Results table */}
        {candidates.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>Ticker</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">MoM</TableHead>
                <TableHead className="text-right hidden sm:table-cell">52w Range</TableHead>
                <TableHead className="text-right hidden sm:table-cell">% from High</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((c) => {
                const tech       = c.technical as Record<string, unknown> | null ?? {};
                const price      = Number(tech.price    ?? 0);
                const mom1m      = Number(tech.mom1m    ?? 0);
                const high52w    = Number(tech.high52w  ?? 0);
                const low52w     = Number(tech.low52w   ?? 0);
                const range52w   = low52w > 0 ? high52w / low52w : 0;
                const pctFromHigh = high52w > 0 ? (high52w - price) / high52w : 0;
                const score      = Number(c.score ?? 0);
                return (
                  <TableRow key={c.ticker} className="border-border hover:bg-muted/30 cursor-default">
                    <TableCell className="font-mono font-semibold">{c.ticker}</TableCell>
                    <TableCell><VerdictBadge verdict={c.verdict} /></TableCell>
                    <TableCell><ScoreBar score={score} /></TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      ${price.toFixed(2)}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-mono text-sm",
                      mom1m >= 0 ? "text-[hsl(var(--go-color))]" : "text-red-500"
                    )}>
                      {mom1m >= 0 ? "+" : ""}{(mom1m * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm hidden sm:table-cell">
                      {range52w.toFixed(1)}×
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">
                      -{(pctFromHigh * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
