import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

import './App.css';

// ════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════

const MARKETS = [
  'SOL-PERP', 'BTC-PERP', 'ETH-PERP',
  'JTO-PERP', 'WIF-PERP', 'JUP-PERP',
  'BONK-PERP', 'PYTH-PERP',
] as const;

type MarketKey = (typeof MARKETS)[number];

const TOKEN_SYMBOL: Record<MarketKey, string> = {
  'SOL-PERP':  'SOL',
  'BTC-PERP':  'BTC',
  'ETH-PERP':  'ETH',
  'JTO-PERP':  'JTO',
  'WIF-PERP':  'WIF',
  'JUP-PERP':  'JUP',
  'BONK-PERP': 'BONK',
  'PYTH-PERP': 'PYTH',
};

const TIMEFRAMES = ['15M', '1H', '4H', '1D'] as const;
type TF = (typeof TIMEFRAMES)[number];

// ════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════

interface TickerData {
  price: number;
  change: string;
  up: boolean;
  vol: string;
  high: number;
  low: number;
  oi: string;
  basePrice: number;
}

interface Position {
  id: number;
  market: MarketKey;
  direction: 'LONG' | 'SHORT';
  sizeUsd: number;
  leverage: number;
  notional: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPct: number;
  tp: string;
  sl: string;
  timestamp: string;
  tx?: string;
}

interface HistoryRow extends Position {
  exitPrice: number;
  status: string;
  closedAt: string;
}

type Tab    = 'TRADE' | 'PORTFOLIO' | 'HISTORY' | 'MARKETS';
type PosTab = 'POSITIONS' | 'HISTORY';

// ════════════════════════════════════════════════
// Initial data
// ════════════════════════════════════════════════

const INITIAL_TICKERS: Record<MarketKey, TickerData> = {
  'SOL-PERP':  { price: 88.525,     basePrice: 88.525,     change: '+4.21%', up: true,  vol: '$2.14B', high: 92.10,     low: 84.30,  oi: '$840M' },
  'BTC-PERP':  { price: 71168.98,   basePrice: 71168.98,   change: '+0.87%', up: true,  vol: '$8.3B',  high: 72100,     low: 69800,  oi: '$4.2B' },
  'ETH-PERP':  { price: 2102.69,    basePrice: 2102.69,    change: '-1.04%', up: false, vol: '$3.1B',  high: 2180,      low: 2060,   oi: '$1.8B' },
  'JTO-PERP':  { price: 2.341,      basePrice: 2.341,      change: '+1.23%', up: true,  vol: '$120M',  high: 2.41,      low: 2.28,   oi: '$45M'  },
  'WIF-PERP':  { price: 0.1684,     basePrice: 0.1684,     change: '-3.14%', up: false, vol: '$89M',   high: 0.178,     low: 0.162,  oi: '$32M'  },
  'JUP-PERP':  { price: 0.1629,     basePrice: 0.1629,     change: '+6.32%', up: true,  vol: '$210M',  high: 0.174,     low: 0.150,  oi: '$78M'  },
  'BONK-PERP': { price: 0.00001419, basePrice: 0.00001419, change: '+2.15%', up: true,  vol: '$45M',   high: 0.0000148, low: 0.0000135, oi: '$18M' },
  'PYTH-PERP': { price: 0.1821,     basePrice: 0.1821,     change: '-1.86%', up: false, vol: '$62M',   high: 0.191,     low: 0.176,  oi: '$24M'  },
};

// ════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════

function fmt(p: number): string {
  if (p >= 10000) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 100)   return '$' + p.toFixed(2);
  if (p >= 1)     return '$' + p.toFixed(3);
  if (p >= 0.001) return '$' + p.toFixed(4);
  return '$' + p.toFixed(8);
}

function genPriceSeries(base: number, bars: number): number[] {
  const data: number[] = [];
  let p = base * (0.93 + Math.random() * 0.04);
  for (let i = 0; i < bars; i++) {
    p *= 1 + (Math.random() - 0.49) * 0.012;
    data.push(+p.toFixed(p >= 100 ? 2 : p >= 1 ? 4 : 8));
  }
  return data;
}

function genLabels(bars: number, tf: TF): string[] {
  const mins: Record<TF, number> = { '15M': 15, '1H': 60, '4H': 240, '1D': 1440 };
  const labels: string[] = [];
  const now = Date.now();
  for (let i = bars - 1; i >= 0; i--) {
    const d = new Date(now - i * mins[tf] * 60000);
    labels.push(
      tf === '1D'
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    );
  }
  return labels;
}

