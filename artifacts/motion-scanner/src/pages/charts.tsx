import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearch } from "wouter";
import { useGetChart, useListWatchlists } from "@workspace/api-client-react";
import {
  createChart, ColorType, CandlestickSeries, LineSeries, AreaSeries, HistogramSeries,
  type IChartApi, type ISeriesApi, type CandlestickData, type LineData, type HistogramData,
} from "lightweight-charts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Clock, List, TrendingUp, ChevronDown, ChevronRight } from "lucide-react";

// ── Indicator math ─────────────────────────────────────────────────────────

function calcEMA(values: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const out: (number | null)[] = new Array(values.length).fill(null);
  let ema: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    if (ema === null) {
      // seed with simple average
      ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      out[period - 1] = ema;
    } else {
      ema = values[i] * k + ema * (1 - k);
      out[i] = ema;
    }
  }
  return out;
}

function calcSMA(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    out[i] = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
  }
  return out;
}

function calcBB(values: number[], period = 20, mult = 2): { upper: (number | null)[]; lower: (number | null)[]; mid: (number | null)[] } {
  const mid = calcSMA(values, period);
  const upper: (number | null)[] = new Array(values.length).fill(null);
  const lower: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const avg = mid[i]!;
    const variance = slice.reduce((s, v) => s + (v - avg) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper[i] = avg + mult * sd;
    lower[i] = avg - mult * sd;
  }
  return { upper, lower, mid };
}

function calcRSI(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 2) return out;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = 100 - 100 / (1 + (avgLoss === 0 ? Infinity : avgGain / avgLoss));
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const gain = d >= 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = 100 - 100 / (1 + (avgLoss === 0 ? Infinity : avgGain / avgLoss));
  }
  return out;
}

function calcMACD(closes: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const macd: (number | null)[] = closes.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? emaFast[i]! - emaSlow[i]! : null,
  );
  // Compute signal EMA only over valid MACD values — never zero-pad
  const firstValid = macd.findIndex((v) => v != null);
  const signalLine: (number | null)[] = new Array(closes.length).fill(null);
  if (firstValid >= 0) {
    const validMacd = macd.slice(firstValid).map((v) => v!);
    const sigValues = calcEMA(validMacd, signal);
    sigValues.forEach((v, j) => { signalLine[firstValid + j] = v; });
  }
  const hist = macd.map((m, i) =>
    m != null && signalLine[i] != null ? m - signalLine[i]! : null,
  );
  return { macd, signal: signalLine, hist };
}

function calcStoch(
  highs: number[], lows: number[], closes: number[], kPeriod = 14, smooth = 3,
) {
  const rawK: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = kPeriod - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
    const ll = Math.min(...lows.slice(i - kPeriod + 1, i + 1));
    rawK[i] = hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100;
  }
  // SMA over only the valid (non-null) rawK segment
  const firstRaw = rawK.findIndex((v) => v != null);
  const k: (number | null)[] = new Array(closes.length).fill(null);
  if (firstRaw >= 0) {
    const validRaw = rawK.slice(firstRaw).map((v) => v!);
    const kValues = calcSMA(validRaw, smooth);
    kValues.forEach((v, j) => { k[firstRaw + j] = v; });
  }
  const firstK = k.findIndex((v) => v != null);
  const d: (number | null)[] = new Array(closes.length).fill(null);
  if (firstK >= 0) {
    const validK = k.slice(firstK).map((v) => v!);
    const dValues = calcSMA(validK, smooth);
    dValues.forEach((v, j) => { d[firstK + j] = v; });
  }
  return { k, d };
}

// ── Theme ──────────────────────────────────────────────────────────────────

