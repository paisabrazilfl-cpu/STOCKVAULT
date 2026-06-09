import { Router } from "express";
import { db, apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { runScan, DEFAULT_CONFIG } from "../lib/scanner";
import { decrypt } from "../lib/crypto";
import type { TenantProviderKeys } from "../lib/providers";

const router = Router();

// ── Universe definitions ──────────────────────────────────────────────────

// ─ Broad indices ─────────────────────────────────────────────────────────

// Full S&P 500 (~503 constituents as of 2025)
const UNIVERSE_SP500 = [
  // A
  "AAPL","ABBV","ABT","ACN","ADBE","ADI","ADM","ADP","ADSK","AEE",
  "AEP","AES","AFL","AIG","AIZ","AJG","AKAM","ALB","ALGN","ALK",
  "ALL","ALLE","AMAT","AMCR","AMD","AME","AMGN","AMP","AMT","AMZN",
  "ANET","ANSS","AON","AOS","APA","APD","APH","APTV","ARE","ATO",
  "ATVI","AVB","AVGO","AVY","AWK","AXP","AZO",
  // B
  "BA","BAC","BAX","BBWI","BBY","BDX","BEN","BF.B","BG","BIIB",
  "BIO","BK","BKNG","BKR","BLK","BMY","BR","BRK.B","BRO","BSX",
  "BWA","BXP",
  // C
  "C","CAG","CAH","CARR","CAT","CB","CBOE","CBRE","CCI","CCL",
  "CDAY","CDNS","CDW","CE","CEG","CF","CFG","CHD","CHRW","CHTR",
  "CI","CINF","CL","CLX","CMA","CMCSA","CME","CMG","CMI","CMS",
  "CNC","CNP","COF","COO","COP","COR","COST","CPAY","CPB","CPRT",
  "CPT","CRL","CRM","CSCO","CSGP","CSX","CTAS","CTLT","CTRA","CTSH",
  "CTVA","CVS","CVX",
  // D
  "D","DAL","DAY","DD","DE","DECK","DFS","DG","DGX","DHI",
  "DHR","DIS","DLTR","DOV","DOW","DPZ","DRI","DTE","DUK","DVA","DVN",
  // E
  "DXCM","EA","EBAY","ECL","ED","EFX","EIX","EL","EMN","EMR",
  "ENPH","EOG","EPAM","EQIX","EQR","EQT","ES","ESS","ETN","ETR",
  "ERIE","EVRG","EW","EXC","EXPD","EXPE","EXR",
  // F
  "F","FANG","FAST","FBHS","FCX","FDS","FDX","FE","FFIV","FI",
  "FICO","FIS","FISV","FITB","FLT","FMC","FOX","FOXA","FRT","FSLR",
  "FTNT","FTV",
  // G
  "GD","GDDY","GE","GEHC","GEN","GILD","GIS","GL","GLW","GM",
  "GNRC","GOOG","GOOGL","GPC","GPN","GRMN","GS","GWW",
  // H
  "HAL","HAS","HBAN","HCA","PEAK","HD","HOLX","HON","HPE","HPQ",
  "HRL","HSIC","HST","HSY","HUBB","HUM","HWM","HII",
  // I
  "IBM","ICE","IDXX","IEX","IFF","ILMN","INCY","INTC","INTU","INVH",
  "IP","IPG","IQV","IR","IRM","ISRG","IT","ITW","IVZ",
  // J
  "J","JBHT","JCI","JKHY","JNJ","JNPR","JPM",
  // K
  "K","KDP","KEY","KEYS","KHC","KIM","KLAC","KMB","KMI","KMX",
  "KO","KR",
  // L
  "KVUE","L","LDOS","LEN","LH","LHX","LIN","LKQ","LLY","LMT",
  "LNT","LOW","LRCX","LULU","LUV","LVS","LW","LYB","LYV",
  // M
  "MA","MAA","MAR","MAS","MCD","MCHP","MCK","MCO","MDLZ","MDT",
  "MET","META","MGM","MHK","MKC","MKTX","MLM","MMC","MMM","MNST",
  "MO","MOH","MOS","MPC","MPWR","MRK","MRNA","MRO","MS","MSCI",
  "MSFT","MSI","MTB","MTCH","MTD","MU","NCLH",
  // N
  "NDAQ","NDSN","NEE","NEM","NFLX","NI","NKE","NOC","NOW","NRG",
  "NSC","NTAP","NTRS","NUE","NVDA","NVR","NWS","NWSA","NXPI",
  // O
  "O","ODFL","OGN","OKE","OMC","ON","ORCL","ORLY","OTIS","OXY",
  // P
  "PARA","PAYC","PAYX","PCAR","PCG","PEG","PEP","PFE","PFG","PG",
  "PGR","PH","PHM","PKG","PLD","PM","PNC","PNR","PNW","PODD",
  "POOL","PPG","PPL","PRU","PSA","PSX","PTC","PVH","PWR","PXD",
  // Q-R
  "QCOM","QRVO","RCL","RE","REG","REGN","RF","RHI","RJF","RL",
  "RMD","ROK","ROL","ROP","ROST","RSG","RTX","RVTY",
  // S
  "SBAC","SBNY","SBUX","SCHW","SEE","SHW","SIVB","SJM","SLB","SNA",
  "SNPS","SO","SOLV","SPG","SPGI","SRE","STE","STLD","STT","STX",
  "STZ","SWK","SWKS","SYF","SYK","SYY",
  // T
  "T","TAP","TDG","TDY","TECH","TEL","TER","TFC","TFX","TGT",
  "TMO","TMUS","TPR","TRGP","TRMB","TROW","TRV","TSCO","TSLA","TSN",
  "TT","TTWO","TXN","TXT","TYL",
  // U-V
  "UAL","UDR","UHS","ULTA","UNH","UNP","UPS","URI","USB",
  "V","VFC","VICI","VLO","VLTO","VMC","VRSK","VRSN","VRTX","VTR","VTRS","VZ",
  // W-Z
  "WAB","WAT","WBA","WBD","WDC","WEC","WELL","WFC","WHR","WM",
  "WMB","WMT","WRB","WRK","WST","WTW","WY","WYNN",
  "XEL","XOM","XRAY","XYL","YUM","ZBH","ZBRA","ZION","ZTS",
];

// Full Nasdaq 100 (101 securities as of 2025)
const UNIVERSE_NASDAQ100 = [
  "AAPL","ABNB","ADBE","ADI","ADP","ADSK","AEP","AMAT","AMGN","AMZN",
  "ANSS","APP","ARM","ASML","AVGO","AZN","BIIB","BKNG","BKR","CCEP",
  "CDNS","CDW","CEG","CHTR","CMCSA","COIN","COST","CPRT","CRWD","CSCO",
  "CSGP","CTAS","CTSH","DASH","DDOG","DLTR","DXCM","EA","EXC","FANG",
  "FAST","FTNT","GEHC","GILD","GOOG","GOOGL","GFS","HON","IDXX","ILMN",
  "INTC","INTU","ISRG","KDP","KHC","KLAC","LIN","LRCX","LULU","MAR",
  "MCHP","MDB","MDLZ","MELI","META","MNST","MRNA","MRVL","MSFT","MU",
  "NFLX","NVDA","NXPI","ODFL","ON","ORCL","ORLY","PANW","PAYX","PCAR",
  "PDD","PEP","PLTR","PYPL","QCOM","REGN","ROST","SBUX","SMCI","SNPS",
  "TEAM","TMUS","TSLA","TTD","TTWO","TXN","VRSK","VRTX","WBD","WDAY","ZS",
];

// Dow Jones Industrial Average (30 components — updated 2025)
const UNIVERSE_DOW30 = [
  "AAPL","AMGN","AMZN","AXP","BA","CAT","CRM","CSCO","CVX","DIS",
  "DOW","GS","HD","HON","IBM","INTC","JNJ","JPM","KO","MCD",
  "MMM","MRK","MSFT","NKE","PG","SHW","TRV","UNH","V","VZ","WMT",
];

// Russell 2000 — top ~200 most-liquid small caps (full index is 2000 stocks;
// scanning all of them would take too long, so we pick the most-traded names)
const UNIVERSE_RUSSELL2000 = [
  "AFRM","HOOD","UPST","SOFI","LC","DAVE","OPEN","UWMC","PFSI",
  "CELH","USFD","CHWY","W","PRCT","HIMS","ACMR","RELY",
  "ASAN","BRZE","CWAN","ALTR","PAGS","CAAP","TFII",
  "COUR","UDMY","DUOL","SMAR","DOMO","YEXT","FSLY","BAND","LPSN",
  "MNDY","BILL","PCTY","PAYC","TOST","FOUR","RPAY","PAYO",
  "CRDO","SMMT","COTY","IPAR","ELF","LNTH","GKOS","RXRX",
  "ENSG","AMED","SGRY","AEIS","CALX","CGNX","NOVT","AZEK","TREX",
  "FND","BOOT","PLNT","XPOF","ARKO","SAM","FIZZ","COKE","MGPI",
  "PRMW","FRPT","SPSC","MMSI","TMDX","AXNX","NVCR","INSP","GMED",
  "STAA","LUNG","RVMD","PCVX","VCEL","NUVB","KURA","IRTC","ITCI",
  "VERA","DRS","BWXT","KTOS","RKLB","LUNR","RDW","ASTS","ACHR",
  "JOBY","LILM","ASTR","MNTS","VORB","SPIR","SATL","PL",
  "SHAK","CAVA","WING","TXRH","DINE","BJRI","CAKE","DIN","JACK",
  "LOCO","ARCO","TACO","PZZA","NDLS","KRUS","BROS","SBIG",
  "RELY","EVLV","STEP","PIPR","HLNE","VCTR","APAM","VRTS","LFST",
  "IBKR","LPLA","BGCP","MKTX","VIRT","SNEX","COWN","GLNG",
  "MATX","INSW","STNG","TNK","ASC","GOGL","SFL","ESGR","HCI",
  "KNSL","RLI","PLMR","HRTG","UFCS","WDFC","ENS","AAON","ATKR",
  "SPXC","RBC","GGG","NDSN","FLS","MIDD","JOHN","TTC","SWX",
  "GTLS","PRLB","SITE","BLDR","IBP","APOG","ROCK",
];

// S&P MidCap 400 — top ~100 most-liquid mid caps
const UNIVERSE_MIDCAP = [
  "WSM","RH","DECK","CROX","SKX","FOXF","BC","SCI","POOL","LULU",
  "FIVE","BJ","OLLI","CASY","WOOF","DKS","ASO","HIBB","AEO","ANF",
  "BURL","URBN","EXPR","GPS","JWN","KSS","M","NORDSTROM","TPR","CPRI",
  "WH","WYNDHAM","CHH","PLYA","TNL","HGV","VAC","SIX","FUN","SEAS",
  "PENN","CZR","BYD","MGM","DKNG","RSI","GENI","CHDN","FLUT",
  "BALY","WYNN","LVS","ERI","RRR","MCRI",
  "AXON","TYL","GWRE","QTWO","NCNO","ALRM","TENB","VRNS","SAIL",
  "QLYS","CYBR","JAMF","RPD","SCWX","KNBE","SMCI","DELL","HPE",
  "NTAP","PSTG","BOX","OKTA","ZI","GTLB","CFLT","ESTC","NEWR",
  "MANH","AZPN","APPN","COUP","PLAN","FROG","BRZE","SQSP","DOCS",
  "DOCU","PCOR","YOU","AI","BBAI","SOUN",
];

// ─ GICS Sectors ──────────────────────────────────────────────────────────
const UNIVERSE_TECH = [
  "AAPL","MSFT","NVDA","GOOGL","META","AVGO","ORCL","CSCO","ADBE","AMD",
  "INTU","QCOM","ADI","TXN","CRM","NOW","LRCX","AMAT","KLAC","SNPS",
  "CDNS","MRVL","PANW","FTNT","CRWD","ZS","NET","SNOW","MDB","DDOG",
  "PLTR","APP","TTD","COIN","UBER","LYFT","SHOP","SPOT","SQ","HOOD",
  "ADSK","ANSS","CTSH","IT","EPAM","GDDY","GEN","KEYS","MPWR","MSI",
  "NXPI","ON","PTC","ROP","SWKS","TER","TRMB","TYL","VRSN","ZBRA",
  "SMCI","DELL","HPE","HPQ","STX","WDC","NTAP","PSTG","ANET","FFIV",
];

const UNIVERSE_FINANCE = [
  "JPM","BAC","WFC","GS","MS","C","BLK","SCHW","AXP","V","MA",
  "USB","PNC","COF","DFS","SPGI","MCO","ICE","CME","CB",
  "MMC","AON","MET","PRU","AFL","ALL","PGR","AIG","TROW","CINF",
  "FDS","RJF","SF","NTRS","STT","BK","FITB","RF","HBAN","CFG",
  "KEY","CMA","ZION","FRC","SIVB","SBNY","WAL","EWBC","FHN",
  "MTB","TFC","ALLY","SYF","NDAQ","CBOE","MKTX","MSCI","BR",
  "FI","FIS","FISV","GPN","WRB","RE","L","GL","AIZ","LNC",
];

const UNIVERSE_HEALTH = [
  "UNH","JNJ","ABBV","LLY","MRK","TMO","ABT","DHR","AMGN","GILD",
  "MDT","SYK","ISRG","REGN","VRTX","CI","BMY","ZTS","BIIB",
  "ILMN","BDX","DXCM","IDXX","IQV","HCA","DGX","LH","CAH","MCK",
  "CNC","MOH","HUM","CVS","GEHC","SOLV","PODD","ALGN","EW","BAX",
  "PFE","MRNA","BSX","RMD","HOLX","MTD","STE","WST","TECH","BIO",
  "CRL","RVTY","INCY","JAZZ","ALNY","BMRN","EXEL","IONS","SRPT","HALO",
];

const UNIVERSE_ENERGY = [
  "XOM","CVX","EOG","COP","SLB","MPC","PSX","VLO","OXY",
  "HES","DVN","BKR","HAL","MRO","APA","CTRA","NOV","HP","TRGP","KMI",
  "WMB","OKE","LNG","CVI","DINO","SM","PR","CIVI","MGY","VTLE",
  "PXD","FANG","EQT","DTM","AM","AR","RRC","SWN","CNX","CHK",
];

const UNIVERSE_CONSUMER = [
  "AMZN","TSLA","COST","HD","MCD","NKE","SBUX","LOW","TJX","TGT",
  "DIS","NFLX","BKNG","MAR","HLT","YUM","LULU","ROST","ULTA","DG",
  "DLTR","POOL","WSM","RH","ORLY","AZO","CASY","WBA","KR","SYY",
  "WMT","PG","KO","PEP","CL","CLX","KHC","GIS","HSY","MKC",
  "SJM","K","CPB","HRL","MNST","KDP","STZ","TAP","BF.B","PM",
  "MO","EL","KVUE","CHD","SPB","BBWI","TPR","PVH","RL","LVS",
  "WYNN","MGM","CCL","RCL","NCLH","CMG","DPZ","DKNG","LYV","EXPE",
];

const UNIVERSE_INDUSTRIALS = [
  "HON","UPS","CAT","GE","RTX","DE","LMT","NOC","GD","BA",
  "ETN","EMR","ITW","PH","ROK","AME","FTV","DOV","GNRC","XYL",
  "FAST","ODFL","CHRW","NSC","CSX","UNP","CP","CNI","WAB","EXPD",
  "LHX","LDOS","BAH","SAIC","CACI","DRS","HII","TDG","HEICO","TXT",
  "MMM","CMI","IR","OTIS","CARR","JCI","AOS","ALLE","SWK","SNA",
  "FDX","DAL","UAL","LUV","ALK","JBHT","RHI","PAYX","CTAS","VRSK",
  "RSG","WM","PWR","PCAR","URI","TSCO","NDSN","ROP","IEX","HUBB",
];

const UNIVERSE_UTILITIES = [
  "NEE","SO","DUK","AEP","SRE","D","EXC","XEL","PCG","ED",
  "AWK","PPL","FE","ETR","AES","NRG","CMS","LNT","PNW","NI",
  "EVRG","OGE","WEC","WTRG","SWX","AVA","IDA","BKH","POR","NWE",
  "CEG","PEG","DTE","EIX","ES","AEE","CNP","ATO","PNR",
];

const UNIVERSE_MATERIALS = [
  "LIN","APD","ECL","SHW","PPG","NEM","FCX","NUE","STLD","RS",
  "CF","MOS","FMC","ALB","BALL","PKG","IP","WRK","SEE","SON",
  "VMC","MLM","EXP","SLGN","GEF","CLF","AA","X","CMC","ATI",
  "AVY","CE","DD","EMN","IFF","LYB","CTVA","AMCR","BG","OGN",
];

const UNIVERSE_REALESTATE = [
  "PLD","AMT","EQIX","CCI","WELL","O","SPG","DLR","PSA","AVB",
  "EQR","INVH","NLY","AGNC","MPW","VTR","PEAK","HST","KIM","FRT",
  "REG","BRX","EPR","SKT","NNN","STAG","REXR","EGP","FR","COLD",
  "ARE","BXP","CPT","ESS","MAA","UDR","VICI","IRM","SBAC","EXR",
];

const UNIVERSE_COMMS = [
  "GOOGL","META","NFLX","DIS","T","VZ","CMCSA","TMUS","CHTR","LYV",
  "EA","TTWO","RBLX","SNAP","PINS","SPOT","WBD","PARA","FOXA","FOX",
  "NYT","NWSA","OMC","IPG","ZETA","IAS","DV","MGNI","TTD","PUBM",
  "MTCH","GOOG","ATVI",
];

// ─ Thematic ──────────────────────────────────────────────────────────────
const UNIVERSE_SEMIS = [
  "NVDA","AVGO","TSM","QCOM","AMD","TXN","ADI","MU","LRCX","AMAT",
  "KLAC","SNPS","CDNS","MRVL","ON","NXPI","SWKS","QRVO","MPWR","WOLF",
  "SLAB","SITM","ALGM","AEHR","FORM","ACLS","UCTT","ONTO","AMBA","SMTC",
  "OLED","MKSI","COHU","ICHR","CAMT","ENTG","AZTA","BRKS","KLIC","CCMP",
  "ARM","GFS","MCHP","TER","INTC",
];

const UNIVERSE_BIOTECH = [
  "AMGN","GILD","REGN","VRTX","BIIB","MRNA","ILMN","DXCM","IDXX",
  "ALNY","BMRN","EXEL","IONS","HALO","SRPT","ARWR","FOLD","KRYS","RARE",
  "ACAD","INVA","ARVN","ROIV","KYMR","BLUE","RCKT","EDIT","NTLA","CRSP",
  "BEAM","PACB","VERV","PRME","TGTX","IMVT","JAZZ","INCY","SRTX",
  "PCVX","NUVB","KURA","RVMD","VCEL","RXRX","GKOS","LNTH","SMMT",
];

const UNIVERSE_SMALLCAP = [
  "AFRM","HOOD","UPST","SOFI","LC","DAVE","OPEN","UWMC","PFSI",
  "CELH","USFD","CHWY","W","PRCT","HIMS","ACMR","RELY",
  "ASAN","BRZE","CWAN","ALTR","PAGS","CAAP","TFII",
  "COUR","UDMY","DUOL","SMAR","DOMO","YEXT","FSLY","BAND","LPSN","HUBS",
  "MNDY","BILL","PCTY","PAYC","TOST","FOUR","GPN","RPAY","PAYO",
  "SHAK","CAVA","WING","TXRH","BROS","RKLB","LUNR","ASTS","JOBY",
  "STEP","PIPR","HLNE","VCTR","APAM","IBKR","LPLA",
  "CRDO","AXON","DKNG","ELF","COTY","IPAR","BOOT","FND","PLNT",
];

const UNIVERSE_MAGS7 = [
  "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA",
];

const UNIVERSE_AICLOUD = [
  "NVDA","MSFT","GOOGL","AMZN","META","ORCL","CRM","NOW","SNOW","MDB",
  "DDOG","PLTR","AI","BBAI","SOUN","GFAI","ARQQ","IQ","PATH","AAON",
  "ANET","SMCI","DELL","HPE","NTAP","PSTG","BOX","OKTA","ZI","GTLB",
  "ARM","CRWD","PANW","ZS","NET","ESTC","CFLT","NEWR","DATADOG","S",
];

const UNIVERSE_DIVIDEND = [
  "JNJ","PG","KO","MCD","PEP","MMM","CL","CLX","GIS","MO",
  "PM","T","VZ","O","NNN","STAG","D","SO","DUK","ED",
  "AEP","XEL","WEC","CMS","LNT","PPL","NFG","NI","SWX","PNW",
  "ABBV","BMY","MRK","AMGN","GILD","ABT","MDT","BDX","SYK","ZBH",
  "KMB","SJM","HRL","GPC","EMR","ITW","SWK","DOV","APD","SHW",
];

const ALL_TICKERS = [...new Set([
  ...UNIVERSE_SP500, ...UNIVERSE_NASDAQ100, ...UNIVERSE_DOW30,
  ...UNIVERSE_RUSSELL2000, ...UNIVERSE_MIDCAP,
  ...UNIVERSE_TECH, ...UNIVERSE_FINANCE, ...UNIVERSE_HEALTH,
  ...UNIVERSE_ENERGY, ...UNIVERSE_CONSUMER, ...UNIVERSE_INDUSTRIALS,
  ...UNIVERSE_UTILITIES, ...UNIVERSE_MATERIALS, ...UNIVERSE_REALESTATE,
  ...UNIVERSE_COMMS, ...UNIVERSE_SEMIS, ...UNIVERSE_BIOTECH,
  ...UNIVERSE_SMALLCAP, ...UNIVERSE_MAGS7, ...UNIVERSE_AICLOUD,
  ...UNIVERSE_DIVIDEND,
])];

const UNIVERSES: Record<string, string[]> = {
  // Broad indices
  sp500:       UNIVERSE_SP500,
  nasdaq100:   UNIVERSE_NASDAQ100,
  dow30:       UNIVERSE_DOW30,
  russell2000: UNIVERSE_RUSSELL2000,
  midcap:      UNIVERSE_MIDCAP,
  // GICS sectors
  tech:     UNIVERSE_TECH,
  finance:  UNIVERSE_FINANCE,
  health:   UNIVERSE_HEALTH,
  energy:   UNIVERSE_ENERGY,
  consumer: UNIVERSE_CONSUMER,
  industrials: UNIVERSE_INDUSTRIALS,
  utilities:   UNIVERSE_UTILITIES,
  materials:   UNIVERSE_MATERIALS,
  realestate:  UNIVERSE_REALESTATE,
  comms:       UNIVERSE_COMMS,
  // Thematic
  semis:    UNIVERSE_SEMIS,
  biotech:  UNIVERSE_BIOTECH,
  smallcap: UNIVERSE_SMALLCAP,
  mags7:    UNIVERSE_MAGS7,
  aicloud:  UNIVERSE_AICLOUD,
  dividend: UNIVERSE_DIVIDEND,
  // Everything
  all:      ALL_TICKERS,
};

// ── Per-tenant cache (5-min TTL) ──────────────────────────────────────────
interface CacheEntry {
  records: Record<string, unknown>[];
  cachedAt: Date;
}
const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

async function getTenantKeys(tenantId: number): Promise<TenantProviderKeys> {
  try {
    const rows = await db.select().from(apiKeysTable).where(eq(apiKeysTable.tenantId, tenantId)).limit(1);
    const row = rows[0];
    if (!row) return {};
    const safe = (enc: string | null | undefined): string | undefined => {
      if (!enc) return undefined;
      try { return decrypt(enc); } catch { return undefined; }
    };
    return { polygonKey: safe(row.polygonApiKeyEnc), finnhubKey: safe(row.finnhubApiKeyEnc) };
  } catch { return {}; }
}

// ── GET /api/screener ─────────────────────────────────────────────────────
router.get("/screener", async (req, res): Promise<void> => {
  const q = req.query as Record<string, string | undefined>;

  const universeKey   = (q.universe ?? "sp500") as string;
  const bust          = q.bust === "true";

  const priceMin  = parseFloat(q.priceMin  ?? "1");
  const priceMax  = parseFloat(q.priceMax  ?? "10000");
  const rsiMin    = parseFloat(q.rsiMin    ?? "0");
  const rsiMax    = parseFloat(q.rsiMax    ?? "100");
  const adxMin    = parseFloat(q.adxMin    ?? "0");
  const rvolMin   = parseFloat(q.rvolMin   ?? "0");
  const scoreMin  = parseFloat(q.scoreMin  ?? "0");
  const stochMin  = q.stochMin  != null ? parseFloat(q.stochMin)  : null;
  const stochMax  = q.stochMax  != null ? parseFloat(q.stochMax)  : null;

  // ── Alex's Screener rules (all optional; only filter when provided) ───────
  // range52wMin:    52-week high / low multiple, e.g. 2 = "2x range"
  // mom1mMin:       minimum ~1-month momentum as a fraction, e.g. 0.20 = +20%
  // nearHigh52wPct: must trade within this % of the 52-week high, e.g. 0.10
  const range52wMin    = q.range52wMin    != null ? parseFloat(q.range52wMin)    : null;
  const mom1mMin       = q.mom1mMin       != null ? parseFloat(q.mom1mMin)       : null;
  const nearHigh52wPct = q.nearHigh52wPct != null ? parseFloat(q.nearHigh52wPct) : null;

  const verdictFilter    = q.verdictFilter     ?? "all";
  const aboveEma10       = q.aboveEma10        === "true";
  const aboveSma20       = q.aboveSma20        === "true";
  const emaStackRequired = q.emaStackRequired  === "true";
  const macd3mAboveZero  = q.macd3mAboveZero   === "true";
  const macd3mHistPos    = q.macd3mHistPositive === "true";
  const breakoutOnly     = q.breakoutOnly      === "true";

  const tickers = UNIVERSES[universeKey] ?? UNIVERSES.sp500;
  const key = `${req.tenantId}:${universeKey}`;
  const cached = cache.get(key);
  const stale = !cached || bust || Date.now() - cached.cachedAt.getTime() > TTL_MS;

  let allRecords: Record<string, unknown>[];

  if (stale) {
    req.log.info({ universe: universeKey, count: tickers.length }, "screener: scanning universe");
    const providerKeys = await getTenantKeys(req.tenantId);
    const result = await runScan(tickers, DEFAULT_CONFIG, false, providerKeys);
    allRecords = [
      ...result.candidates,
      ...result.hold,
      ...result.rejected,
    ] as unknown as Record<string, unknown>[];
    cache.set(key, { records: allRecords, cachedAt: new Date() });
    req.log.info({ scanned: allRecords.length }, "screener: cache populated");
  } else {
    allRecords = cached!.records;
  }

  // ── Tier-1 gate: only records with valid Yahoo Finance data ──────────────
  type AnyRec = {
    verdict: string;
    score: number;
    reason?: string;
    technical?: Record<string, unknown> | null;
  };

  const tier1Records = (allRecords as AnyRec[]).filter((c) => {
    const tech = (c.technical ?? {}) as Record<string, unknown>;
    // Require Yahoo Finance to have returned a valid OHLCV dataset
    return tech.ok === true && c.reason !== "SCAN_ERROR";
  });

  // ── Apply user filters ────────────────────────────────────────────────
  const filtered = tier1Records.filter((c) => {
    const tech = (c.technical ?? {}) as Record<string, unknown>;
    const price      = tech.price      as number | undefined;
    const rsi        = tech.rsi        as number | undefined;
    const adx        = tech.adx        as number | undefined;
    const rvol       = tech.rvol       as number | undefined;
    const ema10      = tech.ema10      as number | undefined;
    const sma20      = tech.sma20      as number | undefined;
    const stochSlowK = tech.stochSlowK as number | undefined;
    const macd3mLine = tech.macd3m     as number | undefined;
    const macd3mHist = tech.macd3mHist as number | undefined;
    const emaStackOk = Boolean(tech.ema_stack_ok);
    const breakout   = Boolean(tech.breakout);
    const range52w       = tech.range52w       as number | undefined;
    const mom1m          = tech.mom1m          as number | undefined;
    const pctFromHigh52w = tech.pctFromHigh52w as number | undefined;

    if (price  != null && (price  < priceMin || price  > priceMax)) return false;
    if (rsi    != null && (rsi    < rsiMin   || rsi    > rsiMax  )) return false;
    if (adx    != null &&  adx    < adxMin                        ) return false;
    if (rvol   != null &&  rvol   < rvolMin                       ) return false;
    if (c.score < scoreMin) return false;

    if (verdictFilter === "go"      && c.verdict !== "GO"                         ) return false;
    if (verdictFilter === "go_hold" && c.verdict !== "GO" && c.verdict !== "HOLD") return false;

    if (aboveEma10       && ema10 != null && price != null && price < ema10) return false;
    if (aboveSma20       && sma20 != null && price != null && price < sma20) return false;
    if (emaStackRequired && !emaStackOk) return false;
    if (breakoutOnly     && !breakout  ) return false;

    if (stochMin != null && stochSlowK != null && stochSlowK < stochMin) return false;
    if (stochMax != null && stochSlowK != null && stochSlowK > stochMax) return false;

    if (macd3mAboveZero && macd3mLine != null && macd3mLine < 0) return false;
    if (macd3mHistPos   && macd3mHist != null && macd3mHist < 0) return false;

    // ── Alex's Screener rules ──────────────────────────────────────────────
    // Rule 1 — 2x Range: 52-week high at least N× the 52-week low.
    if (range52wMin != null && (range52w == null || range52w < range52wMin)) return false;
    // Rule 3 — Monthly Momentum: up at least N% over the trailing month.
    if (mom1mMin != null && (mom1m == null || mom1m < mom1mMin)) return false;
    // Rule 4 — Within X% of the 52-week high.
    if (nearHigh52wPct != null && (pctFromHigh52w == null || pctFromHigh52w < -nearHigh52wPct)) return false;
    // Rule 2 — price band ($1–$10) is enforced via priceMin/priceMax above.

    return true;
  });

  filtered.sort((a, b) => b.score - a.score);

  const entry = cache.get(key);
  res.json({
    results: filtered,
    total: filtered.length,
    scanned: allRecords.length,
    validData: tier1Records.length,
    cachedAt: entry?.cachedAt.toISOString() ?? new Date().toISOString(),
  });
});

export default router;
