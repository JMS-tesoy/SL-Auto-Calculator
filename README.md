# SL-Auto Calculator

A professional desktop position size calculator for OKX perpetual futures trading, built with **Tauri v2** (Rust backend + vanilla JS frontend).

## Features

- **3 Calculation Modes**
  - **Risk-Constrained** — Set your risk %, and the calculator determines SL distance and position size
  - **SL-Constrained** — Set your stop-loss distance, and it calculates risk % and position size
  - **Size-Constrained** — Set your position size, and it calculates SL distance and risk %

- **Multi Take-Profit Levels** — Configure up to 5 TP targets with custom percentages per level
- **OKX Liquidation Estimation** — Uses maintenance margin tiers for accurate liquidation price
- **Funding Rate Estimation** — Projected funding costs factored into P&L
- **Perpetual Contract Data** — Built-in data for major OKX swap contracts
- **Fee Calculator** — Separate maker/taker fee rates for open and close
- **Professional Dark UI** — Single-view grid layout, no scrolling, responsive design

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Framework | [Tauri v2](https://v2.tauri.app/) |
| Frontend | Vanilla HTML/CSS/JS |
| Backend | Rust (via Tauri) |
| Styling | Custom CSS design system (dark theme) |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (MSVC toolchain on Windows)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Project Structure

```
├── dist/                     # Frontend source files
│   ├── index.html            # Main HTML entry point
│   ├── css/
│   │   └── style.css         # Stylesheet
│   └── js/
│       ├── calculator.js     # Core calculation engine
│       ├── okx-data.js       # OKX contract data & maintenance margin tiers
│       ├── storage.js        # Local storage persistence
│       └── ui.js             # UI controller & event handling
├── src-tauri/                # Tauri / Rust backend
│   ├── src/
│   │   ├── main.rs           # Rust entry point
│   │   └── lib.rs            # Tauri app builder
│   ├── Cargo.toml            # Rust dependencies
│   └── tauri.conf.json       # Tauri configuration
├── package.json              # Node.js dependencies
└── README.md
```

## License

MIT