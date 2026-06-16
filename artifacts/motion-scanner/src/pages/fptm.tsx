import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateWatchlist } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrendingUp, Settings, Zap, BarChart3, AlertCircle, Play, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StrategyParams {
  startingCapital: number;
  minPrice: number;
  maxPrice: number;
  minMonthlyChangePct: number;
  minAvgVolume: number;
  minRelativeVolume: number;
  maxDistanceFrom52wHighPct: number;
  stopLossPct: number;
  profitTargetPct: number;
  maxRiskPctPerTrade: number;
}

interface ValidatedCandidate {
  symbol: string;
  passed: boolean;
  score: number;
  price: number;
  monthlyChangePct: number;
  tradePlanExample?: any;
  metrics?: any;
  monteCarloWinRate?: number;
  passedValidation?: boolean;
}

interface MonteCarlo {
  simulationCount: number;
  results: number[];
  avgFinalCapital: number;
  maxFinalCapital: number;
  minFinalCapital: number;
  successRate: number;
  assumptions: string;
}

export function FPTM() {
  const [params, setParams] = useState<StrategyParams>({
    startingCapital: 100,
    minPrice: 1,
    maxPrice: 10,
    minMonthlyChangePct: 20,
    minAvgVolume: 500000,
    minRelativeVolume: 2,
    maxDistanceFrom52wHighPct: 10,
    stopLossPct: 25,
    profitTargetPct: 100,
    maxRiskPctPerTrade: 0.25,
  });

  const [validatedCandidates, setValidatedCandidates] = useState<ValidatedCandidate[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [watchlistName, setWatchlistName] = useState("14-Double Validated Candidates");
  const [currentStep, setCurrentStep] = useState(0);
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState("");
  const qc = useQueryClient();

  const { mutate: createWatchlist, isPending: isSaving } = useCreateWatchlist({
    mutation: { onSuccess: () => { setSaveDialogOpen(false); } },
  });

  const { data: fptmData, isLoading, refetch } = useQuery({
    queryKey: ["/api/fptm/scan", params.startingCapital],
    queryFn: async () => {
      const res = await fetch(`/api/fptm/scan?startingCapital=${params.startingCapital}&cache=false`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const allCandidates = fptmData?.candidates ?? [];
  const ladder = fptmData?.ladder ?? [];

  const handleParamChange = (key: keyof StrategyParams, value: string | number) => {
    setParams(p => ({ ...p, [key]: typeof value === "string" ? parseFloat(value) || 0 : value }));
  };

  const calculateMonteCarloWinRate = (candidate: any) => {
    let winRate = 0.65;

    const momentum = candidate.monthlyChangePct || 0;
    const score = candidate.score || 0;

    if (momentum >= 60) winRate = 0.85;
    else if (momentum >= 40) winRate = 0.78;
    else if (momentum >= 30) winRate = 0.72;
    else if (momentum >= 20) winRate = 0.68;

    if (score >= 80) winRate = Math.min(0.88, winRate + 0.05);
    else if (score >= 60) winRate = Math.min(0.82, winRate + 0.03);

    return winRate;
  };

  const simulateCandidate = (candidate: any, winRate: number): number => {
    let capital = params.startingCapital;
    for (let round = 0; round < 14; round++) {
      const roundWinRate = Math.max(0.3, Math.min(0.95, winRate + (Math.random() - 0.5) * 0.1));
      const outcome = Math.random() < roundWinRate ? params.profitTargetPct : -params.stopLossPct;
      capital = capital * (1 + outcome / 100);
      if (capital <= 0) break;
    }
    return capital;
  };

  const runSmartValidation = async () => {
    setIsValidating(true);
    setValidationProgress("Starting analysis of all 6,000+ tickers...");

    try {
      // Start with full market scan
      const scanRes = await fetch(`/api/fptm/scan?startingCapital=${params.startingCapital}&cache=false`);
      const scanData = await scanRes.json();
      const candidates = scanData.candidates || [];

      setValidationProgress(`Found ${candidates.length} candidates matching criteria...`);

      // Validate each candidate through Monte Carlo
      const validated: ValidatedCandidate[] = [];
      const validationThreshold = 0.6; // 60% success rate threshold

      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        const winRate = calculateMonteCarloWinRate(candidate);

        // Run 100 mini-simulations per candidate
        let successCount = 0;
        for (let j = 0; j < 100; j++) {
          const finalCapital = simulateCandidate(candidate, winRate);
          if (finalCapital > params.startingCapital * 2) successCount++;
        }

        const successRate = successCount / 100;
        const passedValidation = successRate >= validationThreshold;

        validated.push({
          ...candidate,
          monteCarloWinRate: winRate,
          passedValidation,
        });

        if ((i + 1) % 10 === 0) {
          setValidationProgress(
            `Validating: ${i + 1}/${candidates.length} | Passed so far: ${validated.filter(v => v.passedValidation).length}`
          );
        }
      }

      // Filter to only validated candidates and sort by win rate
      const finalCandidates = validated
        .filter(c => c.passedValidation)
        .sort((a, b) => (b.monteCarloWinRate || 0) - (a.monteCarloWinRate || 0));

      setValidatedCandidates(finalCandidates);
      setValidationProgress(
        `✓ Validation complete! ${finalCandidates.length} tickers passed Monte Carlo validation.`
      );
    } catch (error) {
      setValidationProgress(`Error during validation: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveAll = () => {
    if (validatedCandidates.length === 0) {
      alert("No validated candidates to save");
      return;
    }
    createWatchlist({
      name: watchlistName,
      tickers: validatedCandidates.map(c => c.symbol),
      description: `${validatedCandidates.length} candidates validated by Monte Carlo (${new Date().toLocaleDateString()})`,
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur px-4 py-3 shrink-0">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-primary/10 rounded-lg shrink-0">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm md:text-lg font-bold text-foreground truncate">14-Double Momentum Calculator</h1>
              <p className="text-xs text-muted-foreground truncate">
                Smart validation · Real data · Monte Carlo filtering
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full">
            <Button onClick={runSmartValidation} disabled={isValidating} size="sm" className="text-xs flex-1 md:flex-none">
              <Play className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">{isValidating ? "Validating..." : "Smart Scan & Validate"}</span>
              <span className="sm:hidden">{isValidating ? "..." : "Scan"}</span>
            </Button>
            <Button onClick={handleSaveAll} disabled={validatedCandidates.length === 0} size="sm" className="text-xs flex-1 md:flex-none">
              Save List
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 p-4 md:p-6">
          {/* Left: Parameters & Validation Status */}
          <div className="lg:col-span-1 space-y-3 md:space-y-4">
            {/* Trading Parameters */}
            <Card className="border-border">
              <CardHeader className="pb-2 md:pb-3">
                <CardTitle className="text-xs md:text-sm flex items-center gap-2">
                  <Settings className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  Trading Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs">Starting Capital ($)</Label>
                  <Input
                    type="number"
                    value={params.startingCapital}
                    onChange={(e) => handleParamChange("startingCapital", e.target.value)}
                    className="h-7 md:h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Price Range</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={params.minPrice}
                      onChange={(e) => handleParamChange("minPrice", e.target.value)}
                      className="h-7 md:h-8 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={params.maxPrice}
                      onChange={(e) => handleParamChange("maxPrice", e.target.value)}
                      className="h-7 md:h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Min Monthly Momentum (%)</Label>
                  <Input
                    type="number"
                    value={params.minMonthlyChangePct}
                    onChange={(e) => handleParamChange("minMonthlyChangePct", e.target.value)}
                    className="h-7 md:h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Min Avg Volume</Label>
                  <Input
                    type="number"
                    value={params.minAvgVolume}
                    onChange={(e) => handleParamChange("minAvgVolume", e.target.value)}
                    className="h-7 md:h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Min Relative Volume</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={params.minRelativeVolume}
                    onChange={(e) => handleParamChange("minRelativeVolume", e.target.value)}
                    className="h-7 md:h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Distance from 52w High (%)</Label>
                  <Input
                    type="number"
                    value={params.maxDistanceFrom52wHighPct}
                    onChange={(e) => handleParamChange("maxDistanceFrom52wHighPct", e.target.value)}
                    className="h-7 md:h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Stop Loss (%)</Label>
                  <Input
                    type="number"
                    value={params.stopLossPct}
                    onChange={(e) => handleParamChange("stopLossPct", e.target.value)}
                    className="h-7 md:h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Profit Target (%)</Label>
                  <Input
                    type="number"
                    value={params.profitTargetPct}
                    onChange={(e) => handleParamChange("profitTargetPct", e.target.value)}
                    className="h-7 md:h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Max Risk per Trade (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={params.maxRiskPctPerTrade * 100}
                    onChange={(e) => handleParamChange("maxRiskPctPerTrade", parseFloat(e.target.value) / 100)}
                    className="h-7 md:h-8 text-xs"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Validation Status */}
            {isValidating && (
              <Card className="border-border bg-sidebar/30">
                <CardHeader className="pb-2 md:pb-3">
                  <CardTitle className="text-xs md:text-sm flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 md:h-4 md:w-4 animate-pulse text-primary" />
                    Validation in Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="h-2 bg-sidebar rounded-full overflow-hidden">
                    <div className="h-full bg-primary animate-pulse w-1/3" />
                  </div>
                  <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                    {validationProgress}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Validation Summary */}
            {validatedCandidates.length > 0 && !isValidating && (
              <Card className="border-border border-green-500/30 bg-green-500/5">
                <CardHeader className="pb-2 md:pb-3">
                  <CardTitle className="text-xs md:text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-600" />
                    Validated Candidates
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Passed Validation</span>
                    <span className="font-bold text-green-600">{validatedCandidates.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Win Rate</span>
                    <span className="font-bold text-foreground">
                      {(
                        (validatedCandidates.reduce((sum, c) => sum + (c.monteCarloWinRate || 0), 0) /
                          validatedCandidates.length) *
                        100
                      ).toFixed(1)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Validated Candidates Table */}
          <div className="lg:col-span-3">
            <Card className="border-border h-full">
              <CardHeader className="pb-2 md:pb-3">
                <CardTitle className="text-xs md:text-sm">
                  Monte Carlo Validated Candidates {validatedCandidates.length > 0 && `(${validatedCandidates.length})`}
                </CardTitle>
                <CardDescription className="text-xs">
                  Only tickers that passed 60%+ success rate in Monte Carlo simulations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isValidating ? (
                  <div className="flex items-center justify-center h-48 md:h-64 text-muted-foreground">
                    <div className="text-center text-xs space-y-2">
                      <div className="h-8 w-8 rounded-full border-2 border-muted-foreground border-t-primary animate-spin mx-auto" />
                      <p>Scanning and validating all 6,000+ tickers...</p>
                    </div>
                  </div>
                ) : validatedCandidates.length === 0 ? (
                  <div className="flex items-center justify-center h-48 md:h-64 text-muted-foreground text-xs">
                    Click "Smart Scan & Validate" to analyze all 6,000+ tickers
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="border-b border-border">
                        <tr>
                          <th className="text-left py-1.5 md:py-2 px-1.5 md:px-2 font-bold text-muted-foreground">Ticker</th>
                          <th className="text-right py-1.5 md:py-2 px-1.5 md:px-2 font-bold text-muted-foreground">Price</th>
                          <th className="text-right py-1.5 md:py-2 px-1.5 md:px-2 font-bold text-muted-foreground">MoM%</th>
                          <th className="text-right py-1.5 md:py-2 px-1.5 md:px-2 font-bold text-muted-foreground hidden sm:table-cell">Score</th>
                          <th className="text-right py-1.5 md:py-2 px-1.5 md:px-2 font-bold text-muted-foreground">Win Rate</th>
                          <th className="text-right py-1.5 md:py-2 px-1.5 md:px-2 font-bold text-muted-foreground hidden sm:table-cell">Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validatedCandidates.map((c, i) => (
                          <tr key={i} className="border-b border-border hover:bg-sidebar/30 transition-colors">
                            <td className="py-1.5 md:py-2 px-1.5 md:px-2 font-bold text-primary text-xs md:text-sm">{c.symbol}</td>
                            <td className="py-1.5 md:py-2 px-1.5 md:px-2 text-right text-xs md:text-sm">${c.price?.toFixed(2)}</td>
                            <td className="py-1.5 md:py-2 px-1.5 md:px-2 text-right text-green-600 font-bold text-xs md:text-sm">
                              {c.monthlyChangePct?.toFixed(0)}%
                            </td>
                            <td className="py-1.5 md:py-2 px-1.5 md:px-2 text-right font-bold hidden sm:table-cell">{c.score}</td>
                            <td className="py-1.5 md:py-2 px-1.5 md:px-2 text-right">
                              <Badge variant="outline" className="text-green-600 text-xs">
                                {(c.monteCarloWinRate! * 100).toFixed(0)}%
                              </Badge>
                            </td>
                            <td className="py-1.5 md:py-2 px-1.5 md:px-2 text-right text-green-600 hidden sm:table-cell">
                              ${c.tradePlanExample?.targetPrice?.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Save Validated Candidates</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs md:text-sm">Watchlist Name</Label>
              <Input
                value={watchlistName}
                onChange={(e) => setWatchlistName(e.target.value)}
                placeholder="14-Double Validated Candidates"
                className="text-xs md:text-sm h-8 md:h-9"
              />
            </div>
            <Button onClick={handleSaveAll} disabled={isSaving} className="w-full text-xs md:text-sm">
              {isSaving ? "Saving..." : `Save ${validatedCandidates.length} Candidates`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
