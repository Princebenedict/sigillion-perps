import React, { useState, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

import { openPosition } from './utils/sigillion';
import { submitToArcium } from './utils/arcium';

import './App.css';

// ────────────────────────────────────────────────
// Constants / Types
// ────────────────────────────────────────────────

const MARKETS = {
  'SOL-PERP': 'BINANCE:SOLUSDT',
  'BTC-PERP': 'BINANCE:BTCUSDT',
  'ETH-PERP': 'BINANCE:ETHUSDT',
  'JTO-PERP': 'BINANCE:JTOUSDT',
  'WIF-PERP': 'BINANCE:WIFUSDT',
  'JUP-PERP': 'BINANCE:JUPUSDT',
} as const;

const TOKEN_SYMBOL = {
  'SOL-PERP': 'SOL',
  'BTC-PERP': 'BTC',
  'ETH-PERP': 'ETH',
  'JTO-PERP': 'JTO',
  'WIF-PERP': 'WIF',
  'JUP-PERP': 'JUP',
} as const;

type MarketKey = keyof typeof MARKETS;

const PREFERRED_TIMEFRAMES = ['15', '60', '240', 'D'] as const;
const TF_LABELS = {
  '15': '15M',
  '60': '1H',
  '240': '4H',
  'D': '1D',
} as const;

type Timeframe = typeof PREFERRED_TIMEFRAMES[number];

interface TickerData {
  price: number;
  change: string;
  up: boolean;
  vol: string;
  high: string;
  low: string;
  oi: string;
}

const INITIAL_TICKER: Record<MarketKey, TickerData> = {
  'SOL-PERP': { price: 88.525,   change: '+4.21%', up: true,  vol: '$2.14B', high: '92.10', low: '84.30', oi: '$840M' },
  'BTC-PERP': { price: 71168.98, change: '+0.87%', up: true,  vol: '$8.3B',  high: '72100', low: '69800', oi: '$4.2B' },
  'ETH-PERP': { price: 2102.69,  change: '-1.04%', up: false, vol: '$3.1B',  high: '2180',  low: '2060',  oi: '$1.8B' },
  'JTO-PERP': { price: 2.341,    change: '+1.23%', up: true,  vol: '$120M',  high: '2.41',  low: '2.28',  oi: '$45M'  },
  'WIF-PERP': { price: 0.1684,   change: '-3.14%', up: false, vol: '$89M',   high: '0.178', low: '0.162', oi: '$32M'  },
  'JUP-PERP': { price: 0.1629,   change: '+6.32%', up: true,  vol: '$210M',  high: '0.174', low: '0.150', oi: '$78M'  },
};

type Tab = 'TRADE' | 'PORTFOLIO' | 'HISTORY' | 'MARKETS';
type Position = {
  id: number;
  market: MarketKey;
  direction: 'LONG' | 'SHORT';
  sizeNative: number;
  sizeUsd: number;
  leverage: number;
  notional: number;
  tx?: string;
  revealed: boolean;
  entryPrice: number;
  tp: string;
  sl: string;
  timestamp: string;
  pnl: number;
  pnlPct: number;
};

// ────────────────────────────────────────────────
// Main App Component
// ────────────────────────────────────────────────

export default function App() {
  const { publicKey, sendTransaction, wallet } = useWallet();
  const { connection } = useConnection();

  const chartRef = useRef<HTMLDivElement>(null);

  const [market, setMarket] = useState<MarketKey>('SOL-PERP');
  const [timeframe, setTimeframe] = useState<Timeframe>('15');
  const [activeTab, setActiveTab] = useState<Tab>('TRADE');

  const [positions, setPositions] = useState<Position[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  const [balance, setBalance] = useState<number | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [pnlModal, setPnlModal] = useState<Position & { previewUrl?: string } | null>(null);

  // Trade form state
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [orderType, setOrderType] = useState('MARKET');
  const [sizeNativeStr, setSizeNativeStr] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [leverage, setLeverage] = useState(5);
  const [tpsl, setTpsl] = useState({ tp: '', sl: '' });
  const [showTpsl, setShowTpsl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [txLog, setTxLog] = useState('');

  const [prices, setPrices] = useState(INITIAL_TICKER);
  const [showPrivacyShield, setShowPrivacyShield] = useState(false);
  const tvScriptLoaded = useRef(false);

  // ── Live community / activity stats ──
  const [activeTraders, setActiveTraders] = useState(14870);
  const [txPerMin, setTxPerMin] = useState(3240);

  // ── Flash state for color animation ──
  const [tradersFlash, setTradersFlash] = useState<'up' | 'dn' | null>(null);
  const [txnsFlash, setTxnsFlash] = useState<'up' | 'dn' | null>(null);

  const sizeNative = Number(sizeNativeStr) || 0;
  const tick = prices[market];
  const tokenSymbol = TOKEN_SYMBOL[market];
  const usdValue = sizeNative * tick.price;
  const notional = usdValue * leverage;

  // ────────────────────────────────────────────────
  // Price simulation
  // ────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setPrices(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach((m: MarketKey) => {
          const changePct = (Math.random() * 1.2 - 0.6);
          const newPrice = Number((updated[m].price * (1 + changePct / 100)).toFixed(4));
          updated[m] = {
            ...updated[m],
            price: newPrice,
            up: newPrice > updated[m].price,
            change: `${newPrice > updated[m].price ? '+' : ''}${(changePct).toFixed(2)}%`,
          };
        });
        return updated;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // ────────────────────────────────────────────────
  // Live stats fluctuation + flash
  // ────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTraders(prev => {
        const change = Math.floor(Math.random() * 480 - 240);
        const next = Math.max(8000, prev + change);

        if (next > prev) setTradersFlash('up');
        else if (next < prev) setTradersFlash('dn');
        setTimeout(() => setTradersFlash(null), 1200);

        return next;
      });

      setTxPerMin(prev => {
        const change = Math.floor(Math.random() * 1200 - 600);
        const next = Math.max(1200, prev + change);

        if (next > prev) setTxnsFlash('up');
        else if (next < prev) setTxnsFlash('dn');
        setTimeout(() => setTxnsFlash(null), 1200);

        return next;
      });
    }, Math.random() * 7000 + 8000); // 8–15 seconds

    return () => clearInterval(interval);
  }, []);

  // ────────────────────────────────────────────────
  // Load TradingView script only once
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (tvScriptLoaded.current) return;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      tvScriptLoaded.current = true;
    };
    document.head.appendChild(script);

    return () => {};
  }, []);

  // ────────────────────────────────────────────────
  // Chart creation & cleanup
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current || activeTab !== 'TRADE' || !tvScriptLoaded.current) return;

    const containerId = 'tradingview_widget';
    chartRef.current.innerHTML = `<div id="${containerId}" style="width:100%;height:100%;"></div>`;

    const widget = new (window as any).TradingView.widget({
      autosize: true,
      symbol: MARKETS[market],
      interval: timeframe,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      toolbar_bg: "#060c18",
      backgroundColor: "#030710",
      gridColor: "rgba(0,245,196,0.02)",
      hide_top_toolbar: true,
      hide_side_toolbar: true,
      allow_symbol_change: false,
      container_id: containerId,
      disabled_features: [
        "header_widget", "left_toolbar", "footer_widget",
        "context_menus", "control_bar", "symbol_search",
        "timeframes_widget", "pane_buttons", "legend",
        "scales", "drawings", "symbol_info", "compare",
        "undo_redo",
      ],
      overrides: {
        "paneProperties.background": "#030710",
        "paneProperties.vertGridProperties.color": "rgba(0,245,196,0.02)",
        "paneProperties.horzGridProperties.color": "rgba(0,245,196,0.02)",
        "scalesProperties.textColor": "#6a9bbf",
        "mainSeriesProperties.candleStyle.upColor": "#00e676",
        "mainSeriesProperties.candleStyle.downColor": "#ff1650",
      }
    });

    widget.onChartReady(() => {
      setTimeout(() => {
        const els = document.querySelectorAll('[class*="symbol"], .tv-symbol-label');
        els.forEach(el => (el as HTMLElement).style.display = 'none');
      }, 1200);

      window.dispatchEvent(new Event('resize'));
    });

    setShowPrivacyShield(true);
    const timer = setTimeout(() => setShowPrivacyShield(false), 1400);

    return () => {
      clearTimeout(timer);
      if (chartRef.current) chartRef.current.innerHTML = '';
    };
  }, [market, timeframe, activeTab]);

  // ────────────────────────────────────────────────
  // Live PNL update
  // ────────────────────────────────────────────────
  useEffect(() => {
    setPositions(prev =>
      prev.map(p => {
        const current = prices[p.market].price;
        const rawPnl = p.direction === 'LONG'
          ? (current - p.entryPrice) / p.entryPrice
          : (p.entryPrice - current) / p.entryPrice;

        const pnl = rawPnl * p.sizeUsd * p.leverage;
        const pnlPct = rawPnl * p.leverage * 100;

        return {
          ...p,
          pnl: Number(pnl.toFixed(2)),
          pnlPct: Number(pnlPct.toFixed(2)),
        };
      })
    );
  }, [prices]);

  // ────────────────────────────────────────────────
  // Fullscreen toggle
  // ────────────────────────────────────────────────
  const toggleFullScreen = () => {
    const elem = chartRef.current?.parentElement;
    if (!elem) return;

    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  // ────────────────────────────────────────────────
  // Balance fetch
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (!publicKey || !connection) return;
    connection.getBalance(publicKey)
      .then(bal => setBalance(bal / LAMPORTS_PER_SOL))
      .catch(() => setBalance(null));
  }, [publicKey, connection]);

  async function handleOpenPosition() {
    if (!publicKey || !wallet) return;
    if (balance !== null && sizeNative > balance) {
      setTxLog(`Insufficient balance: ${balance.toFixed(4)} SOL available`);
      return;
    }
    if (sizeNative <= 0) {
      setTxLog('Enter a valid size');
      return;
    }

    setLoading(true);
    setTxLog('');

    const timeout = setTimeout(() => {
      setLoading(false);
      setTxLog('Transaction timeout');
    }, 60000);

    try {
      const { commitmentHash } = await submitToArcium({
        size: usdValue,
        direction,
        leverage,
      });

      const tx = await openPosition({
        connection,
        publicKey,
        sendTransaction,
        direction: direction === 'LONG' ? 0 : 1,
        leverage,
        commitmentHash,
      });

      clearTimeout(timeout);

      setTxLog(`Position opened — TX: ${tx}`);

      const newPos: Position = {
        id: Date.now(),
        market,
        direction,
        sizeNative,
        sizeUsd: usdValue,
        leverage,
        notional,
        tx,
        revealed: false,
        entryPrice: prices[market].price,
        tp: tpsl.tp,
        sl: tpsl.sl,
        timestamp: new Date().toLocaleTimeString(),
        pnl: 0,
        pnlPct: 0,
      };

      setPositions(prev => [...prev, newPos]);
      setHistory(prev => [...prev, {
        ...newPos,
        status: 'FILLED',
        timestamp: new Date().toLocaleString(),
      }]);

      setSizeNativeStr('');
    } catch (err: any) {
      clearTimeout(timeout);
      setTxLog(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────

  return (
    <div className="app">

      {/* Navbar */}
      <header className="navbar">
        <div className="brand">
          <span className="brand-gem">S</span>
          <div className="brand-text">
            <div className="brand-name">SIGILLION</div>
            <div className="brand-tag">PRIVATE PERPS</div>
          </div>
        </div>

        <nav className="nav-tabs desktop-only">
          {(['TRADE', 'PORTFOLIO', 'HISTORY', 'MARKETS'] as Tab[]).map(t => (
            <button
              key={t}
              className={`nt ${activeTab === t ? 'nt-active' : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="nav-right">
          <div className="devnet-badge">DEVNET</div>
          {publicKey && balance != null && (
            <div className="wallet-bal">
              <span className="wb-sym">SOL</span>
              <span className="wb-amt">{balance.toFixed(3)}</span>
            </div>
          )}
          <div className="mxe-pill desktop-only">
            <span className="mxe-dot" /> ARCIUM MXE
          </div>
          <WalletMultiButton />
          <button className="hamburger mobile-only" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? 'X' : '='}
          </button>
        </div>
      </header>

      {mobileMenu && (
        <div className="mobile-nav">
          {(['TRADE', 'PORTFOLIO', 'HISTORY', 'MARKETS'] as Tab[]).map(t => (
            <button
              key={t}
              className={`mn-btn ${activeTab === t ? 'mn-active' : ''}`}
              onClick={() => { setActiveTab(t); setMobileMenu(false); }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Ticker */}
      <div className="ticker">
        {Object.entries(INITIAL_TICKER).map(([sym, d]) => (
          <button
            key={sym}
            className={`tick ${market === sym && activeTab === 'TRADE' ? 'tick-on' : ''}`}
            onClick={() => { setMarket(sym as MarketKey); setActiveTab('TRADE'); }}
          >
            <span className="t-sym">{sym.replace('-PERP', '')}</span>
            <span className="t-p">${prices[sym as MarketKey].price.toLocaleString()}</span>
            <span className={`t-c ${prices[sym as MarketKey].up ? 'up' : 'dn'}`}>
              {prices[sym as MarketKey].change}
            </span>
          </button>
        ))}
      </div>

      {activeTab === 'TRADE' && (
        <>
          {/* Stats bar with flash effect */}
          <div className="stats-bar">
            <span className={`sb-price ${tick.up ? 'up' : 'dn'}`}>
              ${tick.price.toLocaleString()}
            </span>
            <span className={`sb-chg ${tick.up ? 'up' : 'dn'}`}>
              {tick.change}
            </span>
            <span className="sb-sep" />

            <span className="sb-item">
              <span className="sb-l">24H HIGH</span>
              <span className="sb-v">${tick.high}</span>
            </span>
            <span className="sb-item">
              <span className="sb-l">24H LOW</span>
              <span className="sb-v">${tick.low}</span>
            </span>
            <span className="sb-item">
              <span className="sb-l">24H VOL</span>
              <span className="sb-v">{tick.vol}</span>
            </span>
            <span className="sb-item">
              <span className="sb-l">OPEN INT</span>
              <span className="sb-v">{tick.oi}</span>
            </span>

            {/* Active Traders with flash */}
            <span className="sb-item">
              <span className="sb-l">ACTIVE TRADERS</span>
              <span className={`sb-v accent flash-${tradersFlash || ''}`}>
                {activeTraders.toLocaleString()}
                <span className="live-dot" />
              </span>
            </span>

            {/* TXNS / MIN with flash */}
            <span className="sb-item">
              <span className="sb-l">TXNS / MIN</span>
              <span className={`sb-v accent flash-${txnsFlash || ''}`}>
                {txPerMin.toLocaleString()}
                <span className="live-dot" />
              </span>
            </span>

            <span className="sb-item">
              <span className="sb-l">NETWORK</span>
              <span className="sb-v accent">Devnet</span>
            </span>
            <span className="sb-item">
              <span className="sb-l">PRIVACY</span>
              <span className="sb-v purple">Arcium MXE</span>
            </span>
          </div>

          <div className="body">
            {/* Order panel */}
            <div className="order-panel">
              {/* your order panel content */}
            </div>

            {/* Chart Area */}
            <div className="chart-area">
              <div className="chart-header-hud">
                <div className="hud-left">
                  {/* FIX: Hidden label for accessibility */}
                  <label htmlFor="market-select" className="sr-only">
                    Select trading pair
                  </label>

                  <select
                    id="market-select"
                    className="market-search"
                    value={market}
                    // FIX: Safe type guard instead of unsafe cast
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value in MARKETS) {
                        setMarket(value as MarketKey);
                      }
                    }}
                  >
                    {Object.keys(MARKETS).map(m => (
                      <option key={m} value={m}>
                        {m.replace('-PERP', '')} PERP
                      </option>
                    ))}
                  </select>

                  <span className={`hud-price ${tick.up ? 'up' : 'dn'}`}>
                    ${tick.price.toLocaleString()}
                  </span>
                </div>

                <div className="hud-timeframes">
                  {PREFERRED_TIMEFRAMES.map(tf => (
                    <button
                      key={tf}
                      className={`hud-tf-btn ${timeframe === tf ? 'active' : ''}`}
                      onClick={() => setTimeframe(tf)}
                    >
                      {TF_LABELS[tf]}
                    </button>
                  ))}
                </div>

                <div className="hud-actions">
                  <button className="fs-btn" onClick={toggleFullScreen}>
                    ⛶
                  </button>
                  <button className="buy-quick" onClick={() => setDirection('LONG')}>
                    BUY
                  </button>
                  <button className="sell-quick" onClick={() => setDirection('SHORT')}>
                    SELL
                  </button>
                </div>
              </div>

              {showPrivacyShield && (
                <div className="privacy-shield">
                  <div className="shield-content">
                    <span className="shield-icon">🛡️</span>
                    <div>
                      <div className="shield-title">ARCIUM MXE SHIELD</div>
                      <div className="shield-subtitle">Position encrypted</div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chartRef} className="chart-box" />
            </div>

            {/* Positions strip & book */}
          </div>
        </>
      )}

      {/* Other tabs */}
      {/* Footer, modal, etc. */}
    </div>
  );
}