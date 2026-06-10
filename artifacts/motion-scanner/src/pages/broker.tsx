import { useState } from "react";
import {
  useGetBrokerAccount,
  useGetBrokerPositions,
  useExecuteTrades,
  useGetMyBrokerAccount,
  useGetMyBrokerPositions,
  useGetMyBrokerOrders,
  useCreateMyBrokerOrder,
  useFundMyBrokerAccount,
} from "@workspace/api-client-react";
import type { Position, BrokerOrder } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatPercent } from "@/lib/format";
import { RefreshCw } from "lucide-react";
import { BrokerOnboarding } from "./broker-onboarding";
import { TradeBasket } from "@/components/trade-basket";

// ── Funding panel: instant virtual deposit (sandbox) ─────────────────────────
function FundingPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [amount, setAmount] = useState("100000");

  const { mutate, isPending } = useFundMyBrokerAccount({
    mutation: {
      onSuccess: (r) => {
        qc.invalidateQueries({ queryKey: ["/api/broker/accounts/me"] });
        toast({ title: "Account funded", description: `Deposited $${r.amount?.toLocaleString()} — ${r.status ?? "submitted"}` });
      },
      onError: (err: any) => {
        toast({ title: "Funding failed", description: err?.message ?? "Could not deposit", variant: "destructive" });
      },
    },
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Add Funds (Sandbox)</CardTitle></CardHeader>
      <CardContent className="flex items-end gap-3">
        <div className="space-y-1.5 flex-1 max-w-xs">
          <Label className="text-xs text-muted-foreground uppercase">Virtual Deposit (USD)</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono h-8 text-sm" />
        </div>
        <Button
          onClick={() => mutate({ data: { amount: Number(amount) } })}
          disabled={isPending || !(Number(amount) > 0)}
        >
          {isPending ? "Depositing..." : "Deposit"}
        </Button>
        <p className="text-xs text-muted-foreground pb-2">
          Instantly credits virtual cash so orders can fill. Sandbox only.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Order ticket: place an order in the user's brokerage account ──────────────
function OrderTicket() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("1");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");

  const { mutate, isPending } = useCreateMyBrokerOrder({
    mutation: {
      onSuccess: (order) => {
        qc.invalidateQueries({ queryKey: ["/api/broker/accounts/me/orders"] });
        qc.invalidateQueries({ queryKey: ["/api/broker/accounts/me/positions"] });
        toast({ title: "Order submitted", description: `${order.side?.toUpperCase()} ${order.symbol} — ${order.status}` });
        setSymbol("");
      },
      onError: (err: any) => {
        toast({ title: "Order rejected", description: err?.message ?? "Could not place order", variant: "destructive" });
      },
    },
  });

  const canSubmit = symbol.trim() && Number(qty) > 0 && (type === "market" || Number(limitPrice) > 0);

  function submit() {
    mutate({
      data: {
        symbol: symbol.trim().toUpperCase(),
        qty: Number(qty),
        side,
        type,
        timeInForce: "day",
        limitPrice: type === "limit" ? Number(limitPrice) : undefined,
      },
    });
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Place Order</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase">Symbol</Label>
          <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="AAPL" className="font-mono h-8 text-sm uppercase" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase">Qty</Label>
          <Input value={qty} onChange={(e) => setQty(e.target.value)} className="font-mono h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase">Side</Label>
          <div className="flex gap-1">
            {(["buy", "sell"] as const).map((s) => (
              <Button key={s} type="button" size="sm" variant={side === s ? "default" : "outline"}
                className="flex-1 h-8" onClick={() => setSide(s)}>{s.toUpperCase()}</Button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase">Type</Label>
          <div className="flex gap-1">
            {(["market", "limit"] as const).map((t) => (
              <Button key={t} type="button" size="sm" variant={type === t ? "default" : "outline"}
                className="flex-1 h-8" onClick={() => setType(t)}>{t === "market" ? "MKT" : "LMT"}</Button>
            ))}
          </div>
        </div>
        {type === "limit" ? (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase">Limit Price</Label>
            <Input value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="0.00" className="font-mono h-8 text-sm" />
          </div>
        ) : <div />}
        <div className="col-span-2 md:col-span-5">
          <Button onClick={submit} disabled={!canSubmit || isPending} className="w-full">
            {isPending ? "Submitting..." : `${side === "buy" ? "Buy" : "Sell"} ${symbol.trim().toUpperCase() || "—"}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Shared position table ─────────────────────────────────────────────────────
function PositionsTable({ positions }: { positions?: Position[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border">
          <TableHead>Symbol</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Entry</TableHead>
          <TableHead className="text-right">Current</TableHead>
          <TableHead className="text-right">Market Value</TableHead>
          <TableHead className="text-right">P&L</TableHead>
          <TableHead className="text-right">P&L %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {positions?.map((p: Position) => {
          const plPct = p.unrealizedPlPct ?? 0;
          const positive = p.unrealizedPl >= 0;
          return (
            <TableRow key={p.symbol} className="border-border">
              <TableCell className="font-bold">{p.symbol}</TableCell>
              <TableCell className="text-right font-mono">{p.qty}</TableCell>
              <TableCell className="text-right font-mono">{p.entryPrice !== undefined && p.entryPrice !== null ? formatCurrency(p.entryPrice) : "—"}</TableCell>
              <TableCell className="text-right font-mono">{p.currentPrice !== undefined && p.currentPrice !== null ? formatCurrency(p.currentPrice) : "—"}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(p.marketValue)}</TableCell>
              <TableCell className={`text-right font-mono ${positive ? "text-[hsl(var(--go-color))]" : "text-red-600"}`}>
                {positive ? "+" : ""}{formatCurrency(p.unrealizedPl)}
              </TableCell>
              <TableCell className={`text-right font-mono ${positive ? "text-[hsl(var(--go-color))]" : "text-red-600"}`}>
                {positive ? "+" : ""}{formatPercent(plPct)}
              </TableCell>
            </TableRow>
          );
        })}
        {!positions?.length && (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No open positions</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: "pos" | "neg" }) {
  const color = accent === "pos" ? "text-[hsl(var(--go-color))]" : accent === "neg" ? "text-red-600" : "";
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">{label}</CardTitle>
      </CardHeader>
      <CardContent><div className={`text-2xl font-mono ${color}`}>{value}</div></CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

// ── Broker API view: the user's own brokerage account ─────────────────────────
function statusTone(status?: string | null): "pos" | "neutral" {
  return status === "ACTIVE" ? "pos" : "neutral";
}

function BrokerApiAccount() {
  const { data: account, isLoading } = useGetMyBrokerAccount();
  const active = account?.status === "ACTIVE";
  const { data: positions } = useGetMyBrokerPositions({
    query: { enabled: active, queryKey: ["/api/broker/accounts/me/positions"] },
  });
  const { data: orders } = useGetMyBrokerOrders(
    { status: "all", limit: 25 },
    { query: { enabled: active, queryKey: ["/api/broker/accounts/me/orders"] } },
  );

  if (isLoading) return <LoadingState />;

  // Not onboarded yet → KYC form.
  if (account && !account.onboarded) return <BrokerOnboarding />;

  const totalPnl = positions?.reduce((s, p) => s + (p.unrealizedPl ?? 0), 0) ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Brokerage Account</h1>
        <div className="flex items-center gap-2">
          {account?.accountNumber && (
            <span className="text-xs text-muted-foreground font-mono">#{account.accountNumber}</span>
          )}
          <Badge
            variant="outline"
            className={statusTone(account?.status) === "pos"
              ? "text-[hsl(var(--go-color))] border-[hsl(var(--go-color))]/30"
              : "text-yellow-600 border-yellow-500/30"}
          >
            {account?.status ?? "UNKNOWN"}
          </Badge>
        </div>
      </div>

      {!active && (
        <div className="text-yellow-600 bg-yellow-500/10 border border-yellow-500/20 rounded p-4">
          <p className="font-bold mb-1">Account under review</p>
          <p className="text-sm">
            Your application was submitted (status: {account?.status}). Trading unlocks once Alpaca activates the account.
          </p>
        </div>
      )}

      {active && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Portfolio Value" value={formatCurrency(account?.portfolioValue ?? 0)} />
            <StatCard label="Buying Power" value={formatCurrency(account?.buyingPower ?? 0)} />
            <StatCard label="Cash" value={formatCurrency(account?.cash ?? 0)} />
            <StatCard
              label="Unrealized P&L"
              value={`${totalPnl >= 0 ? "+" : ""}${formatCurrency(totalPnl)}`}
              accent={totalPnl >= 0 ? "pos" : "neg"}
            />
          </div>

          <FundingPanel />

          <OrderTicket />

          <TradeBasket />

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Positions</CardTitle></CardHeader>
            <CardContent className="p-0"><PositionsTable positions={positions} /></CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Recent Orders</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Symbol</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Filled</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders?.map((o: BrokerOrder) => (
                    <TableRow key={o.id} className="border-border">
                      <TableCell className="font-bold">{o.symbol}</TableCell>
                      <TableCell className="uppercase">{o.side}</TableCell>
                      <TableCell>{o.type ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{o.qty ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{o.filledQty ?? 0}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{o.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {!orders?.length && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No orders yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Trading API view: single server-wired account (fallback) ──────────────────
function TradingApiBroker() {
  const { data: account, isLoading: accountLoading, error: accountError } = useGetBrokerAccount();
  const { data: positions, isLoading: posLoading } = useGetBrokerPositions();
  const { mutate: execute, isPending: executing } = useExecuteTrades({ mutation: { onSuccess: () => {} } });

  if (accountLoading || posLoading) return <LoadingState />;

  if (accountError) {
    return (
      <div className="p-6">
        <div className="text-yellow-600 bg-yellow-500/10 border border-yellow-500/20 rounded p-4">
          <p className="font-bold mb-1">Broker not connected</p>
          <p className="text-sm">Configure your Alpaca API keys in Settings to connect to paper trading.</p>
        </div>
      </div>
    );
  }

  const totalPnl = positions?.reduce((sum, p) => sum + (p.unrealizedPl ?? 0), 0) ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Broker</h1>
        <Badge variant="outline" className="text-[hsl(var(--go-color))] border-[hsl(var(--go-color))]/30">Paper Trading</Badge>
      </div>

      {account && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Portfolio Value" value={formatCurrency(account.portfolioValue)} />
          <StatCard label="Buying Power" value={formatCurrency(account.buyingPower)} />
          <StatCard label="Cash" value={formatCurrency(account.cash)} />
          <StatCard
            label="Unrealized P&L"
            value={`${totalPnl >= 0 ? "+" : ""}${formatCurrency(totalPnl)}`}
            accent={totalPnl >= 0 ? "pos" : "neg"}
          />
        </div>
      )}

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wider">Positions</CardTitle>
          <Button size="sm" variant="outline" disabled={executing} onClick={() => execute({ data: { candidates: [], dryRun: true } })}>
            <RefreshCw className={`h-4 w-4 mr-1 ${executing ? "animate-spin" : ""}`} />
            Dry Run
          </Button>
        </CardHeader>
        <CardContent className="p-0"><PositionsTable positions={positions} /></CardContent>
      </Card>
    </div>
  );
}

export function Broker() {
  // Decide which model to show: if the server has the Broker API configured,
  // use the per-user brokerage-account flow; otherwise fall back to the single
  // server-wired Trading API account.
  const { data: account, isLoading } = useGetMyBrokerAccount();

  if (isLoading) return <LoadingState />;
  if (account?.brokerEnabled) return <BrokerApiAccount />;
  return <TradingApiBroker />;
}

// Keep a default export aligned with the page module convention.
export default Broker;