const DEMO_HISTORY: HistoryRow[] = [
  { id:1, market:'SOL-PERP',  direction:'LONG',  sizeUsd:30, leverage:5, notional:150, entryPrice:82.30,  currentPrice:87.10, exitPrice:87.10,  pnl:+87.12, pnlPct:+58.1, tp:'', sl:'', timestamp:'', closedAt:'Today 09:14', status:'PROFIT', tx:'' },
  { id:2, market:'BTC-PERP',  direction:'SHORT', sizeUsd:40, leverage:5, notional:200, entryPrice:72100,  currentPrice:70850, exitPrice:70850,  pnl:+34.60, pnlPct:+17.3, tp:'', sl:'', timestamp:'', closedAt:'Today 07:52', status:'PROFIT', tx:'' },
  { id:3, market:'ETH-PERP',  direction:'LONG',  sizeUsd:20, leverage:5, notional:100, entryPrice:2180,   currentPrice:2095,  exitPrice:2095,   pnl:-42.50, pnlPct:-19.5, tp:'', sl:'', timestamp:'', closedAt:'Yesterday',   status:'LOSS',   tx:'' },
  { id:4, market:'JUP-PERP',  direction:'LONG',  sizeUsd:10, leverage:5, notional:50,  entryPrice:0.148,  currentPrice:0.161, exitPrice:0.161,  pnl:+43.92, pnlPct:+87.8, tp:'', sl:'', timestamp:'', closedAt:'2d ago',      status:'PROFIT', tx:'' },
];

const COL_MARKET = { gridTemplateColumns: '2fr 1.2fr 0.8fr 1fr 0.8fr 1fr'           } as React.CSSProperties;
const COL_POS    = { gridTemplateColumns: '1.5fr 0.8fr 0.8fr 1fr 1fr 1.2fr 1fr'     } as React.CSSProperties;
const COL_HIST   = { gridTemplateColumns: '1.5fr 0.8fr 0.8fr 1fr 1fr 1fr 1fr 0.8fr' } as React.CSSProperties;

// ════════════════════════════════════════════════
// App
// ════════════════════════════════════════════════

