import { Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function MrBot() {
  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)] p-6 items-center justify-center bg-background">
      <Card className="w-full max-w-md border-dashed border-2 border-muted-foreground/30 bg-muted/20 shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">MR.BOT</CardTitle>
          <CardDescription className="text-base mt-2">Automated Trading & Backtesting</CardDescription>
        </CardHeader>
        <CardContent className="text-center pb-6">
          <p className="text-muted-foreground text-xl font-semibold">Coming Soon</p>
          <p className="text-sm text-muted-foreground mt-3 max-w-sm mx-auto leading-relaxed">
            The advanced AI trading bot module is currently under active development. 
            Check back soon for automated strategy execution, Alpaca API integration, and live backtesting features.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