const T = {
  bg: "transparent",
  text: "hsl(215 20% 65%)",
  grid: "rgba(255,255,255,0.05)",
  border: "rgba(255,255,255,0.08)",
  up: "#22d35e",
  down: "#ef4444",
  vol_up: "rgba(34,211,94,0.35)",
  vol_down: "rgba(239,68,68,0.35)",
  line: "#22d35e",
  area_top: "rgba(34,211,94,0.22)",
  area_bot: "rgba(34,211,94,0.0)",
  ema20: "#60a5fa",
  ema50: "#f59e0b",
  ema200: "#a78bfa",
  sma50: "#fb923c",
  bb_band: "rgba(96,165,250,0.5)",
  bb_mid: "rgba(96,165,250,0.8)",
  macd_line: "#60a5fa",
  macd_sig: "#f59e0b",
  stoch_k: "#60a5fa",
  stoch_d: "#f59e0b",
};

const FONT = "'JetBrains Mono','Fira Mono',monospace";

const BASE_OPTS = {
  layout: { background: { type: ColorType.Solid, color: T.bg }, textColor: T.text, fontFamily: FONT, fontSize: 11 },
  grid: { vertLines: { color: T.grid }, horzLines: { color: T.grid } },
  crosshair: { mode: 1 as const },
  rightPriceScale: { borderColor: T.border },
  timeScale: { borderColor: T.border, timeVisible: true, secondsVisible: false },
};

type ChartType = "candle" | "line" | "area";
type Range = "1mo" | "3mo" | "6mo" | "1y" | "2y";
type Interval = "1d" | "1wk";
type Overlay = "ema20" | "ema50" | "ema200" | "sma50" | "sma200" | "bb";
type Oscillator = "rsi" | "macd" | "stoch" | "none";

const RANGES: { label: string; value: Range }[] = [
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
  { label: "2Y", value: "2y" },
];

const OVERLAYS: { label: string; value: Overlay; color: string }[] = [
  { label: "EMA 20", value: "ema20", color: T.ema20 },
  { label: "EMA 50", value: "ema50", color: T.ema50 },
  { label: "EMA 200", value: "ema200", color: T.ema200 },
  { label: "SMA 50", value: "sma50", color: T.sma50 },
  { label: "BB(20)", value: "bb", color: T.bb_mid },
];

const OSCILLATORS: { label: string; value: Oscillator }[] = [
  { label: "RSI", value: "rsi" },
  { label: "MACD", value: "macd" },
  { label: "Stoch", value: "stoch" },
  { label: "Off", value: "none" },
];

interface OHLCV { time: number; open: number; high: number; low: number; close: number; volume: number; }

const POPULAR = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL", "AMD"];
const MAX_RECENT = 12;

// ── Main Charts page ───────────────────────────────────────────────────────