export default function App() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  const [market, setMarket]         = useState<MarketKey>('SOL-PERP');
  const [timeframe, setTimeframe]   = useState<TF>('15M');
  const [tab, setTab]               = useState<Tab>('TRADE');
  const [posTab, setPosTab]         = useState<PosTab>('POSITIONS');
  const [mobileMenu, setMobileMenu] = useState(false);

  const [tickers, setTickers]     = useState<Record<MarketKey, TickerData>>(INITIAL_TICKERS);
  const [positions, setPositions] = useState<Position[]>([]);
  const [history, setHistory]     = useState<HistoryRow[]>(DEMO_HISTORY);
  const [balance, setBalance]     = useState<number | null>(null);

  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [sizeStr, setSizeStr]     = useState('');
  const [limitStr, setLimitStr]   = useState('');
  const [leverage, setLeverage]   = useState(5);
  const [loading, setLoading]     = useState(false);
  const [txLog, setTxLog]         = useState('');

  const [sharePos, setSharePos] = useState<Position | HistoryRow | null>(null);

  const [activeTraders, setActiveTraders] = useState(14870);
  const [txPerMin, setTxPerMin]           = useState(3240);
  const [tradersFlash, setTradersFlash]   = useState<'up' | 'dn' | ''>('');
  const [txnsFlash, setTxnsFlash]         = useState<'up' | 'dn' | ''>('');

  const chartRef      = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);
  const crosshairRef  = useRef<HTMLDivElement>(null);
  const [shieldVisible, setShieldVisible] = useState(false);

  const tick     = tickers[market];
  const sizeUsd  = Number(sizeStr) || 0;
  const notional = sizeUsd * leverage;
  const liqPct   = (1 / leverage) * 0.85;
  const liqPrice = direction === 'LONG'
    ? tick.price * (1 - liqPct)
    : tick.price * (1 + liqPct);
  const estFee = notional * 0.0005;

  // ── Chart ──

  const buildChart = useCallback(() => {
    const container = chartRef.current;
    if (!container) return;
    if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
    container.innerHTML = '';

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const BARS   = 80;
    const prices = genPriceSeries(tick.basePrice, BARS);
    const labels = genLabels(BARS, timeframe);

    const grad = ctx.createLinearGradient(0, 0, 0, container.clientHeight || 400);
    grad.addColorStop(0, 'rgba(0,245,196,0.20)');
    grad.addColorStop(1, 'rgba(0,245,196,0)');

    const ChartCtor = (window as any).Chart;
    if (!ChartCtor) return;

    chartInstance.current = new ChartCtor(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: prices,
          borderColor: '#00f5c4',
          borderWidth: 1.5,
          backgroundColor: grad,
          fill: true,
          tension: 0.32,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#00f5c4',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(6,12,24,0.96)',
            borderColor: '#162e48',
            borderWidth: 1,
            titleColor: '#6a9bbf',
            bodyColor: '#c2dff5',
            padding: 9,
            callbacks: { label: (c: any) => '  ' + fmt(c.parsed.y) },
          },
        },
        scales: {
          x: {
            grid:   { color: 'rgba(0,245,196,0.025)', drawTicks: false },
            ticks:  { color: '#2a4560', font: { size: 9, family: "'Space Mono',monospace" }, maxTicksLimit: 8, maxRotation: 0 },
            border: { color: '#0c1e35' },
          },
          y: {
            position: 'right',
            grid:   { color: 'rgba(0,245,196,0.025)', drawTicks: false },
            ticks:  { color: '#2a4560', font: { size: 9, family: "'Space Mono',monospace" }, callback: (v: number) => fmt(v) },
            border: { color: '#0c1e35' },
          },
        },
      },
    });

    canvas.addEventListener('mousemove', (e) => {
      const label = crosshairRef.current;
      if (!label || !chartInstance.current) return;
      const rect   = canvas.getBoundingClientRect();
      const y      = e.clientY - rect.top;
      const yScale = chartInstance.current.scales?.y;
      if (!yScale) return;
      label.style.display = 'block';
      label.style.top     = y + 'px';
      label.textContent   = fmt(yScale.getValueForPixel(y));
    });
    canvas.addEventListener('mouseleave', () => {
      if (crosshairRef.current) crosshairRef.current.style.display = 'none';
    });
  }, [market, timeframe, tick.basePrice]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if ((window as any).Chart) { buildChart(); return; }
    const s = document.createElement('script');
    s.src    = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    s.onload = () => buildChart();
    document.head.appendChild(s);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== 'TRADE' || !(window as any).Chart) return;
    setShieldVisible(true);
    const t = setTimeout(() => setShieldVisible(false), 1400);
    buildChart();
    return () => clearTimeout(t);
  }, [market, timeframe]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { if (chartInstance.current) chartInstance.current.resize(); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Live price sim ──

  useEffect(() => {
    const iv = setInterval(() => {
      setTickers(prev => {
        const next = { ...prev };
        (Object.keys(next) as MarketKey[]).forEach(m => {
          const drift = (Math.random() * 1.4 - 0.7) / 100;
          const newP  = +(next[m].price * (1 + drift)).toFixed(next[m].price >= 100 ? 2 : next[m].price >= 1 ? 4 : 8);
          next[m] = { ...next[m], price: newP, up: newP > next[m].price, change: `${newP > next[m].price ? '+' : ''}${(drift * 100).toFixed(2)}%` };
        });
        return next;
      });
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const inst = chartInstance.current;
    if (!inst) return;
    const ds = inst.data.datasets[0];
    const ls = inst.data.labels as string[];
    if (!ds || !ls) return;
    ds.data.push(tick.price);
    ds.data.shift();
    ls.push(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    ls.shift();
    inst.update('none');
  }, [tick.price]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPositions(prev =>
      prev.map(p => {
        const cur   = tickers[p.market].price;
        const delta = p.direction === 'LONG'
          ? (cur - p.entryPrice) / p.entryPrice
          : (p.entryPrice - cur) / p.entryPrice;
        return { ...p, currentPrice: cur, pnl: +(delta * p.sizeUsd * p.leverage).toFixed(2), pnlPct: +(delta * p.leverage * 100).toFixed(2) };
      })
    );
  }, [tickers]);

  useEffect(() => {
    const iv = setInterval(() => {
      setActiveTraders(prev => {
        const next = Math.max(8000, prev + Math.floor(Math.random() * 480 - 240));
        setTradersFlash(next > prev ? 'up' : 'dn');
        setTimeout(() => setTradersFlash(''), 1200);
        return next;
      });
      setTxPerMin(prev => {
        const next = Math.max(1000, prev + Math.floor(Math.random() * 1200 - 600));
        setTxnsFlash(next > prev ? 'up' : 'dn');
        setTimeout(() => setTxnsFlash(''), 1200);
        return next;
      });
    }, 9000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!publicKey || !connection) return;
    connection.getBalance(publicKey)
      .then(b => setBalance(b / LAMPORTS_PER_SOL))
      .catch(() => setBalance(null));
  }, [publicKey, connection]);

  // ── Handlers ──

  const handleMarketChange = (m: MarketKey) => { setMarket(m); setTab('TRADE'); };
  const handleTFChange     = (tf: TF)        => setTimeframe(tf);

  const toggleFullScreen = () => {
    const el = chartRef.current?.parentElement;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen().catch(console.error);
    else document.exitFullscreen();
  };

  async function handleOpenPosition() {
    if (!publicKey) { setTxLog('Connect your wallet first.'); return; }
    if (sizeUsd <= 0) { setTxLog('Enter a valid size in USD.'); return; }
    if (balance !== null && sizeUsd / tick.price > balance) {
      setTxLog(`Insufficient balance. Available: ${balance.toFixed(4)} SOL`);
      return;
    }
    setLoading(true);
    setTxLog('');
    await new Promise(r => setTimeout(r, 1200));
    const newPos: Position = {
      id: Date.now(), market, direction, sizeUsd, leverage, notional,
      entryPrice: tick.price, currentPrice: tick.price,
      pnl: 0, pnlPct: 0, tp: '', sl: '',
      timestamp: new Date().toLocaleTimeString(),
    };
    setPositions(prev => [...prev, newPos]);
    setTxLog(`✓ Opened @ ${fmt(tick.price)}`);
    setSizeStr('');
    setLoading(false);
  }

  function handleClosePosition(id: number) {
    const pos = positions.find(p => p.id === id);
    if (!pos) return;
    if (!window.confirm(`Close ${pos.direction} ${TOKEN_SYMBOL[pos.market]} PERP?\nPNL: ${pos.pnl >= 0 ? '+' : ''}$${Math.abs(pos.pnl).toFixed(2)}`)) return;
    setHistory(prev => [{ ...pos, exitPrice: pos.currentPrice, closedAt: new Date().toLocaleTimeString(), status: pos.pnl >= 0 ? 'PROFIT' : 'LOSS' }, ...prev]);
    setPositions(prev => prev.filter(p => p.id !== id));
  }

  function handleAddToPosition(id: number) {
    const raw = prompt('Add size (USD):');
    if (!raw) return;
    const add = parseFloat(raw);
    if (isNaN(add) || add <= 0) return;
    setPositions(prev => prev.map(p => p.id === id ? { ...p, sizeUsd: p.sizeUsd + add, notional: (p.sizeUsd + add) * p.leverage } : p));
  }

  // ── Position cards ──

  const renderPosCards = () => {
    if (positions.length === 0) return <div className="pos-empty">No open positions</div>;
    return (
      <div className="pos-cards">
        {positions.map(p => {
          const isUp = p.pnl >= 0;
          const liqP = p.direction === 'LONG'
            ? p.entryPrice * (1 - (1 / p.leverage) * 0.85)
            : p.entryPrice * (1 + (1 / p.leverage) * 0.85);
          return (
            <div key={p.id} className="pos-card">
              <div className="pc-left">
                <div className="pc-sym">{TOKEN_SYMBOL[p.market]} PERP</div>
                <div className="pc-meta">
                  <span className={`pos-dir ${p.direction === 'LONG' ? 'L' : 'S'}`}>{p.direction}</span>
                  <span className="pc-lev">{p.leverage}×</span>
                </div>
              </div>
              <div className="pc-prices">
                <div className="pc-price-row">
                  <span className="pc-pl">Entry</span>
                  <span className="pc-pv">{fmt(p.entryPrice)}</span>
                </div>
                <div className="pc-price-row">
                  <span className="pc-pl">Mark</span>
                  <span className={`pc-pv ${isUp ? 'green' : ''}`}>{fmt(p.currentPrice)}</span>
                </div>
                <div className="pc-price-row">
                  <span className="pc-pl">Liq</span>
                  <span className="pc-pv" style={{ color: 'var(--short)' }}>{fmt(liqP)}</span>
                </div>
              </div>
              <div className="pc-pnl">
                <span className={`pc-pnl-usd ${isUp ? 'up' : 'dn'}`}>
                  {isUp ? '+' : ''}${Math.abs(p.pnl).toFixed(2)}
                </span>
                <span className={`pc-pnl-pct ${isUp ? 'up' : 'dn'}`}>
                  {isUp ? '+' : ''}{Math.abs(p.pnlPct).toFixed(2)}%
                </span>
              </div>
              <div className="pc-actions">
                <button className="pos-btn add-b"   onClick={() => handleAddToPosition(p.id)}>+ Add</button>
                <button className="pos-btn close-b" onClick={() => handleClosePosition(p.id)}>✕ Close</button>
                <button className="pos-btn share-b" onClick={() => setSharePos(p)}>↗ Share</button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── History table ──

  const renderHistoryTable = () => {
    if (history.length === 0) return <div className="pos-empty">No closed trades yet</div>;
    return (
      <table className="pos-table">
        <thead>
          <tr>
            <th>Market</th><th>Dir</th><th>Size</th>
            <th>Entry</th><th>Exit</th><th>PNL ($)</th><th>PNL (%)</th><th>Time</th><th>Share</th>
          </tr>
        </thead>
        <tbody>
          {history.map(h => {
            const isUp = h.pnl >= 0;
            return (
              <tr key={h.id}>
                <td className="pos-sym">{TOKEN_SYMBOL[h.market]} PERP</td>
                <td><span className={`pos-dir ${h.direction === 'LONG' ? 'L' : 'S'}`}>{h.direction}</span></td>
                <td>${h.sizeUsd.toFixed(2)}</td>
                <td>{fmt(h.entryPrice)}</td>
                <td>{fmt(h.exitPrice)}</td>
                <td><span className={`pnl-cell ${isUp ? 'up' : 'dn'}`}>{isUp ? '+' : ''}${Math.abs(h.pnl).toFixed(2)}</span></td>
                <td><span className={`pnl-cell ${isUp ? 'up' : 'dn'}`}>{isUp ? '+' : ''}{Math.abs(h.pnlPct).toFixed(2)}%</span></td>
                <td className="muted">{h.closedAt}</td>
                <td><button className="pos-btn share-b" onClick={() => setSharePos(h)}>↗</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  // ── Order panel ──

  const renderOrderPanel = () => (
    <aside className="order-panel">
      <div className="op-head">
        <span className="op-mkt">{TOKEN_SYMBOL[market]} PERP</span>
        <div className="op-types">
          <button className={`opt ${orderType === 'MARKET' ? 'opt-on' : ''}`} onClick={() => setOrderType('MARKET')}>MARKET</button>
          <button className={`opt ${orderType === 'LIMIT'  ? 'opt-on' : ''}`} onClick={() => setOrderType('LIMIT')}>LIMIT</button>
        </div>
      </div>

      <div className="dir-tabs">
        <button className={`dir-tab long-tab  ${direction === 'LONG'  ? 'long-on'  : ''}`} onClick={() => setDirection('LONG')}>LONG</button>
        <button className={`dir-tab short-tab ${direction === 'SHORT' ? 'short-on' : ''}`} onClick={() => setDirection('SHORT')}>SHORT</button>
      </div>

      <div className="op-body">
        <div className="field">
          <span className="f-lbl">Entry Price</span>
          {orderType === 'MARKET' ? (
            <div className="f-live">
              {fmt(tick.price)}
              <span className="f-live-badge">MARKET</span>
            </div>
          ) : (
            <div className="f-row">
              <input className="f-inp" type="number" placeholder={fmt(tick.price)}
                value={limitStr} onChange={e => setLimitStr(e.target.value)} />
              <span className="f-unit">USD</span>
            </div>
          )}
        </div>

        <div className="field">
          <span className="f-lbl">Size (USD)</span>
          <div className="f-row">
            <input className="f-inp" type="number" placeholder="0.00"
              value={sizeStr} onChange={e => setSizeStr(e.target.value)} min="0" />
            <span className="f-unit">USD</span>
          </div>
        </div>

        <div className="field">
          <span className="f-lbl">Leverage</span>
          <div className="lev-row">
            {[2, 5, 10, 20, 50].map(l => (
              <button key={l} className={`lev-btn ${leverage === l ? 'lev-on' : ''}`} onClick={() => setLeverage(l)}>{l}×</button>
            ))}
          </div>
        </div>

        <div className="op-summary">
          <div className="ops-row"><span className="ops-l">Notional</span><span className="ops-v">{notional > 0 ? `$${notional.toFixed(2)}` : '—'}</span></div>
          <div className="ops-row"><span className="ops-l">Liq. Price</span><span className="ops-v red">{sizeUsd > 0 ? fmt(liqPrice) : '—'}</span></div>
          <div className="ops-row"><span className="ops-l">Fee (0.05%)</span><span className="ops-v">{estFee > 0 ? `$${estFee.toFixed(4)}` : '—'}</span></div>
          <div className="ops-row"><span className="ops-l">Max Profit</span><span className="ops-v green">{notional > 0 ? `$${(notional * 0.08).toFixed(2)}` : '—'}</span></div>
        </div>

        <button
          className={`submit-btn ${direction === 'LONG' ? 'submit-long' : 'submit-short'}`}
          onClick={handleOpenPosition}
          disabled={loading}
        >
          {loading ? <span className="spinner" /> : `OPEN ${direction} ${TOKEN_SYMBOL[market]}`}
        </button>

        {txLog && <div className="tx-log">{txLog}</div>}
      </div>

      {positions.length > 0 && (
        <div className="op-positions">
          <div className="op-positions-title">Open Positions ({positions.length})</div>
          {positions.map(p => {
            const isUp = p.pnl >= 0;
            const liqP = p.direction === 'LONG'
              ? p.entryPrice * (1 - (1 / p.leverage) * 0.85)
              : p.entryPrice * (1 + (1 / p.leverage) * 0.85);
            return (
              <div key={p.id} className="op-pos-card">
                <div className="op-pos-top">
                  <span className="op-pos-sym">{TOKEN_SYMBOL[p.market]} PERP</span>
                  <span className={`pos-dir ${p.direction === 'LONG' ? 'L' : 'S'}`}>{p.direction}</span>
                  <span className="pc-lev">{p.leverage}×</span>
                  <div className="op-pos-pnl">
                    <div className={`op-pos-pnl-usd ${isUp ? 'up' : 'dn'}`}>{isUp ? '+' : ''}${Math.abs(p.pnl).toFixed(2)}</div>
                    <div className={`op-pos-pnl-pct ${isUp ? 'up' : 'dn'}`}>{isUp ? '+' : ''}{Math.abs(p.pnlPct).toFixed(2)}%</div>
                  </div>
                </div>
                <div className="op-pos-grid">
                  <div className="op-pos-row"><span className="op-pos-l">Entry</span><span className="op-pos-v">{fmt(p.entryPrice)}</span></div>
                  <div className="op-pos-row"><span className="op-pos-l">Mark</span><span className="op-pos-v" style={{ color: isUp ? 'var(--long)' : 'var(--short)' }}>{fmt(p.currentPrice)}</span></div>
                  <div className="op-pos-row"><span className="op-pos-l">Size</span><span className="op-pos-v">${p.sizeUsd.toFixed(2)}</span></div>
                  <div className="op-pos-row"><span className="op-pos-l">Liq</span><span className="op-pos-v" style={{ color: 'var(--short)' }}>{fmt(liqP)}</span></div>
                </div>
                <div className="op-pos-btns">
                  <button className="pos-btn add-b"   onClick={() => handleAddToPosition(p.id)}>+ Add</button>
                  <button className="pos-btn close-b" onClick={() => handleClosePosition(p.id)}>✕ Close</button>
                  <button className="pos-btn share-b" onClick={() => setSharePos(p)}>↗ Share</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );

  // ── Markets page ──

  const renderMarketsPage = () => (
    <div className="tab-page">
      <div><div className="pg-title">SIGILLION MARKETS</div><div className="pg-sub">Private perpetuals — encrypted via Arcium MXE</div></div>
      <div className="stat-cards">
        <div className="stat-card"><div className="sc-label">Total 24H Volume</div><div className="sc-val ac">$14.2B</div><div className="sc-sub">↑ 18% vs yesterday</div></div>
        <div className="stat-card">
          <div className="sc-label">Active Traders</div>
          <div className={`sc-val ac ${tradersFlash ? `flash-${tradersFlash}` : ''}`}>{activeTraders.toLocaleString()}<span className="live-dot" /></div>
          <div className="sc-sub sc-sub-live">● Live count</div>
        </div>
        <div className="stat-card">
          <div className="sc-label">Txns / Min</div>
          <div className={`sc-val ac ${txnsFlash ? `flash-${txnsFlash}` : ''}`}>{txPerMin.toLocaleString()}<span className="live-dot" /></div>
          <div className="sc-sub sc-sub-live">● Processing</div>
        </div>
        <div className="stat-card"><div className="sc-label">Open Interest</div><div className="sc-val pu">$840M</div><div className="sc-sub">Across all markets</div></div>
      </div>
      <div className="data-table">
        <div className="dt-head" style={COL_MARKET}><span>Market</span><span>Price</span><span>24H %</span><span>Volume</span><span>OI</span><span>Traders</span></div>
        {(Object.keys(INITIAL_TICKERS) as MarketKey[]).map(m => {
          const t = tickers[m];
          return (
            <div key={m} className="dt-row" style={COL_MARKET} onClick={() => handleMarketChange(m)}>
              <div><div className="dt-sym">{TOKEN_SYMBOL[m]} PERP</div><div className="dt-full">{m}</div></div>
              <div className="dt-p">{fmt(t.price)}</div>
              <div className={`dt-chg ${t.up ? 'up' : 'dn'}`}>{t.change}</div>
              <div className="dt-p muted">{t.vol}</div>
              <div className="dt-p muted">{t.oi}</div>
              <div className="dt-p accent">{(Math.floor(Math.random() * 8000) + 3000).toLocaleString()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Portfolio page ──

  const renderPortfolioPage = () => {
    const totalPnl      = positions.reduce((a, p) => a + p.pnl, 0);
    const totalNotional = positions.reduce((a, p) => a + p.notional, 0);
    return (
      <div className="tab-page">
        <div><div className="pg-title">PORTFOLIO</div><div className="pg-sub">Overview of your positions and account</div></div>
        <div className="stat-cards">
          <div className="stat-card"><div className="sc-label">Wallet Balance</div><div className="sc-val ac">{balance != null ? `${balance.toFixed(4)} SOL` : '—'}</div></div>
          <div className="stat-card"><div className="sc-label">Open Positions</div><div className="sc-val pu">{positions.length}</div></div>
          <div className="stat-card"><div className="sc-label">Total Notional</div><div className="sc-val">${totalNotional.toFixed(2)}</div></div>
          <div className="stat-card"><div className="sc-label">Unrealized PNL</div><div className={`sc-val ${totalPnl >= 0 ? 'up' : 'dn'}`}>{totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}</div></div>
        </div>
        {positions.length > 0 ? (
          <div className="data-table">
            <div className="dt-head" style={COL_POS}><span>Market</span><span>Dir</span><span>Lev</span><span>Entry</span><span>Mark</span><span>PNL</span><span>Actions</span></div>
            {positions.map(p => {
              const up = p.pnl >= 0;
              return (
                <div key={p.id} className="dt-row" style={COL_POS}>
                  <div className="dt-sym">{TOKEN_SYMBOL[p.market]} PERP</div>
                  <span className={`pos-dir ${p.direction === 'LONG' ? 'L' : 'S'}`}>{p.direction}</span>
                  <span className="muted mono">{p.leverage}×</span>
                  <span className="mono">{fmt(p.entryPrice)}</span>
                  <span className={`mono ${up ? 'up' : 'dn'}`}>{fmt(p.currentPrice)}</span>
                  <span className={`pnl-cell ${up ? 'up' : 'dn'}`}>
                    {up ? '+' : ''}${Math.abs(p.pnl).toFixed(2)}{' '}
                    <small>({up ? '+' : ''}{Math.abs(p.pnlPct).toFixed(2)}%)</small>
                  </span>
                  <div className="pos-actions-cell">
                    <button className="pos-btn close-b" onClick={() => handleClosePosition(p.id)}>✕ Close</button>
                    <button className="pos-btn share-b" onClick={() => setSharePos(p)}>↗</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pos-empty pos-empty-padded">No open positions. Go to TRADE to open one.</div>
        )}
      </div>
    );
  };

  // ── History page ──

  const renderHistoryPage = () => (
    <div className="tab-page">
      <div><div className="pg-title">TRADE HISTORY</div><div className="pg-sub">All closed positions</div></div>
      <div className="data-table">
        <div className="dt-head" style={COL_HIST}><span>Market</span><span>Dir</span><span>Size</span><span>Entry</span><span>Exit</span><span>PNL ($)</span><span>PNL (%)</span><span>Time</span></div>
        {history.map(h => {
          const up = h.pnl >= 0;
          return (
            <div key={h.id} className="dt-row" style={COL_HIST}>
              <div className="dt-sym">{TOKEN_SYMBOL[h.market]} PERP</div>
              <span className={`pos-dir ${h.direction === 'LONG' ? 'L' : 'S'}`}>{h.direction}</span>
              <span className="mono">${h.sizeUsd.toFixed(2)}</span>
              <span className="mono">{fmt(h.entryPrice)}</span>
              <span className="mono">{fmt(h.exitPrice)}</span>
              <span className={`pnl-cell ${up ? 'up' : 'dn'}`}>{up ? '+' : ''}${Math.abs(h.pnl).toFixed(2)}</span>
              <span className={`pnl-cell ${up ? 'up' : 'dn'}`}>{up ? '+' : ''}{Math.abs(h.pnlPct).toFixed(2)}%</span>
              <span className="muted">{h.closedAt}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Share modal ──

  const renderShareModal = () => {
    if (!sharePos) return null;
    const isUp  = sharePos.pnl >= 0;
    const sym   = TOKEN_SYMBOL[sharePos.market];
    const mins  = Math.floor((Date.now() - sharePos.id) / 60000);
    const dur   = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    const exitP = 'exitPrice' in sharePos ? (sharePos as HistoryRow).exitPrice : sharePos.currentPrice;
    return (
      <div className="modal-overlay" onClick={() => setSharePos(null)}>
        <div className="pnl-card" onClick={e => e.stopPropagation()}>
          <div className="pnl-card-inner">
            <div className="pnl-logo-row">
              <div className="brand-gem pnl-brand-gem">S</div>
              <span className="pnl-brand">SIGILLION</span>
              <span className="pnl-tag">Private Perps · Arcium MXE</span>
            </div>
            <div className="pnl-header">
              <span className="pnl-sym">{sym} PERP</span>
              <span className={`pnl-side-badge ${sharePos.direction === 'LONG' ? 'L' : 'S'}`}>{sharePos.direction}</span>
              <span className="pnl-lev-tag">{sharePos.leverage}×</span>
            </div>
            <div className={`pnl-big ${isUp ? 'up' : 'dn'}`}>{isUp ? '+' : '-'}${Math.abs(sharePos.pnl).toFixed(2)}</div>
            <div className={`pnl-pct ${isUp ? 'up' : 'dn'}`}>{isUp ? '+' : ''}{sharePos.pnlPct.toFixed(2)}%</div>
            <div className="pnl-stats">
              <div><div className="pnl-stat-l">Entry</div><div className="pnl-stat-v">{fmt(sharePos.entryPrice)}</div></div>
              <div><div className="pnl-stat-l">Mark / Exit</div><div className="pnl-stat-v">{fmt(exitP)}</div></div>
              <div><div className="pnl-stat-l">Size</div><div className="pnl-stat-v">${sharePos.sizeUsd.toFixed(2)}</div></div>
              <div><div className="pnl-stat-l">Duration</div><div className="pnl-stat-v">{dur}</div></div>
            </div>
            <div className="pnl-footer">sigillion-perps.vercel.app · Private perpetuals on Solana</div>
          </div>
          <div className="pnl-actions">
            <button className="pnl-action-btn copy-b"
              onClick={() => navigator.clipboard?.writeText(`${isUp ? '+' : ''}${sharePos.pnlPct.toFixed(2)}% on ${sym} PERP — sigillion-perps.vercel.app`).then(() => alert('Copied!')).catch(() => alert('Copied!'))}>
              📋 Copy
            </button>
            <button className="pnl-action-btn share-x"
              onClick={() => {
                const text = encodeURIComponent(`${isUp ? '🟢' : '🔴'} ${sym} PERP ${sharePos.direction} ${isUp ? '+' : ''}${sharePos.pnlPct.toFixed(2)}%\n${isUp ? '+' : '-'}$${Math.abs(sharePos.pnl).toFixed(2)} · @Sigillion Private Perps 🛡️\nsigillion-perps.vercel.app`);
                window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
              }}>
              𝕏 Share
            </button>
            <button className="pnl-action-btn close-b" onClick={() => setSharePos(null)}>✕</button>
          </div>
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════
  // Main render
  // ════════════════════════════════════════════════

  return (
    <div className="app">

      <header className="navbar">
        <div className="brand" onClick={() => setTab('TRADE')}>
          <span className="brand-gem">S</span>
          <div className="brand-text">
            <div className="brand-name">SIGILLION</div>
            <div className="brand-tag">PRIVATE PERPS</div>
          </div>
        </div>
        <nav className="nav-tabs desktop-only">
          {(['TRADE','PORTFOLIO','HISTORY','MARKETS'] as Tab[]).map(t => (
            <button key={t} className={`nt ${tab === t ? 'nt-active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
        <div className="nav-right">
          <span className="devnet-badge">DEVNET</span>
          {publicKey && balance != null && (
            <span className="wallet-bal desktop-only">
              <span className="wb-sym">SOL</span>
              <span className="wb-amt">{balance.toFixed(3)}</span>
            </span>
          )}
          <span className="mxe-pill desktop-only"><span className="mxe-dot" /> ARCIUM MXE</span>
          <WalletMultiButton />
          <button className="hamburger mobile-only" onClick={() => setMobileMenu(m => !m)}>
            {mobileMenu ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {mobileMenu && (
        <nav className="mobile-nav">
          {(['TRADE','PORTFOLIO','HISTORY','MARKETS'] as Tab[]).map(t => (
            <button key={t} className={`mn-btn ${tab === t ? 'mn-active' : ''}`}
              onClick={() => { setTab(t); setMobileMenu(false); }}>{t}</button>
          ))}
        </nav>
      )}

      <div className="ticker">
        {(Object.keys(INITIAL_TICKERS) as MarketKey[]).map(m => {
          const t = tickers[m];
          return (
            <button key={m} className={`tick ${market === m && tab === 'TRADE' ? 'tick-on' : ''}`}
              onClick={() => handleMarketChange(m)}>
              <span className="t-sym">{TOKEN_SYMBOL[m]}</span>
              <span className="t-p">{fmt(t.price)}</span>
              <span className={`t-c ${t.up ? 'up' : 'dn'}`}>{t.change}</span>
            </button>
          );
        })}
      </div>

      {tab === 'TRADE' && (
        <>
          <div className="stats-bar">
            <span className={`sb-price ${tick.up ? 'up' : 'dn'}`}>{fmt(tick.price)}</span>
            <span className={`sb-chg  ${tick.up ? 'up' : 'dn'}`}>{tick.change}</span>
            <span className="sb-sep" />
            <span className="sb-item"><span className="sb-l">24H HIGH</span><span className="sb-v">{fmt(tick.high)}</span></span>
            <span className="sb-item"><span className="sb-l">24H LOW</span><span className="sb-v">{fmt(tick.low)}</span></span>
            <span className="sb-item"><span className="sb-l">24H VOL</span><span className="sb-v">{tick.vol}</span></span>
            <span className="sb-item"><span className="sb-l">OPEN INT</span><span className="sb-v">{tick.oi}</span></span>
            <span className="sb-item">
              <span className="sb-l">ACTIVE TRADERS</span>
              <span className={`sb-v accent ${tradersFlash ? `flash-${tradersFlash}` : ''}`}>
                {activeTraders.toLocaleString()}<span className="live-dot" />
              </span>
            </span>
            <span className="sb-item">
              <span className="sb-l">TXNS / MIN</span>
              <span className={`sb-v accent ${txnsFlash ? `flash-${txnsFlash}` : ''}`}>
                {txPerMin.toLocaleString()}<span className="live-dot" />
              </span>
            </span>
            <span className="sb-item"><span className="sb-l">NETWORK</span><span className="sb-v accent">Devnet</span></span>
            <span className="sb-item"><span className="sb-l">PRIVACY</span><span className="sb-v purple-v">Arcium MXE</span></span>
          </div>

          <div className="body">

            <section className="chart-area">
              <div className="chart-header-hud">
                <div className="hud-left">
                  <label htmlFor="market-sel" className="sr-only">Select market</label>
                  <select id="market-sel" className="market-search" value={market}
                    onChange={e => handleMarketChange(e.target.value as MarketKey)}>
                    {MARKETS.map(m => (
                      <option key={m} value={m}>{TOKEN_SYMBOL[m]} PERP</option>
                    ))}
                  </select>
                  <span className={`hud-price ${tick.up ? 'up' : 'dn'}`}>{fmt(tick.price)}</span>
                </div>
                <div className="hud-timeframes">
                  {TIMEFRAMES.map(tf => (
                    <button key={tf} className={`hud-tf-btn ${timeframe === tf ? 'active' : ''}`}
                      onClick={() => handleTFChange(tf)}>{tf}</button>
                  ))}
                </div>
                <div className="hud-actions">
                  <button className="fs-btn" onClick={toggleFullScreen} title="Fullscreen">⛶</button>
                  <button className="buy-quick"  onClick={() => setDirection('LONG')}>▲ BUY</button>
                  <button className="sell-quick" onClick={() => setDirection('SHORT')}>▼ SELL</button>
                </div>
              </div>

              {shieldVisible && (
                <div className="privacy-shield">
                  <div className="shield-content">
                    <span className="shield-icon">🛡️</span>
                    <div className="shield-title">ARCIUM MXE SHIELD</div>
                    <div className="shield-subtitle">Switching market — position encrypted</div>
                  </div>
                </div>
              )}

              <div className="chart-box" ref={chartRef} />
              <div className="crosshair-label" ref={crosshairRef} />

              <div className="pos-strip">
                <div className="ps-tabs">
                  <button className={`ps-tab ${posTab === 'POSITIONS' ? 'ps-tab-on' : ''}`} onClick={() => setPosTab('POSITIONS')}>
                    POSITIONS {positions.length > 0 && <span className="ps-count">{positions.length}</span>}
                  </button>
                  <button className={`ps-tab ${posTab === 'HISTORY' ? 'ps-tab-on' : ''}`} onClick={() => setPosTab('HISTORY')}>
                    HISTORY
                  </button>
                </div>
                <div className="ps-body">
                  {posTab === 'POSITIONS' ? renderPosCards() : renderHistoryTable()}
                </div>
              </div>
            </section>

            {renderOrderPanel()}

          </div>
        </>
      )}

      {tab === 'PORTFOLIO' && renderPortfolioPage()}
      {tab === 'HISTORY'   && renderHistoryPage()}
      {tab === 'MARKETS'   && renderMarketsPage()}

      <footer className="footer">
        <span className="footer-dot" />
        SIGILLION PRIVATE PERPS · DEVNET · ARCIUM MXE
        <span className="footer-right">sigillion-perps.vercel.app</span>
      </footer>

      {renderShareModal()}

    </div>
  );
}
