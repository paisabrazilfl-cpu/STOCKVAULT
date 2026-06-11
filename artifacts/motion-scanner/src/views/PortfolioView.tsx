import { useEffect, useState } from "react";
import AlpacaClient from "../lib/alpacaClient";

const alpacaClient = new AlpacaClient();
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";

export default function PortfolioView() {
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await alpacaClient.getAccount();
        setAccount(data);
      } catch (e) {
        console.error("Failed to fetch account", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <div className="p-6"><Skeleton className="h-32 w-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Equity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${account?.equity || "0.00"}</div>
            <p className="text-xs text-muted-foreground">Updated live via Alpaca</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Buying Power</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${account?.buying_power || "0.00"}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