export function Charts() {
  const [ticker, setTicker] = useState("SPY");
  const [searchInput, setSearchInput] = useState("");
  const [chartType, setChartType] = useState<ChartType>("candle");
  const [range, setRange] = useState<Range>("6mo");
  const [interval, setInterval] = useState<Interval>("1d");
  const [overlays, setOverlays] = useState<Set<Overlay>>(new Set(["ema20", "ema50"]));
  const [oscillator, setOscillator] = useState<Oscillator>("rsi");
  const [recentTickers, setRecentTickers] = useState<string[]>(POPULAR.slice(0, 6));
  const [expandedWls, setExpandedWls] = useState<Set<number>>(new Set());

  const { data: watchlists = [] } = useListWatchlists();
  const { data, isLoading } = useGetChart(ticker, { range, interval }, {
    query: { queryKey: [`/api/chart/${ticker}`, range, interval], staleTime: 5 * 60 * 1000 },
  });

  const candles = useMemo<OHLCV[]>(
    () => (data?.candles ?? []).map((c) => ({ ...c, time: Number(c.time) })),
    [data],
  );

  // Load ticker
  const loadTicker = useCallback((t: string) => {
    const sym = t.trim().toUpperCase();
    if (!sym) return;
    setTicker(sym);
    setSearchInput("");
    setRecentTickers((prev) => {
      const filtered = prev.filter((x) => x !== sym);
      return [sym, ...filtered].slice(0, MAX_RECENT);
    });
  }, []);

  // Deep link support: /charts?ticker=NVDA (used by the global sidebar search)
  const searchString = useSearch();
  useEffect(() => {
    const fromUrl = new URLSearchParams(searchString).get("ticker");
    if (fromUrl && fromUrl.trim().toUpperCase() !== ticker) loadTicker(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchString, loadTicker]);

  // Chart refs
  const priceContainerRef = useRef<HTMLDivElement>(null);
  const oscContainerRef = useRef<HTMLDivElement>(null);
  const priceChartRef = useRef<IChartApi | null>(null);
  const oscChartRef = useRef<IChartApi | null>(null);

  // Series refs (price pane)
  const mainSeriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | ISeriesApi<"Area"> | null>(null);
  const volSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const overlaySeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

  // Series refs (oscillator pane)
  const oscSeries1Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const oscSeries2Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const oscHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Crosshair state
  const [crosshair, setCrosshair] = useState<Partial<OHLCV> & { changePct?: number; change?: number; dateStr?: string }>({});

  // ── Price chart lifecycle ────────────────────────────────────────────────

  useEffect(() => {
    if (!priceContainerRef.current) return;
    let disposed = false;
    let chart: IChartApi;
    try {
      chart = createChart(priceContainerRef.current, {
        ...BASE_OPTS,
        width: priceContainerRef.current.clientWidth || 600,
        height: priceContainerRef.current.clientHeight || 400,
      });
    } catch { return; }
    priceChartRef.current = chart;

    const ro = new ResizeObserver((entries) => {
      if (disposed) return;
      const e = entries[0];
      if (e) try { chart.applyOptions({ width: e.contentRect.width, height: e.contentRect.height }); } catch {}
    });
    ro.observe(priceContainerRef.current);

    return () => {
      disposed = true;
      ro.disconnect();
      priceChartRef.current = null;
      try { chart.remove(); } catch {}
    };
  }, []);

  // ── Oscillator chart lifecycle ───────────────────────────────────────────

  useEffect(() => {
    if (!oscContainerRef.current || oscillator === "none") return;
    let disposed = false;
    let chart: IChartApi;
    try {
      chart = createChart(oscContainerRef.current, {
        ...BASE_OPTS,
        width: oscContainerRef.current.clientWidth || 600,
        height: oscContainerRef.current.clientHeight || 140,
        timeScale: { ...BASE_OPTS.timeScale, visible: true },
      });
    } catch { return; }
    oscChartRef.current = chart;

    // Sync timescales
    let syncing = false;
    type RangeParam = Parameters<Parameters<ReturnType<IChartApi["timeScale"]>["subscribeVisibleLogicalRangeChange"]>[0]>[0];
    const onPriceRange = (r: RangeParam) => {
      if (disposed || syncing || !r) return;
      syncing = true;
      try { chart.timeScale().setVisibleLogicalRange(r); } catch {}
      syncing = false;
    };
    const onOscRange = (r: RangeParam) => {
      if (disposed || syncing || !r || !priceChartRef.current) return;
      syncing = true;
      try { priceChartRef.current.timeScale().setVisibleLogicalRange(r); } catch {}
      syncing = false;
    };
    try { priceChartRef.current?.timeScale().subscribeVisibleLogicalRangeChange(onPriceRange); } catch {}
    try { chart.timeScale().subscribeVisibleLogicalRangeChange(onOscRange); } catch {}

    const ro = new ResizeObserver((entries) => {
      if (disposed) return;
      const e = entries[0];
      if (e) try { chart.applyOptions({ width: e.contentRect.width, height: e.contentRect.height }); } catch {}
    });
    ro.observe(oscContainerRef.current);

    return () => {
      disposed = true;
      ro.disconnect();
      try { priceChartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(onPriceRange); } catch {}
      try { chart.timeScale().unsubscribeVisibleLogicalRangeChange(onOscRange); } catch {}
      oscChartRef.current = null;
      oscSeries1Ref.current = null;
      oscSeries2Ref.current = null;
      oscHistRef.current = null;
      try { chart.remove(); } catch {}
    };
  }, [oscillator]);

  // ── Rebuild main series when chartType changes ───────────────────────────

  useEffect(() => {
    const chart = priceChartRef.current;
    if (!chart) return;

    try {
      // Remove old series
      if (mainSeriesRef.current) { try { chart.removeSeries(mainSeriesRef.current); } catch {} mainSeriesRef.current = null; }
      if (volSeriesRef.current) { try { chart.removeSeries(volSeriesRef.current); } catch {} volSeriesRef.current = null; }
      overlaySeriesRef.current.forEach((s) => { try { chart.removeSeries(s); } catch {} });
      overlaySeriesRef.current.clear();

      // Volume
      const vol = chart.addSeries(HistogramSeries, {
        color: T.vol_up, priceFormat: { type: "volume" }, priceScaleId: "vol",
      });
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.83, bottom: 0 } });
      volSeriesRef.current = vol;

      // Main series
      if (chartType === "candle") {
        mainSeriesRef.current = chart.addSeries(CandlestickSeries, {
          upColor: T.up, downColor: T.down,
          borderUpColor: T.up, borderDownColor: T.down,
          wickUpColor: T.up, wickDownColor: T.down,
        }) as ISeriesApi<"Candlestick">;
      } else if (chartType === "line") {
        mainSeriesRef.current = chart.addSeries(LineSeries, { color: T.line, lineWidth: 2 }) as ISeriesApi<"Line">;
      } else {
        mainSeriesRef.current = chart.addSeries(AreaSeries, {
          lineColor: T.line, topColor: T.area_top, bottomColor: T.area_bot, lineWidth: 2,
        }) as ISeriesApi<"Area">;
      }

      chart.subscribeCrosshairMove((param) => {
        if (!param.time || !param.seriesData || !mainSeriesRef.current) { setCrosshair({}); return; }
        const d = param.seriesData.get(mainSeriesRef.current);
        if (!d) return;
        const dateStr = typeof param.time === "number"
          ? new Date(Number(param.time) * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
          : String(param.time);
        if (chartType === "candle") {
          const cd = d as CandlestickData;
          const change = cd.close - cd.open;
          const changePct = cd.open > 0 ? (change / cd.open) * 100 : 0;
          setCrosshair({ dateStr, open: cd.open, high: cd.high, low: cd.low, close: cd.close, change, changePct });
        } else {
          const ld = d as LineData;
          setCrosshair({ dateStr, close: ld.value });
        }
      });
    } catch {}
  }, [chartType]);

  // ── Feed data + overlays + oscillator ───────────────────────────────────

  useEffect(() => {
    const chart = priceChartRef.current;
    if (!chart || !candles.length || !mainSeriesRef.current || !volSeriesRef.current) return;

    try {
      const closes = candles.map((c) => c.close);
      const highs = candles.map((c) => c.high);
      const lows = candles.map((c) => c.low);
      const times = candles.map((c) => c.time);

      // Main series
      if (chartType === "candle") {
        (mainSeriesRef.current as ISeriesApi<"Candlestick">).setData(
          candles.map((c) => ({ time: c.time as CandlestickData["time"], open: c.open, high: c.high, low: c.low, close: c.close })),
        );
      } else {
        (mainSeriesRef.current as ISeriesApi<"Line"> | ISeriesApi<"Area">).setData(
          candles.map((c) => ({ time: c.time as LineData["time"], value: c.close })),
        );
      }

      // Volume
      volSeriesRef.current.setData(candles.map((c) => ({
        time: c.time as HistogramData["time"],
        value: c.volume,
        color: c.close >= c.open ? T.vol_up : T.vol_down,
      })));

      // Remove old overlay series
      overlaySeriesRef.current.forEach((s) => { try { chart.removeSeries(s); } catch {} });
      overlaySeriesRef.current.clear();

      // Add overlay series
      function addOverlayLine(values: (number | null)[], color: string, width: 1 | 2 = 1) {
        const s = chart!.addSeries(LineSeries, {
          color, lineWidth: width, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
        });
        s.setData(
          values
            .map((v, i) => v != null ? { time: times[i] as LineData["time"], value: v } : null)
            .filter(Boolean) as { time: LineData["time"]; value: number }[],
        );
        return s;
      }

      if (overlays.has("ema20")) overlaySeriesRef.current.set("ema20", addOverlayLine(calcEMA(closes, 20), T.ema20));
      if (overlays.has("ema50")) overlaySeriesRef.current.set("ema50", addOverlayLine(calcEMA(closes, 50), T.ema50));
      if (overlays.has("ema200")) overlaySeriesRef.current.set("ema200", addOverlayLine(calcEMA(closes, 200), T.ema200));
      if (overlays.has("sma50")) overlaySeriesRef.current.set("sma50", addOverlayLine(calcSMA(closes, 50), T.sma50));
      if (overlays.has("bb")) {
        const bb = calcBB(closes);
        overlaySeriesRef.current.set("bb_u", addOverlayLine(bb.upper, T.bb_band));
        overlaySeriesRef.current.set("bb_m", addOverlayLine(bb.mid, T.bb_mid));
        overlaySeriesRef.current.set("bb_l", addOverlayLine(bb.lower, T.bb_band));
      }

      chart.timeScale().fitContent();

      // Last candle for initial crosshair
      const last = candles[candles.length - 1];
      if (last) {
        const change = last.close - last.open;
        const changePct = last.open > 0 ? (change / last.open) * 100 : 0;
        setCrosshair({
          dateStr: new Date(last.time * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
          open: last.open, high: last.high, low: last.low, close: last.close, change, changePct,
        });
      }

      // ── Oscillator data ────────────────────────────────────────────────
      const oscChart = oscChartRef.current;
      if (!oscChart || oscillator === "none") return;

      // Clear old oscillator series
      if (oscSeries1Ref.current) { try { oscChart.removeSeries(oscSeries1Ref.current); } catch {} oscSeries1Ref.current = null; }
      if (oscSeries2Ref.current) { try { oscChart.removeSeries(oscSeries2Ref.current); } catch {} oscSeries2Ref.current = null; }
      if (oscHistRef.current) { try { oscChart.removeSeries(oscHistRef.current); } catch {} oscHistRef.current = null; }

      function toLine(values: (number | null)[]): { time: LineData["time"]; value: number }[] {
        return values
          .map((v, i) => v != null ? { time: times[i] as LineData["time"], value: v } : null)
          .filter(Boolean) as { time: LineData["time"]; value: number }[];
      }
      function toHist(values: (number | null)[]): { time: HistogramData["time"]; value: number; color: string }[] {
        return values
          .map((v, i) => v != null ? { time: times[i] as HistogramData["time"], value: v, color: v >= 0 ? T.vol_up : T.vol_down } : null)
          .filter(Boolean) as { time: HistogramData["time"]; value: number; color: string }[];
      }

      if (oscillator === "rsi") {
        const rsi = calcRSI(closes);
        oscSeries1Ref.current = oscChart.addSeries(LineSeries, { color: T.ema20, lineWidth: 2, priceLineVisible: false });
        oscSeries1Ref.current.setData(toLine(rsi));
        oscChart.priceScale("right").applyOptions({ autoScale: false });
      } else if (oscillator === "macd") {
        const { macd, signal: sig, hist } = calcMACD(closes);
        oscHistRef.current = oscChart.addSeries(HistogramSeries, { color: T.vol_up, priceFormat: { type: "price", precision: 4 } });
        oscHistRef.current.setData(toHist(hist));
        oscSeries1Ref.current = oscChart.addSeries(LineSeries, { color: T.macd_line, lineWidth: 2, priceLineVisible: false });
        oscSeries1Ref.current.setData(toLine(macd));
        oscSeries2Ref.current = oscChart.addSeries(LineSeries, { color: T.macd_sig, lineWidth: 1, priceLineVisible: false });
        oscSeries2Ref.current.setData(toLine(sig));
      } else if (oscillator === "stoch") {
        const { k, d } = calcStoch(highs, lows, closes);
        oscSeries1Ref.current = oscChart.addSeries(LineSeries, { color: T.stoch_k, lineWidth: 2, priceLineVisible: false });
        oscSeries1Ref.current.setData(toLine(k));
        oscSeries2Ref.current = oscChart.addSeries(LineSeries, { color: T.stoch_d, lineWidth: 1, priceLineVisible: false });
        oscSeries2Ref.current.setData(toLine(d));
        oscChart.priceScale("right").applyOptions({ autoScale: false });
      }

      oscChart.timeScale().fitContent();
      // Sync initial range
      const priceRange = priceChartRef.current?.timeScale().getVisibleLogicalRange();
      if (priceRange) oscChart.timeScale().setVisibleLogicalRange(priceRange);
    } catch (_err) {
      // lightweight-charts throws strings (not Error objects) for invariant violations
      // (e.g. out-of-order timestamps, disposed series). Swallow to prevent unhandled
      // exception crashes — the chart will recover on the next data/dependency update.
    }
  }, [candles, chartType, overlays, oscillator]);

  // ── Overlay toggle ───────────────────────────────────────────────────────
  function toggleOverlay(o: Overlay) {
    setOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(o)) next.delete(o); else next.add(o);
      return next;
    });
  }

  const fmt2 = (n?: number) => n != null ? n.toFixed(2) : "—";
  const chgColor = (crosshair.change ?? 0) >= 0 ? "text-[hsl(var(--go-color))]" : "text-red-600";

  return (
    <div className="flex h-full bg-background font-mono text-sm overflow-hidden">

      {/* ── LEFT SIDEBAR ── */}
      <aside className="w-44 flex-shrink-0 border-r border-border flex flex-col bg-sidebar overflow-hidden">
        {/* Symbol search */}
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") loadTicker(searchInput); }}
              placeholder="Symbol…"
              className="pl-7 h-7 text-xs font-mono bg-background/50"
            />
          </div>
          {searchInput && (
            <Button size="sm" onClick={() => loadTicker(searchInput)}
              className="mt-1.5 h-6 w-full text-xs">
              Load {searchInput}
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Recent */}
          <div className="px-2 pt-2">
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Recent</span>
            </div>
            {recentTickers.map((t) => (
              <button
                key={t}
                onClick={() => loadTicker(t)}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                  t === ticker
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-bold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/40"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Watchlists */}
          {watchlists.length > 0 && (
            <>
              <Separator className="my-2" />
              <div className="px-2">
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <List className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Watchlists</span>
                </div>
                {watchlists.map((wl) => {
                  const open = expandedWls.has(wl.id);
                  return (
                    <div key={wl.id}>
                      <button
                        onClick={() => setExpandedWls((s) => {
                          const n = new Set(s);
                          if (n.has(wl.id)) n.delete(wl.id); else n.add(wl.id);
                          return n;
                        })}
                        className="w-full flex items-center justify-between px-2 py-1 rounded text-xs text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors"
                      >
                        <span className="truncate font-medium">{wl.name}</span>
                        <span className="flex items-center gap-0.5 text-muted-foreground">
                          <span>{wl.tickers.length}</span>
                          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </span>
                      </button>
                      {open && wl.tickers.map((t) => (
                        <button
                          key={t}
                          onClick={() => loadTicker(t)}
                          className={`w-full text-left pl-5 pr-2 py-0.5 rounded text-xs transition-colors ${
                            t === ticker
                              ? "text-[hsl(var(--go-color))] font-bold"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Popular symbols */}
          <Separator className="my-2" />
          <div className="px-2 pb-2">
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Popular</span>
            </div>
            {POPULAR.map((t) => (
              <button
                key={t}
                onClick={() => loadTicker(t)}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                  t === ticker
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-bold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/40"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ── CHART WORKSPACE ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-background/60 flex-wrap shrink-0">
          {/* Ticker pill */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-base tracking-tight text-foreground">{ticker}</span>
            {crosshair.close != null && (
              <span className="font-mono text-sm">${fmt2(crosshair.close)}</span>
            )}
            {crosshair.change != null && (
              <span className={`font-mono text-xs ${chgColor}`}>
                {crosshair.change >= 0 ? "+" : ""}{fmt2(crosshair.change)} ({crosshair.change >= 0 ? "+" : ""}{fmt2(crosshair.changePct)}%)
              </span>
            )}
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Chart type */}
          <div className="flex gap-0.5">
            {(["candle", "line", "area"] as ChartType[]).map((ct) => (
              <button
                key={ct}
                onClick={() => setChartType(ct)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  ct === chartType
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {ct === "candle" ? "☯" : ct === "line" ? "∼" : "◠"} {ct.charAt(0).toUpperCase() + ct.slice(1)}
              </button>
            ))}
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Interval */}
          <div className="flex gap-0.5">
            {(["1d", "1wk"] as Interval[]).map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  iv === interval
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {iv === "1d" ? "Daily" : "Weekly"}
              </button>
            ))}
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Range */}
          <div className="flex gap-0.5">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  r.value === range
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Overlays */}
          <div className="flex flex-wrap gap-1">
            {OVERLAYS.map((ov) => (
              <button
                key={ov.value}
                onClick={() => toggleOverlay(ov.value)}
                className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                  overlays.has(ov.value)
                    ? "border-transparent text-black font-medium"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
                style={overlays.has(ov.value) ? { backgroundColor: ov.color } : undefined}
              >
                {ov.label}
              </button>
            ))}
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Oscillator */}
          <div className="flex gap-0.5 items-center">
            <span className="text-xs text-muted-foreground mr-1">OSC</span>
            {OSCILLATORS.map((osc) => (
              <button
                key={osc.value}
                onClick={() => setOscillator(osc.value)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  osc.value === oscillator
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {osc.label}
              </button>
            ))}
          </div>
        </div>

        {/* OHLCV data bar */}
        <div className="flex items-center gap-4 px-3 py-1 border-b border-border/50 text-xs font-mono shrink-0 min-h-[24px]">
          {crosshair.dateStr && (
            <span className="text-muted-foreground">{crosshair.dateStr}</span>
          )}
          {crosshair.open != null && (
            <>
              <span>O <span className="text-foreground">{fmt2(crosshair.open)}</span></span>
              <span>H <span className="text-[hsl(var(--go-color))]">{fmt2(crosshair.high)}</span></span>
              <span>L <span className="text-red-600">{fmt2(crosshair.low)}</span></span>
              <span>C <span className="text-foreground font-bold">{fmt2(crosshair.close)}</span></span>
            </>
          )}
          {crosshair.volume != null && (
            <span className="text-muted-foreground">
              V {crosshair.volume > 1e6
                ? `${(crosshair.volume / 1e6).toFixed(2)}M`
                : crosshair.volume > 1e3
                  ? `${(crosshair.volume / 1e3).toFixed(1)}K`
                  : crosshair.volume}
            </span>
          )}
          {/* Legend for active overlays */}
          {[...overlays].map((ov) => {
            const meta = OVERLAYS.find((o) => o.value === ov);
            if (!meta) return null;
            return (
              <span key={ov} className="flex items-center gap-1">
                <span className="h-0.5 w-4 inline-block rounded" style={{ backgroundColor: meta.color }} />
                <span style={{ color: meta.color }}>{meta.label}</span>
              </span>
            );
          })}
          {/* Oscillator legend */}
          {oscillator === "rsi" && <span className="text-[color:#60a5fa]">RSI(14)</span>}
          {oscillator === "macd" && (
            <>
              <span className="text-[color:#60a5fa]">MACD(12,26,9)</span>
              <span className="text-[color:#f59e0b]">Signal</span>
            </>
          )}
          {oscillator === "stoch" && (
            <>
              <span className="text-[color:#60a5fa]">%K(14,3)</span>
              <span className="text-[color:#f59e0b]">%D(3)</span>
            </>
          )}
        </div>

        {/* Chart area */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-3/5" />
              <span className="text-xs text-muted-foreground mt-2">Loading {ticker}…</span>
            </div>
          )}

          {/* Price chart */}
          <div
            ref={priceContainerRef}
            className={`w-full ${oscillator !== "none" ? "h-[65%]" : "flex-1"}`}
          />

          {/* Oscillator chart */}
          {oscillator !== "none" && (
            <>
              <div className="h-px bg-border/60 shrink-0" />
              <div
                ref={oscContainerRef}
                className="w-full flex-1"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
