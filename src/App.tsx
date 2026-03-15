import React, { useState, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { openPosition } from './utils/sigillion';
import { submitToArcium } from './utils/arcium';
import './App.css';

const MARKETS: Record<string, string> = {
  'SOL-PERP': 'BINANCE:SOLUSDT',
  'BTC-PERP': 'BINANCE:BTCUSDT',
  'ETH-PERP': 'BINANCE:ETHUSDT',
  'JTO-PERP': 'BINANCE:JTOUSDT',
  'WIF-PERP': 'BINANCE:WIFUSDT',
  'JUP-PERP': 'BINANCE:JUPUSDT',
};

const TOKEN_SYMBOL: Record<string, string> = {
  'SOL-PERP': 'SOL', 'BTC-PERP': 'BTC', 'ETH-PERP': 'ETH',
  'JTO-PERP': 'JTO', 'WIF-PERP': 'WIF', 'JUP-PERP': 'JUP',
};

const TIMEFRAMES = ['1', '5', '15', '60', '240', 'D'];
const TF_LABELS: Record<string, string> = {
  '1': '1M', '5': '5M', '15': '15M', '60': '1H', '240': '4H', 'D': '1D',
};

const TICKER: Record<string, { price: number; change: string; up: boolean; vol: string; high: string; low: string; oi: string }> = {
  'SOL-PERP': { price: 88.525,   change: '+4.21%', up: true,  vol: '$2.14B', high: '92.10', low: '84.30', oi: '$840M' },
  'BTC-PERP': { price: 71168.98, change: '+0.87%', up: true,  vol: '$8.3B',  high: '72100', low: '69800', oi: '$4.2B' },
  'ETH-PERP': { price: 2102.69,  change: '-1.04%', up: false, vol: '$3.1B',  high: '2180',  low: '2060',  oi: '$1.8B' },
  'JTO-PERP': { price: 2.341,    change: '+1.23%', up: true,  vol: '$120M',  high: '2.41',  low: '2.28',  oi: '$45M'  },
  'WIF-PERP': { price: 0.1684,   change: '-3.14%', up: false, vol: '$89M',   high: '0.178', low: '0.162', oi: '$32M'  },
  'JUP-PERP': { price: 0.1629,   change: '+6.32%', up: true,  vol: '$210M',  high: '0.174', low: '0.150', oi: '$78M'  },
};

function genBook(base: number) {
  const asks = Array.from({ length: 12 }, (_, i) => ({
    price: (base + (i + 1) * 0.05).toFixed(4),
    size: (Math.random() * 450 + 30).toFixed(2),
    total: (Math.random() * 4000 + 200).toFixed(0),
    pct: Math.random() * 85 + 10,
  })).reverse();
  const bids = Array.from({ length: 12 }, (_, i) => ({
    price: (base - (i + 1) * 0.05).toFixed(4),
    size: (Math.random() * 450 + 30).toFixed(2),
    total: (Math.random() * 4000 + 200).toFixed(0),
    pct: Math.random() * 85 + 10,
  }));
  return { asks, bids };
}

type Tab = 'TRADE' | 'PORTFOLIO' | 'HISTORY' | 'MARKETS';

export default function App() {
  const { wallet, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const chartRef = useRef<HTMLDivElement>(null);

  const [market, setMarket] = useState('SOL-PERP');
  const [timeframe, setTimeframe] = useState('15');
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [orderType, setOrderType] = useState('MARKET');
  const [sizeNative, setSizeNative] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [leverage, setLeverage] = useState(5);
  const [loading, setLoading] = useState(false);
  const [txLog, setTxLog] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('TRADE');
  const [posTab, setPosTab] = useState('POSITIONS');
  const [book] = useState(genBook(88.52));
  const [balance, setBalance] = useState<number | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [positions, setPositions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [tpsl, setTpsl] = useState({ tp: '', sl: '' });
  const [showTpsl, setShowTpsl] = useState(false);

  const tick = TICKER[market];
  const tokenSymbol = TOKEN_SYMBOL[market];
  const nativeAmount = parseFloat(sizeNative) || 0;
  const usdValue = nativeAmount * tick.price;
  const notional = usdValue * leverage;

  useEffect(() => {
    if (!publicKey || !connection) return;
    connection.getBalance(publicKey).then((bal) => {
      setBalance(bal / LAMPORTS_PER_SOL);
    }).catch(() => setBalance(null));
  }, [publicKey, connection]);

  useEffect(() => {
    const container = chartRef.current;
    if (!container || activeTab !== 'TRADE') return;
    container.innerHTML = '';
    const existing = document.getElementById('tv-script');
    if (existing) existing.remove();
    const script = document.createElement('script');
    script.id = 'tv-script';
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if ((window as any).TradingView && container) {
        new (window as any).TradingView.widget({
          container_id: 'tv-chart',
          symbol: MARKETS[market],
          interval: timeframe,
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#050a14',
          enable_publishing: false,
          hide_top_toolbar: false,
          save_image: false,
          backgroundColor: '#050a14',
          gridColor: 'rgba(0,230,180,0.025)',
          width: '100%',
          height: '100%',
          allow_symbol_change: false,
        });
      }
    };
    document.head.appendChild(script);
    return () => { container.innerHTML = ''; };
  }, [market, timeframe, activeTab]);

  async function handleOpenPosition() {
    if (!publicKey || !wallet) return;

    if (balance !== null && nativeAmount > balance) {
      setTxLog(`Error: Insufficient balance. You have ${balance.toFixed(4)} SOL but need ${nativeAmount.toFixed(4)} SOL`);
      return;
    }

    if (nativeAmount <= 0) {
      setTxLog('Error: Please enter a valid size');
      return;
    }

    setLoading(true);
    setTxLog('');

    // Auto stop after 30 seconds if transaction hangs
    const timeout = setTimeout(() => {
      setLoading(false);
      setTxLog('Error: Transaction timed out. Please try again.');
    }, 60000);

    try {
      const { commitmentHash } = await submitToArcium({ size: usdValue, direction, leverage });
      const tx = await openPosition({
        connection,
        publicKey,
        sendTransaction,
        direction: direction === 'LONG' ? 0 : 1,
        leverage,
        commitmentHash
      });
      clearTimeout(timeout);
      setTxLog(`Position submitted. TX: ${tx}`);
      setPositions(prev => [...prev, {
        id: Date.now(), market, direction,
        sizeNative: nativeAmount, sizeUsd: usdValue,
        leverage, notional, tx,
        revealed: false,
        entryPrice: tick.price,
        tp: tpsl.tp, sl: tpsl.sl,
        timestamp: new Date().toLocaleTimeString(),
        pnl: 0,
      }]);
      setHistory(prev => [...prev, {
        id: Date.now(), market, direction,
        sizeNative: nativeAmount, sizeUsd: usdValue,
        leverage, tx, status: 'FILLED',
        entryPrice: tick.price,
        timestamp: new Date().toLocaleString(),
      }]);
      setSizeNative('');
    } catch (e: any) {
      clearTimeout(timeout);
      setTxLog(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function setPresetSize(pct: number) {
    if (balance === null) return;
    setSizeNative((balance * pct / 100).toFixed(4));
  }

  return (
    <div className="app">

      <header className="navbar">
        <div className="brand">
          <span className="brand-gem">S</span>
          <div className="brand-text">
            <div className="brand-name">SIGILLION</div>
            <div className="brand-tag">PRIVATE PERPS</div>
          </div>
        </div>
        <nav className="nav-tabs desktop-only">
          {(['TRADE', 'PORTFOLIO', 'HISTORY', 'MARKETS'] as Tab[]).map((t) => (
            <button key={t} className={`nt ${activeTab === t ? 'nt-active' : ''}`} onClick={() => setActiveTab(t)}>{t}</button>
          ))}
        </nav>
        <div className="nav-right">
          <div className="devnet-badge">DEVNET</div>
          {publicKey && balance !== null && (
            <div className="wallet-bal">
              <span className="wb-sym">SOL</span>
              <span className="wb-amt">{balance.toFixed(3)}</span>
            </div>
          )}
          <div className="mxe-pill desktop-only">
            <span className="mxe-dot" />
            <span>ARCIUM MXE</span>
          </div>
          <WalletMultiButton />
          <button className="hamburger mobile-only" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? 'X' : '='}
          </button>
        </div>
      </header>

      {mobileMenu && (
        <div className="mobile-nav">
          {(['TRADE', 'PORTFOLIO', 'HISTORY', 'MARKETS'] as Tab[]).map((t) => (
            <button key={t} className={`mn-btn ${activeTab === t ? 'mn-active' : ''}`} onClick={() => { setActiveTab(t); setMobileMenu(false); }}>{t}</button>
          ))}
        </div>
      )}

      <div className="ticker">
        {Object.entries(TICKER).map(([sym, d]) => (
          <button key={sym} className={`tick ${market === sym && activeTab === 'TRADE' ? 'tick-on' : ''}`} onClick={() => { setMarket(sym); setActiveTab('TRADE'); }}>
            <span className="t-sym">{sym.replace('-PERP', '')}</span>
            <span className="t-p">${d.price.toLocaleString()}</span>
            <span className={`t-c ${d.up ? 'up' : 'dn'}`}>{d.change}</span>
          </button>
        ))}
      </div>

      {activeTab === 'TRADE' && (
        <div className="stats-bar">
          <span className={`sb-price ${tick.up ? 'up' : 'dn'}`}>${tick.price.toLocaleString()}</span>
          <span className={`sb-chg ${tick.up ? 'up' : 'dn'}`}>{tick.change}</span>
          <span className="sb-sep" />
          <span className="sb-item"><span className="sb-l">24H HIGH</span><span className="sb-v">${tick.high}</span></span>
          <span className="sb-item"><span className="sb-l">24H LOW</span><span className="sb-v">${tick.low}</span></span>
          <span className="sb-item"><span className="sb-l">24H VOL</span><span className="sb-v">{tick.vol}</span></span>
          <span className="sb-item"><span className="sb-l">OPEN INT</span><span className="sb-v">{tick.oi}</span></span>
          <span className="sb-item"><span className="sb-l">NETWORK</span><span className="sb-v accent">Devnet</span></span>
          <span className="sb-item"><span className="sb-l">PRIVACY</span><span className="sb-v purple">Arcium MXE</span></span>
        </div>
      )}

      {activeTab === 'TRADE' && (
        <div className="body">

          {/* ORDER PANEL */}
          <div className="order-panel">
            <div className="op-head">
              <span className="op-mkt">{market}</span>
              <div className="op-types">
                {['MARKET', 'LIMIT', 'STOP'].map((ot) => (
                  <button key={ot} className={`opt ${orderType === ot ? 'opt-on' : ''}`} onClick={() => setOrderType(ot)}>{ot}</button>
                ))}
              </div>
            </div>

            <div className="dir-wrap">
              <button className={`dir-l ${direction === 'LONG' ? 'dir-l-on' : ''}`} onClick={() => setDirection('LONG')}>
                <span className="dir-arr">+</span>
                <span className="dir-name">LONG</span>
                <span className="dir-hint">BUY / ENTER</span>
              </button>
              <button className={`dir-s ${direction === 'SHORT' ? 'dir-s-on' : ''}`} onClick={() => setDirection('SHORT')}>
                <span className="dir-arr">-</span>
                <span className="dir-name">SHORT</span>
                <span className="dir-hint">SELL / ENTER</span>
              </button>
            </div>

            <div className="of">
              <div className="of-lbl">
                <span>SIZE ({tokenSymbol})</span>
                <span className="of-hint">Bal: {balance !== null ? `${balance.toFixed(3)} SOL` : '--'}</span>
              </div>
              <div className="of-inp">
                <input className="oi" type="number" placeholder="0.0000" value={sizeNative} onChange={(e) => setSizeNative(e.target.value)} />
                <span className="ou">{tokenSymbol}</span>
              </div>
              {nativeAmount > 0 && (
                <div className="usd-equiv">= ${usdValue.toFixed(2)} USD</div>
              )}
              <div className="presets">
                {[25, 50, 75, 100].map((p) => (
                  <button key={p} className="preset" onClick={() => setPresetSize(p)}>{p}%</button>
                ))}
              </div>
            </div>

            {orderType !== 'MARKET' && (
              <div className="of">
                <div className="of-lbl"><span>PRICE (USD)</span></div>
                <div className="of-inp">
                  <input className="oi" type="number" placeholder={tick.price.toString()} value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} />
                  <span className="ou">USD</span>
                </div>
              </div>
            )}

            <div className="of">
              <div className="of-lbl">
                <span>LEVERAGE</span>
                <span className="lev-pill">{leverage}x</span>
              </div>
              <input className="lev-range" type="range" min={1} max={20} value={leverage} title="Leverage" aria-label="Leverage" onChange={(e) => setLeverage(Number(e.target.value))} />
              <div className="lev-steps">
                {[1, 2, 5, 10, 20].map((v) => (
                  <button key={v} className={`ls ${leverage === v ? 'ls-on' : ''}`} onClick={() => setLeverage(v)}>{v}x</button>
                ))}
              </div>
            </div>

            <div className="tpsl-row">
              <button className={`tpsl-toggle ${showTpsl ? 'tpsl-on' : ''}`} onClick={() => setShowTpsl(!showTpsl)}>
                TP / SL {showTpsl ? '(ON)' : '(OFF)'}
              </button>
            </div>
            {showTpsl && (
              <div className="tpsl-fields">
                <div className="of-inp">
                  <input className="oi" type="number" placeholder="Take Profit" value={tpsl.tp} onChange={(e) => setTpsl(p => ({...p, tp: e.target.value}))} />
                  <span className="ou">USD</span>
                </div>
                <div className="of-inp tpsl-sl">
                  <input className="oi" type="number" placeholder="Stop Loss" value={tpsl.sl} onChange={(e) => setTpsl(p => ({...p, sl: e.target.value}))} />
                  <span className="ou">USD</span>
                </div>
              </div>
            )}

            <div className="summary">
              <div className="sr"><span>Size</span><span>{nativeAmount > 0 ? `${nativeAmount.toFixed(4)} ${tokenSymbol}` : '--'}</span></div>
              <div className="sr"><span>USD Value</span><span>{usdValue > 0 ? `$${usdValue.toFixed(2)}` : '--'}</span></div>
              <div className="sr"><span>Notional</span><span>{notional > 0 ? `$${notional.toFixed(2)}` : '--'}</span></div>
              <div className="sr"><span>Entry Price</span><span>${tick.price.toLocaleString()}</span></div>
              <div className="sr"><span>Fees (est.)</span><span>{notional > 0 ? `$${(notional * 0.0002).toFixed(4)}` : '--'}</span></div>
              <div className="sr"><span>Privacy</span><span className="purple">Arcium MXE</span></div>
            </div>

            {publicKey ? (
              <button className={`go ${direction === 'LONG' ? 'go-l' : 'go-s'}`} onClick={handleOpenPosition} disabled={loading || !sizeNative || nativeAmount <= 0}>
                {loading
                  ? <span className="go-spin">Processing...</span>
                  : <span className="go-txt">{direction} {tokenSymbol} {nativeAmount > 0 ? nativeAmount.toFixed(4) : ''}</span>
                }
              </button>
            ) : (
              <div className="connect-hint">Connect wallet (top right) to trade</div>
            )}

            {txLog && (
              <div className={`txmsg ${txLog.startsWith('Position') ? 'tok' : 'terr'}`}>{txLog}</div>
            )}
          </div>
          {/* END ORDER PANEL */}

          {/* CHART */}
          <div className="chart-area">
            <div className="chart-top">
              <div className="ct-info">
                <span className="ct-sym">{market}</span>
                <span className={`ct-p ${tick.up ? 'up' : 'dn'}`}>${tick.price.toLocaleString()}</span>
                <span className={`ct-c ${tick.up ? 'up' : 'dn'}`}>{tick.change}</span>
              </div>
              <div className="tf-row">
                {TIMEFRAMES.map((tf) => (
                  <button key={tf} className={`tf-b ${timeframe === tf ? 'tf-on' : ''}`} onClick={() => setTimeframe(tf)}>{TF_LABELS[tf]}</button>
                ))}
              </div>
            </div>
            <div id="tv-chart" ref={chartRef} className="chart-box" />
          </div>

          {/* POS-STRIP */}
          <div className="pos-strip">
            <div className="ps-tabs">
              {['POSITIONS', 'ORDERS', 'HISTORY'].map((t) => (
                <button key={t} className={`pst ${posTab === t ? 'pst-on' : ''}`} onClick={() => setPosTab(t)}>
                  {t}{t === 'POSITIONS' ? ` (${positions.length})` : ''}
                </button>
              ))}
              <span className="ps-shield">SHIELDED</span>
            </div>
            <div className="ps-body">
              {posTab === 'POSITIONS' && (
                positions.length === 0
                  ? <span className="ps-empty">{publicKey ? 'No open positions' : 'Connect wallet to view positions'}</span>
                  : <div className="pos-table">
                      <div className="pos-head">
                        <span>Market</span><span>Dir</span><span>Size</span><span>Entry</span><span>Lev</span><span>Privacy</span><span>Action</span>
                      </div>
                      {positions.map((p) => (
                        <div key={p.id} className="pos-row">
                          <span className="accent">{p.market}</span>
                          <span className={p.direction === 'LONG' ? 'up' : 'dn'}>{p.direction}</span>
                          <span>{p.revealed ? `${p.sizeNative.toFixed(4)} ${TOKEN_SYMBOL[p.market]}` : '****'}</span>
                          <span>${p.entryPrice.toLocaleString()}</span>
                          <span>{p.leverage}x</span>
                          <span className="purple">{p.revealed ? 'REVEALED' : 'ENCRYPTED'}</span>
                          <button className="reveal-btn" onClick={() => setPositions(prev => prev.map(x => x.id === p.id ? {...x, revealed: !x.revealed} : x))}>
                            {p.revealed ? 'HIDE' : 'REVEAL'}
                          </button>
                        </div>
                      ))}
                    </div>
              )}
              {posTab === 'ORDERS' && <span className="ps-empty">No open orders</span>}
              {posTab === 'HISTORY' && (
                history.length === 0
                  ? <span className="ps-empty">No trade history</span>
                  : <div className="pos-table">
                      <div className="pos-head"><span>Time</span><span>Market</span><span>Dir</span><span>Size</span><span>Entry</span><span>Status</span></div>
                      {history.map((h) => (
                        <div key={h.id} className="pos-row">
                          <span className="muted">{h.timestamp}</span>
                          <span className="accent">{h.market}</span>
                          <span className={h.direction === 'LONG' ? 'up' : 'dn'}>{h.direction}</span>
                          <span>{h.sizeNative.toFixed(4)} {TOKEN_SYMBOL[h.market]}</span>
                          <span>${h.entryPrice.toLocaleString()}</span>
                          <span className="up">{h.status}</span>
                        </div>
                      ))}
                    </div>
              )}
            </div>

            {/* METRICS */}
            <div className="ps-metrics">
              <div className="psm"><span className="psm-l">UNREAL. PNL</span><span className="psm-r up">$0.00</span></div>
              <div className="psm"><span className="psm-l">MARGIN</span><span className="psm-r purple">SEALED</span></div>
              <div className="psm"><span className="psm-l">BALANCE</span><span className="psm-r">{balance !== null ? `${balance.toFixed(3)} SOL` : '--'}</span></div>
              <div className="psm"><span className="psm-l">POSITIONS</span><span className="psm-r">{positions.length}</span></div>
            </div>

            {/* SCROLLING TICKER */}
            <div className="ps-ticker-wrap">
              <div className="ps-ticker-track">
                <span>SIGILLION PRIVATE PERPS</span>
                <span className="ps-ticker-sep">·</span>
                <span>POWERED BY ARCIUM MXE</span>
                <span className="ps-ticker-sep">·</span>
                <span>ENCRYPTED POSITIONS</span>
                <span className="ps-ticker-sep">·</span>
                <span>PRIVATE LIQUIDATIONS</span>
                <span className="ps-ticker-sep">·</span>
                <span>SOLANA DEVNET</span>
                <span className="ps-ticker-sep">·</span>
                <span>SIGILLION PRIVATE PERPS</span>
                <span className="ps-ticker-sep">·</span>
                <span>POWERED BY ARCIUM MXE</span>
                <span className="ps-ticker-sep">·</span>
                <span>ENCRYPTED POSITIONS</span>
                <span className="ps-ticker-sep">·</span>
                <span>PRIVATE LIQUIDATIONS</span>
                <span className="ps-ticker-sep">·</span>
                <span>SOLANA DEVNET</span>
                <span className="ps-ticker-sep">·</span>
              </div>
            </div>
          </div>
          {/* END POS-STRIP */}

          {/* ORDER BOOK */}
          <aside className="book desktop-only">
            <div className="book-hd">
              <span className="bh-title">ORDER BOOK</span>
              <span className="bh-sub">PRIVATE DEPTH</span>
            </div>
            <div className="book-cols"><span>PRICE</span><span>SIZE</span><span>TOTAL</span></div>
            <div className="book-asks">
              {book.asks.map((r, i) => (
                <div key={i} className="br">
                  {/* eslint-disable-next-line */}
                  <div className="br-bar br-bar-ask" style={{ width: `${r.pct}%` }} />
                  <span className="bp dn">{r.price}</span>
                  <span className="bs">{r.size}</span>
                  <span className="bt">{r.total}</span>
                </div>
              ))}
            </div>
            <div className="book-mid">
              <span className="bm-p">${tick.price.toLocaleString()}</span>
              <span className={`bm-c ${tick.up ? 'up' : 'dn'}`}>{tick.change}</span>
            </div>
            <div className="book-bids">
              {book.bids.map((r, i) => (
                <div key={i} className="br">
                  {/* eslint-disable-next-line */}
                  <div className="br-bar br-bar-bid" style={{ width: `${r.pct}%` }} />
                  <span className="bp up">{r.price}</span>
                  <span className="bs">{r.size}</span>
                  <span className="bt">{r.total}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

      {activeTab === 'PORTFOLIO' && (
        <div className="tab-page">
          <div className="tp-header">
            <h2 className="tp-title">Portfolio</h2>
            <span className="tp-badge">Arcium MXE Encrypted</span>
          </div>
          <div className="portfolio-stats">
            <div className="pf-card">
              <span className="pf-l">WALLET BALANCE</span>
              <span className="pf-v">{balance !== null ? `${balance.toFixed(4)} SOL` : '--'}</span>
              <span className="pf-sub">{balance !== null ? `$${(balance * tick.price).toFixed(2)}` : '--'}</span>
            </div>
            <div className="pf-card">
              <span className="pf-l">UNREALIZED PNL</span>
              <span className="pf-v up">$0.00</span>
              <span className="pf-sub">+0.00%</span>
            </div>
            <div className="pf-card">
              <span className="pf-l">OPEN POSITIONS</span>
              <span className="pf-v">{positions.length}</span>
              <span className="pf-sub">Encrypted by Arcium</span>
            </div>
            <div className="pf-card">
              <span className="pf-l">TOTAL TRADES</span>
              <span className="pf-v">{history.length}</span>
              <span className="pf-sub">Lifetime</span>
            </div>
          </div>
          <div className="tp-section">
            <h3 className="tp-sec-title">Open Positions <span className="tp-enc">Encrypted until revealed</span></h3>
            {positions.length === 0
              ? <div className="tp-empty">No open positions. Go to Trade to open a position.</div>
              : <div className="tp-table">
                  <div className="tt-head">
                    <span>Market</span><span>Direction</span><span>Size</span><span>Entry</span><span>Leverage</span><span>Privacy</span><span>Action</span>
                  </div>
                  {positions.map((p) => (
                    <div key={p.id} className="tt-row">
                      <span className="accent">{p.market}</span>
                      <span className={p.direction === 'LONG' ? 'up' : 'dn'}>{p.direction}</span>
                      <span>{p.revealed ? `${p.sizeNative.toFixed(4)} ${TOKEN_SYMBOL[p.market]}` : '****'}</span>
                      <span>${p.entryPrice.toLocaleString()}</span>
                      <span>{p.leverage}x</span>
                      <span className="purple">{p.revealed ? 'REVEALED' : 'ENCRYPTED'}</span>
                      <button className="reveal-btn" onClick={() => setPositions(prev => prev.map(x => x.id === p.id ? {...x, revealed: !x.revealed} : x))}>
                        {p.revealed ? 'HIDE' : 'REVEAL'}
                      </button>
                    </div>
                  ))}
                </div>
            }
          </div>
          <div className="arcium-explainer">
            <h3 className="ae-title">How Arcium Privacy Works</h3>
            <p>Your positions are encrypted using Arcium Multi-party Execution (MXE) nodes. No one — not even Sigillion — can see your position size or direction until you choose to reveal it. Liquidation checks are performed privately, and only the final PnL settlement is recorded on-chain.</p>
          </div>
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <div className="tab-page">
          <div className="tp-header">
            <h2 className="tp-title">Trade History</h2>
            <span className="tp-badge">Solana Devnet</span>
          </div>
          {history.length === 0
            ? <div className="tp-empty">No trade history yet. Your completed trades will appear here.</div>
            : <div className="tp-table">
                <div className="tt-head">
                  <span>Time</span><span>Market</span><span>Direction</span><span>Size</span><span>USD Value</span><span>Entry</span><span>Leverage</span><span>Status</span>
                </div>
                {history.map((h) => (
                  <div key={h.id} className="tt-row">
                    <span className="muted">{h.timestamp}</span>
                    <span className="accent">{h.market}</span>
                    <span className={h.direction === 'LONG' ? 'up' : 'dn'}>{h.direction}</span>
                    <span>{h.sizeNative.toFixed(4)} {TOKEN_SYMBOL[h.market]}</span>
                    <span>${h.sizeUsd.toFixed(2)}</span>
                    <span>${h.entryPrice.toLocaleString()}</span>
                    <span>{h.leverage}x</span>
                    <span className="up">{h.status}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {activeTab === 'MARKETS' && (
        <div className="tab-page">
          <div className="tp-header">
            <h2 className="tp-title">Markets</h2>
            <span className="tp-badge">Live Prices · Devnet</span>
          </div>
          <div className="markets-table">
            <div className="mt-head">
              <span>MARKET</span><span>PRICE</span><span>24H CHANGE</span>
              <span>24H HIGH</span><span>24H LOW</span><span>VOLUME</span>
              <span>OPEN INT</span><span>ACTION</span>
            </div>
            {Object.entries(TICKER).map(([sym, d]) => (
              <div key={sym} className="mt-row">
                <div className="mt-sym">
                  <span className="mt-name">{sym}</span>
                  <span className="mt-base">{TOKEN_SYMBOL[sym]}/USD</span>
                </div>
                <span className="mt-price">${d.price.toLocaleString()}</span>
                <span className={`mt-chg ${d.up ? 'up' : 'dn'}`}>{d.change}</span>
                <span className="mt-val">${d.high}</span>
                <span className="mt-val">${d.low}</span>
                <span className="mt-val">{d.vol}</span>
                <span className="mt-val">{d.oi}</span>
                <button className="mt-trade" onClick={() => { setMarket(sym); setActiveTab('TRADE'); }}>TRADE</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer className="footer">
        <span className="fi">NET EQUITY <b>{balance !== null ? `${balance.toFixed(3)} SOL` : '--'}</b></span>
        <span className="fd desktop-only">|</span>
        <span className="fi desktop-only">MARGIN <b className="purple">SEALED</b></span>
        <span className="fd desktop-only">|</span>
        <span className="fi desktop-only">POSITIONS <b>{positions.length}</b></span>
        <span className="fd desktop-only">|</span>
        <span className="fi desktop-only">NETWORK <b className="accent">Devnet</b></span>
        <span className="fd desktop-only">|</span>
        <span className="fi desktop-only">PRIVACY <b className="purple">Arcium MXE</b></span>
        <span className="fd desktop-only">|</span>
        <span className="fi desktop-only">CLUSTER <b>Mainnet-Beta</b></span>
        <div className="fr">
          <span className="desktop-only">MPC</span>
          <div className="mpc-t"><div className="mpc-f" /></div>
        </div>
      </footer>
    </div>
  );
}