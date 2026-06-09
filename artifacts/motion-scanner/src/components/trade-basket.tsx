import { useState } from "react";
import {
  useListWatchlists,
  useCreateWatchlist,
  useCreateMyBrokerOrder,
} from "@workspace/api-client-react";
import type { Watchlist } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, ShoppingCart, ListPlus } from "lucide-react";

interface BasketItem {
  symbol: string;
  qty: string;
}

/**
 * Trade Basket — search/pick stocks (or pull them from a saved watchlist),
 * optionally save the picks as a new watchlist, then place market orders for
 * the whole basket in the user's Alpaca brokerage account.
 */
export function TradeBasket() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: watchlists } = useListWatchlists();

  const [items, setItems] = useState<BasketItem[]>([]);
  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("1");
  const [listName, setListName] = useState("");
  const [buying, setBuying] = useState(false);

  const { mutateAsync: placeOrder } = useCreateMyBrokerOrder();
  const { mutate: createList, isPending: savingList } = useCreateWatchlist({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/watchlists"] });
        toast({ title: "Watchlist saved", description: `${items.length} tickers saved as "${listName}".` });
        setListName("");
      },
    },
  });

  function addSymbol(raw: string, q = "1") {
    const sym = raw.trim().toUpperCase();
    if (!sym) return;
    setItems((prev) => (prev.some((i) => i.symbol === sym) ? prev : [...prev, { symbol: sym, qty: q }]));
  }

  function addFromInput() {
    addSymbol(symbol, qty.trim() || "1");
    setSymbol("");
  }

  function loadWatchlist(w: Watchlist) {
    setItems((prev) => {
      const have = new Set(prev.map((i) => i.symbol));
      const added = (w.tickers ?? [])
        .map((t) => t.toUpperCase())
        .filter((t) => !have.has(t))
        .map((t) => ({ symbol: t, qty: "1" }));
      return [...prev, ...added];
    });
    toast({ title: `Loaded "${w.name}"`, description: `${w.tickers?.length ?? 0} tickers added to basket.` });
  }

  function setQtyFor(sym: string, q: string) {
    setItems((prev) => prev.map((i) => (i.symbol === sym ? { ...i, qty: q } : i)));
  }

  function remove(sym: string) {
    setItems((prev) => prev.filter((i) => i.symbol !== sym));
  }

  async function buyAll() {
    if (!items.length) return;
    setBuying(true);
    let ok = 0;
    const failed: string[] = [];
    for (const it of items) {
      const q = Number(it.qty);
      if (!(q > 0)) { failed.push(it.symbol); continue; }
      try {
        await placeOrder({
          data: { symbol: it.symbol, qty: q, side: "buy", type: "market", timeInForce: "day" },
        });
        ok += 1;
      } catch {
        failed.push(it.symbol);
      }
    }
    setBuying(false);
    qc.invalidateQueries({ queryKey: ["/api/broker/accounts/me/orders"] });
    qc.invalidateQueries({ queryKey: ["/api/broker/accounts/me/positions"] });
    toast({
      title: `Bought ${ok}/${items.length}`,
      description: failed.length ? `Failed: ${failed.join(", ")}` : "All orders submitted.",
      variant: failed.length ? "destructive" : undefined,
    });
  }

  function saveAsList() {
    if (!listName.trim() || !items.length) return;
    createList({ data: { name: listName.trim(), tickers: items.map((i) => i.symbol) } });
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" /> Trade Basket
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search / add a symbol */}
        <div className="flex items-end gap-2">
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs text-muted-foreground uppercase">Search / add symbol</Label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addFromInput(); }}
              placeholder="AAPL"
              className="font-mono h-8 text-sm uppercase"
            />
          </div>
          <div className="space-y-1.5 w-24">
            <Label className="text-xs text-muted-foreground uppercase">Qty</Label>
            <Input value={qty} onChange={(e) => setQty(e.target.value)} className="font-mono h-8 text-sm" />
          </div>
          <Button size="sm" variant="outline" className="h-8" onClick={addFromInput}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>

        {/* Pull from saved watchlists */}
        {!!watchlists?.length && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase">Load from watchlist</Label>
            <div className="flex flex-wrap gap-2">
              {watchlists.map((w) => (
                <Button key={w.id} size="sm" variant="outline" className="h-7 text-xs" onClick={() => loadWatchlist(w)}>
                  {w.name} <span className="text-muted-foreground ml-1">({w.tickers?.length ?? 0})</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Basket */}
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.symbol} className="flex items-center gap-2 rounded border border-border px-3 py-1.5">
                <Badge variant="outline" className="font-mono">{it.symbol}</Badge>
                <span className="text-xs text-muted-foreground">qty</span>
                <Input
                  value={it.qty}
                  onChange={(e) => setQtyFor(it.symbol, e.target.value)}
                  className="font-mono h-7 w-20 text-sm"
                />
                <div className="flex-1" />
                <button onClick={() => remove(it.symbol)} className="text-muted-foreground hover:text-red-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-6 border border-dashed border-border rounded">
            Add symbols or load a watchlist to build your basket.
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-end gap-2">
          <Button onClick={buyAll} disabled={!items.length || buying} className="flex-1 min-w-[160px]">
            <ShoppingCart className="h-4 w-4 mr-1" />
            {buying ? "Buying..." : `Buy basket (${items.length}) · market`}
          </Button>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase">Save basket as list</Label>
              <Input value={listName} onChange={(e) => setListName(e.target.value)} placeholder="My best picks" className="h-8 text-sm w-48" />
            </div>
            <Button size="sm" variant="outline" className="h-8" onClick={saveAsList} disabled={!listName.trim() || !items.length || savingList}>
              <ListPlus className="h-4 w-4 mr-1" /> Save
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Buys place day market orders in your brokerage account. Fund the account first so they fill.
        </p>
      </CardContent>
    </Card>
  );
}
