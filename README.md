# Sigillion Perps

**Sigillion Perps** is a decentralized perpetual futures trading platform designed for privacy-preserving derivatives trading on Solana.

The platform enables users to open leveraged long and short positions while maintaining encrypted order flow and secure on-chain settlement.

---

## Overview

Sigillion Perps provides a modern decentralized trading interface that combines:

* **Perpetual Futures Trading**
* **Encrypted Order Execution**
* **On-chain Settlement**
* **Low-latency Trading UI**

The project is designed to demonstrate a privacy-focused derivatives exchange architecture using modern Web3 tooling.

---

## Key Features

* **Perpetual Futures Trading**

  * Long and short positions
  * Adjustable leverage
  * Market, limit, and stop orders

* **Trading Dashboard**

  * Real-time price chart
  * Order book visualization
  * Position tracking

* **Risk Controls**

  * Take Profit / Stop Loss
  * Liquidation monitoring
  * Margin management

* **Portfolio Tracking**

  * Open positions
  * Order history
  * Trade history

---

## Technology Stack

### Frontend

* React
* TypeScript
* Vite
* CSS

### Blockchain

* Solana
* Anchor Framework

### Infrastructure

* Vercel (deployment)
* GitHub (version control)

---

## Project Structure

```
sigillion-perps
│
├── frontend
│   ├── src
│   ├── components
│   ├── App.tsx
│   └── App.css
│
├── programs
│   └── sigillion-program
│
└── README.md
```

---

## Installation

Clone the repository:

```
git clone https://github.com/YOUR_USERNAME/sigillion-perps.git
```

Navigate to the frontend:

```
cd sigillion-perps/frontend
```

Install dependencies:

```
npm install
```

Start the development server:

```
npm run dev
```

---

## Deployment

The frontend can be deployed using **Vercel**.

```
vercel --prod
```

---

## Roadmap

* Private order matching
* Advanced liquidation engine
* Multi-collateral support
* Cross-margin accounts
* Improved mobile trading UI

---

## Disclaimer

This project is for educational and experimental purposes.
It is **not financial advice** and should not be used for production trading without proper audits.

---

## License

MIT License
