import React from 'react';
import { useRunScreener, getRunScreenerQueryKey } from "@workspace/api-client-react";
import type { CandidateRecord } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const ALEX_PARAMS = {
  priceMin: 2,
  priceMax: 50,
  mom1mMin: 0.05,
  nearHigh52wPct: 0.20,
};

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
      enabled: false,
      retry: 1,
      queryKey: getRunScreenerQueryKey(ALEX_PARAMS),
    },
  });

  const candidates: CandidateRecord[] = (data?.results ?? []).filter((c) => {
    const tech = c.technical as Record<string, unknown> | null ?? {};
    const high52w = Number(tech.high52w ?? 0);
    const low52w  = Number(tech.low52w  ?? 0);
    return high52w > 0 && low52w > 0 && high52w / low52w >= 1.5;
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-[hsl(var(--go-color))]" />
            Alex's Screener
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            1.5× 52w Range · $2–$50 · ≥5% MoM · ≤20% from High
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="font-mono text-xs tracking-widest shrink-0"
        >
          {isFetching ? "SCANNING..." : "▶  RUN"}
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

        {/* Empty prompt */}
        {!isFetching && !error && !data && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Click ▶ RUN to scan live market data for Alex preset candidates.
          </p>
        )}

        {/* No results */}
        {!isFetching && data && candidates.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No tickers matched all criteria right now — try again during market hours.
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
