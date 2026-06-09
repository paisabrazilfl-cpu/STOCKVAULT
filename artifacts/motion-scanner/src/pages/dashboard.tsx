import { Link } from "wouter";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatNumber, formatPercent } from "@/lib/format";
import { Activity, Target, Gauge, Compass, ServerOff, BarChart2, Bot } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: typeof Activity;
  accent?: string;
}

function StatCard({ label, value, icon: Icon, accent }: StatCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
          <Icon className={`h-4 w-4 ${accent ?? "text-muted-foreground"}`} />
        </div>
        <div className={`text-2xl font-mono mt-2 ${accent ?? ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { data: summary, isLoading, isError } = useGetDashboardSummary();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">A quick snapshot of your scanning activity.</p>
      </div>

      {/* Friendly server-down state instead of silently showing zeros */}
      {isError && (
        <Card className="border-yellow-500/40 bg-yellow-50">
          <CardContent className="py-5">
            <div className="flex items-start gap-3">
              <ServerOff className="h-5 w-5 text-yellow-700 mt-0.5 shrink-0" />
              <div className="space-y-2">
                <div className="font-semibold text-yellow-900">We couldn't load your data yet</div>
                <p className="text-sm text-yellow-800">
                  The server may still be starting up, or it needs to be connected. Your numbers will appear here
                  automatically once it's online. In the meantime you can add your AI key in Settings.
                </p>
                <Link href="/settings">
                  <Button size="sm" variant="outline" className="mt-1">Go to Settings</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Scans" value={formatNumber(summary?.totalScans ?? 0)} icon={Activity} />
        <StatCard label="Avg GO Count" value={formatNumber(summary?.avgGoCount ?? 0)} icon={Target} accent="text-[hsl(var(--go-color))]" />
        <StatCard label="Avg Score" value={formatPercent(summary?.avgScore ?? 0)} icon={Gauge} />
        <StatCard label="Last Regime" value={summary?.lastRegime || "—"} icon={Compass} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider">Top Tickers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Ticker</TableHead>
                  <TableHead className="text-right">GO Count</TableHead>
                  <TableHead className="text-right">Avg Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary?.topTickers?.map((t) => (
                  <TableRow key={t.ticker} className="border-border">
                    <TableCell className="font-bold">{t.ticker}</TableCell>
                    <TableCell className="text-right text-[hsl(var(--go-color))]">{t.goCount}</TableCell>
                    <TableCell className="text-right">{formatPercent(t.avgScore)}</TableCell>
                  </TableRow>
                ))}
                {!summary?.topTickers?.length && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                      No scans yet — run your first one to see results here.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Quick actions — give a newcomer something obvious to do next */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider">Get started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/scanner">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors cursor-pointer">
                <BarChart2 className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="text-sm font-medium">Run a stock scan</div>
                  <div className="text-xs text-muted-foreground">Find GO / HOLD / ABORT signals on any tickers.</div>
                </div>
              </div>
            </Link>
            <Link href="/agent">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors cursor-pointer">
                <Bot className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="text-sm font-medium">Ask the AI Assistant</div>
                  <div className="text-xs text-muted-foreground">Chat with live market data — add your key in Settings first.</div>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
