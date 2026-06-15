import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Zap, AlertCircle, CheckCircle2, Target, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

export function FPTM() {
  const [startingCapital, setStartingCapital] = useState(100);
  const [currentStep, setCurrentStep] = useState(0);
  const [accountValue, setAccountValue] = useState(100);

  const buildLadder = () => {
    const ladder = [];
    for (let i = 0; i <= 14; i++) {
      ladder.push({
        step: i,
        capital: startingCapital * Math.pow(2, i),
      });
    }
    return ladder;
  };

  const ladder = buildLadder();
  const targetCapital = ladder[14].capital;
  const doublesNeeded = 14 - currentStep;
  const nextTarget = ladder[currentStep + 1]?.capital || targetCapital;

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">FPTM Bot</h1>
            <p className="text-sm text-slate-400">14-Double Momentum Strategy</p>
          </div>
        </div>
        <p className="text-slate-400 text-sm max-w-2xl">
          Automated bot that finds high-momentum penny stocks and compounds gains through 14 consecutive 100% moves. Paper-trading mode recommended.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800">
          <CardContent className="pt-6">
            <div className="text-sm text-slate-400 mb-2">Current Step</div>
            <div className="text-4xl font-bold text-emerald-400">{currentStep}/14</div>
            <div className="text-xs text-slate-500 mt-2">{doublesNeeded} doubles remaining</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800">
          <CardContent className="pt-6">
            <div className="text-sm text-slate-400 mb-2">Account Value</div>
            <div className="text-4xl font-bold text-white">${accountValue.toLocaleString()}</div>
            <div className="text-xs text-slate-500 mt-2">Next: ${nextTarget.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800">
          <CardContent className="pt-6">
            <div className="text-sm text-slate-400 mb-2">End Goal</div>
            <div className="text-4xl font-bold text-cyan-400">${targetCapital.toLocaleString()}</div>
            <div className="text-xs text-slate-500 mt-2">From ${startingCapital}</div>
          </CardContent>
        </Card>
      </div>

      {/* Ladder Visualization */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <span>The 14-Double Ladder</span>
          </CardTitle>
          <CardDescription>Each 100% gain moves you to the next step</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center space-x-2 mb-3">
              <Label className="text-xs">Starting Capital ($)</Label>
              <Input
                type="number"
                value={startingCapital}
                onChange={(e) => setStartingCapital(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 h-8 text-xs"
                min="1"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-96 overflow-y-auto">
              {ladder.map((row, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setCurrentStep(idx);
                    setAccountValue(row.capital);
                  }}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition",
                    currentStep === idx
                      ? "bg-emerald-600/20 border-emerald-500 ring-1 ring-emerald-500"
                      : "bg-slate-900/50 border-slate-800 hover:border-emerald-500/50"
                  )}
                >
                  <div className="text-xs font-semibold text-slate-300">Step {idx}</div>
                  <div className="text-sm font-bold text-white mt-1">${row.capital.toLocaleString()}</div>
                  {currentStep === idx && <div className="text-[10px] text-emerald-400 mt-1">← You are here</div>}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bot Rules */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>Bot Screening Rules</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <Badge className="mt-1 bg-emerald-600/20 text-emerald-300 border-emerald-500/40">PRICE</Badge>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">$1.00 – $10.00</p>
                  <p className="text-xs text-slate-400">Sweet spot for 100%+ moves</p>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Badge className="mt-1 bg-emerald-600/20 text-emerald-300 border-emerald-500/40">MOMENTUM</Badge>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">≥20% MoM</p>
                  <p className="text-xs text-slate-400">1-month momentum minimum</p>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Badge className="mt-1 bg-emerald-600/20 text-emerald-300 border-emerald-500/40">RANGE</Badge>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">2.0× from Low</p>
                  <p className="text-xs text-slate-400">52-week range (doubled at least once)</p>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Badge className="mt-1 bg-emerald-600/20 text-emerald-300 border-emerald-500/40">HIGH</Badge>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">≤10% from High</p>
                  <p className="text-xs text-slate-400">Near 52-week high (trending)</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <Badge className="mt-1 bg-blue-600/20 text-blue-300 border-blue-500/40">VOLUME</Badge>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">≥500k avg, 2.0× today</p>
                  <p className="text-xs text-slate-400">Must have liquidity</p>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Badge className="mt-1 bg-blue-600/20 text-blue-300 border-blue-500/40">CATALYST</Badge>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Required</p>
                  <p className="text-xs text-slate-400">Earnings, FDA, partnership, etc.</p>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Badge className="mt-1 bg-blue-600/20 text-blue-300 border-blue-500/40">DILUTION</Badge>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Low Risk</p>
                  <p className="text-xs text-slate-400">Avoid float explosions</p>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Badge className="mt-1 bg-blue-600/20 text-blue-300 border-blue-500/40">CAP</Badge>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">$25M – $2B</p>
                  <p className="text-xs text-slate-400">Avoid micro-caps & mega-caps</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Management */}
      <Card className="bg-gradient-to-br from-red-950/30 to-slate-950 border-red-800/40">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span>Risk Guardrails</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Position Size</div>
              <div className="text-lg font-bold text-white">25% of capital</div>
              <p className="text-xs text-slate-500 mt-1">Max risk per trade</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Stop Loss</div>
              <div className="text-lg font-bold text-white">-25%</div>
              <p className="text-xs text-slate-500 mt-1">Auto-exit on loss</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Profit Target</div>
              <div className="text-lg font-bold text-white">+100%</div>
              <p className="text-xs text-slate-500 mt-1">The double (take profit)</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-yellow-950/20 border border-yellow-800/40">
            <p className="text-sm text-yellow-200">
              <strong>⚠️ Paper Trading Only:</strong> This bot is for simulation. Verify the screener, broker integration, stops, and rejection handling work before going live.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Trade Plan Example */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-cyan-400" />
            <span>Example Trade Plan</span>
          </CardTitle>
          <CardDescription>If bot finds a $4.50 candidate with $100 account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <p className="text-xs text-slate-400">Entry Price</p>
              <p className="text-xl font-bold text-white mt-1">$4.50</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <p className="text-xs text-slate-400">Position Size (25%)</p>
              <p className="text-xl font-bold text-white mt-1">$25.00</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <p className="text-xs text-slate-400">Shares</p>
              <p className="text-xl font-bold text-white mt-1">5 shares</p>
            </div>

            <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/40">
              <p className="text-xs text-slate-400">Stop Loss (-25%)</p>
              <p className="text-xl font-bold text-red-400 mt-1">$3.38</p>
              <p className="text-xs text-red-300 mt-1">Max loss: $5.60</p>
            </div>

            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40">
              <p className="text-xs text-slate-400">Target (+100%)</p>
              <p className="text-xl font-bold text-emerald-400 mt-1">$9.00</p>
              <p className="text-xs text-emerald-300 mt-1">Gain: $22.50</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <p className="text-xs text-slate-400">Next Account Value</p>
              <p className="text-xl font-bold text-white mt-1">$200</p>
              <p className="text-xs text-slate-500 mt-1">On successful trade</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="flex gap-3">
        <Button size="lg" className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:shadow-lg hover:shadow-emerald-950/50 text-white font-semibold">
          <Zap className="w-4 h-4 mr-2" />
          Start Paper Trading
        </Button>
        <Button size="lg" variant="outline" className="text-slate-200 border-slate-700">
          <DollarSign className="w-4 h-4 mr-2" />
          View Bot Status
        </Button>
      </div>
    </div>
  );
}
