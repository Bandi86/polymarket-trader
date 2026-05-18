# Dashboard Fejlesztési Terv — 2026-05-18

> **Referencia pont:** Ez a dokumentum a Polymarket Trader kezdőlapjának (CommandCenter) teljes panel-audit eredménye és fejlesztési roadmapja. Készült: 2026. május 18.

---

## Áttekintés

A dashboard 13 panelből áll, mindegyik `CollapsiblePanel`-be csomagolva. Az elemzés célja: panel-onként meghatározni mi működik jól, mi hiányzik, és hogyan lehetne szebb / hasznosabb / részletesebb.

**Prioritási szintek:**
- 🔴 **Kritikus** — Hiányzó funkció vagy törött UX
- 🟠 **Magas** — Jelentős javítási lehetőség
- 🟡 **Közepes** — Szebb / részletesebb lehetne
- 🟢 **Alacsony** — Finomhangolás, polishing

---

## Panel-by-Panel Audit

---

### Panel 0 — Header / AccountInfoBar + Kill Switch

**Jelenlegi állapot:**
- Balance, Demo PnL, Win Rate egy sorban
- P&L distribution progress bar (zöld/piros split)
- Latency sparkline (20 pont, SVG körök)
- Kill Switch gomb (animált piros ha aktív)
- "Beállítások" link jobbra

**Ami jól működik:** ✅ Kompakt, informatív, szép colored balance display.

**Problémák / hiányok:**
- A latency sparkline nagyon kicsi (40×12px), alig látható
- Win Rate csak szám, nincs vizuális súlya
- Az "összes trade" és "avg PnL" csak a progress bar mellett jelenik meg minimálisan
- Demo vs Live váltás nincs a headerben (csak badge jelzi a módot)
- A Kill Switch funkcionálisan OK, de az UI-ban elsüllyedt

**Fejlesztési javaslatok:**
- 🟠 **Nagyobb latency sparkline** — legalább 80×20px SVG vonaldiagram
- 🟡 **Win Rate ring vizualizáció** — kis körkörös progress a szám mellett
- 🟡 **Mode switcher gomb** a fejlécbe integrálva (Demo ↔ Live toggle)
- 🟢 **Hover tooltip** az összes számra részletes breakdown-nal
- 🟠 **Profit Factor badge** — ha agg adatok elérhetők, mutassa itt is

---

### Panel 1 — Market Data (MarketBar)

**Jelenlegi állapot:**
- Timer (visszaszámláló), Probability Arc SVG, YES/NO odds %
- Target price (start price), Current BTC price, Delta
- Volume, SSE Latency
- Time-to-resolution progress bar
- Market prediction badge (BTC WILL EXCEED / STAY BELOW)

**Ami jól működik:** ✅ Vizuálisan tömör, sok info kis helyen. A progress bar + animált timer klassz.

**Problémák / hiányok:**
- A Probability Arc SVG (44×24px) túl kicsi és nehezen olvasható
- A "probGap" szám (pl. "24%") kontextus nélkül érthetetlen az új felhasználónak
- Nincs BTC ármozgás historikus mini-chart (utolsó 5 piac)
- Nincs "market ID" vagy timestamp megjelenítve
- A volume csak K-ban, nincs formázás ha <1K
- SSE Latency UI szinte láthatatlan

**Fejlesztési javaslatok:**
- 🔴 **Larger probability gauge** — 80×45px félkörös gauge helyett, prominensebb
- 🟠 **BTC sparkline a market data panelben** — utolsó 10-15 SSE tick mini vonaldiagram
- 🟠 **Market ID tooltip** — kattintásra másolható piaci azonosító
- 🟡 **Odds mozgás indikátor** — nyíl, ha a YES odds az utolsó 5s-ban nőtt/csökkent
- 🟡 **"Confidence signal" vizualizáció** — a prob gap + irány kombinálva egy "signal strength" bárban
- 🟢 **Animált szám frissítés** — counter-up/down animáció amikor az ár változik

---

### Panel 2 — Trading & Chart (QuickTradePanel + ChartPanel)

**Jelenlegi állapot:**
- QuickTradePanel: YES/NO odds display, preset amounts ($5-$100), BET UP / BET DOWN gombok
- Open Positions + Recent Filled Orders lista
- ChartPanel: wrapper, de lényegében üres

**Ami jól működik:** ✅ A BET UP/DOWN gombok vizuálisan jók, a preset amount gomb sor ügyes.

**Problémák / hiányok:**
- A YES/NO odds (nagy szám "52.3¢") és a BET gomb közt nincs vizuális kapcsolat
- Nincs "expected return" kalkulátor — ha $10-t teszek, mennyit nyerhetek?
- Nincs max bet megjelenítve (wallet limithez viszonyítva)
- A ChartPanel valójában üres/placeholder
- Open Positions section csak ha van nyitott pozíció — különben eltűnik (layout jump)

**Fejlesztési javaslatok:**
- 🔴 **Expected return kalkulátor** — dinamikusan számolja `amount / price` = várható nyeremény
- 🔴 **Valódi BTC chart** — TradingView widget vagy Recharts OHLCV az SSE tickekből
- 🟠 **Potential P&L display** — "Ha nyersz: +$X.XX | Ha veszítesz: -$Y.YY"
- 🟠 **Wallet limit indikátor** — progress bar: mennyi a betét a wallethez képest
- 🟠 **Időzítő integráció** — a BET gombokat disable-álja ha <10s van hátra (túl késő)
- 🟡 **Order confirmation** — kis megerősítési step nagy összegnél (pl. >$50)
- 🟡 **Kedvenc összegek** — user-defined preset amounts menthetők

---

### Panel 3 — Bot Fleet & Positions (BotSelector + ActivityTabs)

**Jelenlegi állapot:**
- BotSelector: futó/tétlen szekciókra osztva, checkboxos batch selection
- Bulk Start/Stop, batch Start/Stop/Reset/BetSize
- ActivityTabs: Positions tab + Terminal tab

**Ami jól működik:** ✅ A batch műveletek nagyon hasznosak. A Running/Idle szétválasztás jó.

**Problémák / hiányok:**
- 15 bot esetén a lista nagyon hosszú, nincs keresés/szűrés
- A bot kártyák minimálisak (BotRow) — nincs PnL preview a listában
- Az ActivityTabs "Terminal" fül csak az utolsó 15 log sort mutatja
- Nincs bot sorting (PnL szerint, Win Rate szerint)
- Nincs "Legjobb bot" / "Legrosszabb bot" highlight

**Fejlesztési javaslatok:**
- 🟠 **Search + filter** a bot listán (strategy típus, státusz szerint)
- 🟠 **PnL preview** minden bot sorban — pl. `+$2.34 | 67% WR` kis badge-ek
- 🟠 **Bot list sorting** — rendezés PnL, Win Rate, Trades szerint
- 🟠 **Terminal max sorok növelése** — 50+ sor, kereshetővé téve
- 🟡 **Bot color coding** — zöld border ha profitábilis, piros ha veszteséges
- 🟡 **"Top performers" section** — top 3 bot automatikusan kiemelve
- 🟢 **Mini sparkline** minden bot sorban (utolsó 5 trade eredménye)

---

### Panel 4 — Active Bets (PendingBetMonitor)

**Jelenlegi állapot:**
- Aktív fogadások listája SSE `position_update` eventekből
- Bot neve, Side (YES/NO), Size, Price, unrealizedPnL
- Animated progress bar (time remaining)
- BTC delta megjelenítve

**Ami jól működik:** ✅ A pulsing dot animáció szép. A progressbar szín-változás (zöld→sárga→piros) hasznos.

**Problémák / hiányok:**
- Az unrealizedPnL számítás nem tükrözi pontosan a valós Polymarket payout-ot
- Ha sok fogadás van, a lista scrollozható de nem priorizált
- Nincs aggregált összefoglaló (összesen tét, összesen várható nyeremény)
- Nincs szűrő YES/NO side szerint

**Fejlesztési javaslatok:**
- 🔴 **Helyes P&L kalkuláció** — pontosabb unrealized P&L számítás
- 🟠 **Aggregált summary row** — "Összesen: $X téten, ~$Y várható nyeremény"
- 🟠 **YES/NO arány vizualizáció** — pie/donut hogy milyen irányban fogadnak a botok
- 🟡 **Prioritás szerinti rendezés** — legtöbb $-os tétek felül
- 🟡 **Win probability indikátor** — a jelenlegi YES odds alapján mennyire valószínű a győzelem
- 🟢 **Countdown animáció** per-bet

---

### Panel 5 — Market History

**Jelenlegi állapot:**
- Utolsó 5 befejezett piac (EXCEEDED / BELOW)
- Filter: Mind/NYERT/VESZTETT + 1h/24h/7d időszűrő
- Win Rate % a header-ben
- Stats: Win Rate, Avg Δ, Max Δ, Period

**Ami jól működik:** ✅ A kettős szűrő (outcome + időszak) hasznos. A stats summary bar ügyes.

**Problémák / hiányok:**
- Maximum 5 piac jelenik meg — ez nagyon kevés
- Nincs BTC price chart overlay a historikus piacokra
- A "Move" kategória (Big/Medium/Small) önkényes
- Nincs trend vizualizáció (az utolsó N piac sorozata: W/L/W/W/L...)
- A Win Rate csak az utolsó 5 eredményre számít — félrevezető lehet

**Fejlesztési javaslatok:**
- 🟠 **Több sor megjelenítése** — alapértelmezetten 10, expandálható 25-re
- 🟠 **Streak vizualizáció** — WWLWWLL sorozat ikonokkal (mint egy mini heatmap)
- 🟠 **BTC volatility indikátor** per piac — mekkora volt az ármozgás
- 🟡 **Chart overlay** — mini sparkline a piac induló és záró árához
- 🟡 **Pagination** a history listához
- 🟢 **CSV export gomb** a teljes history-hoz

---

### Panel 6 — Cumulative P&L (Equity Curve)

**Jelenlegi állapot:**
- Recharts ComposedChart: Area (PnL) + Line (Balance) + Drawdown
- 5 perf stat: Total PnL, Max DD, Sharpe, Profit Factor, Win Rate
- Idő szűrők: 1H / 24H / 7D / ALL
- Külön Drawdown Area chart alatta

**Ami jól működik:** ✅ Ez az egyik legerősebb panel! A Sharpe + Profit Factor kiemelkedő feature. A duális chart (equity + drawdown) profi megjelenés.

**Problémák / hiányok:**
- A chart magassága 192px — kicsi, különösen ha sok adat van
- Nincs benchmark vonal (pl. "ha $100-at befektettél volna BTC-be")
- A Drawdown chart-ban a jelmagyarázat hiányzik
- Nincs "best trade" / "worst trade" highlight a charton
- Nincs logaritmikus skála opció

**Fejlesztési javaslatok:**
- 🟠 **Expandálható chart magasság** — gombra nyitható full-screen nézet
- 🟠 **Benchmark vonal** — "HODLed $100 BTC" összehasonlítás
- 🟡 **Chart annotációk** — legjobb/legrosszabb trade megjelölése a charton
- 🟡 **Zoom & pan** — interaktív nagyítás a charton
- 🟡 **Calmar Ratio** hozzáadása a perf stats-hoz
- 🟢 **Logaritmikus skála toggle**

---

### Panel 7 — Strategy Performance

**Jelenlegi állapot:**
- Per-strategy kártyák (rendezve total PnL szerint)
- Summary: Stratégiák száma, Legjobb, Összes trade
- Kártyánként: ikon, név, kategória, botCount, PnL, trades, WR, win rate bar

**Ami jól működik:** ✅ A kártyás megjelenítés jól olvasható. A win rate bar per-card szép.

**Problémák / hiányok:**
- **DUPLIKÁLT** a Strategy Comparison Table-lal! Mindkét panel ugyanazt mutatja, csak más formátumban.
- Nincs chart vizualizáció a stratégiai teljesítményhez
- A kategória (Momentum, Mean Reversion stb.) nincs szín-kódolva
- Nincs "strategy trend" — javul vagy romlik az utóbbi időben?

**Fejlesztési javaslatok:**
- 🔴 **Összevonás / duplikáció megszüntetése** — a Strategy Performance és Strategy Comparison Table-t ÖSSZE KELL VONNI egy panelba. Két nézet: Card View + Table View tab-ok
- 🟠 **Kategória szín-kódolás** — minden strategy category-nek saját szín
- 🟠 **Strategy trend arrow** — az utolsó 7 naphoz képest javult/romlott-e?
- 🟡 **Bar chart vizualizáció** — vízszintes bar chart a stratégiák PnL-jéből
- 🟡 **"No trades" botok szétválasztása** — külön szekció a még nem kereskedett botoknak

---

### Panel 8 — Strategy Comparison Table

> ⚠️ **Javasolt összevonás a Strategy Performance panellel** (lásd fentebb)

**Jelenlegi állapot:**
- Sortolható táblázat: Strategy, Category, Bots, Total PnL, Trades, Wins, Losses, Win Rate, Avg/Trade, ROI%
- Kattintásra sor kijelölhető
- Win Rate mini bar chart cellán belül

**Ami jól működik:** ✅ A sortolható táblázat profi feature. A ROI% oszlop hasznos.

**Problémák / hiányok:**
- Nem collapsible (mindig `isOpen={true}`)
- Nincs filter input a stratégiák nevére
- A kijelölt sor semmi mást nem csinál (csak highlighted)
- A táblázat mobilon scrollozási problémák

**Fejlesztési javaslatok:**
- 🔴 **Összevonás a Strategy Performance panellel**
- 🟠 **Row expand** — kijelölt stratégiánál expandálódó részletező: equity curve, trade lista
- 🟠 **Column visibility toggle** — user kiválaszthatja melyik oszlopok látszanak
- 🟡 **CSV export** a táblázathoz
- 🟢 **Sticky header** scrolloláskor

---

### Panel 9 — Trade Feed

**Jelenlegi állapot:**
- Live trade stream SSE-ből
- Stats bar: Trades, Wins, Losses, Win Rate
- Filter: ALL/UP/DOWN/WIN/LOSS
- Pause/Resume + Auto-scroll gombok
- Per-entry: DEMO/LIVE badge, idő, bot név, streak (Flame ikon), direction, size, confidence, PnL

**Ami jól működik:** ✅ Nagyon részletes és informatív. A Flame streak indikátor szuper. A pause gomb hasznos.

**Problémák / hiányok:**
- 100 entry max — de nincs "load more" vagy végtelen scroll
- A filter "UP/DOWN" vs "WIN/LOSS" nem kombinálható
- Nincs per-bot szűrő
- A timestamp HH:MM:SS jó, de nincs dátum ha régebbi trade
- Nincs hang/vizuális notifikáció WIN esetén

**Fejlesztési javaslatok:**
- 🟠 **Per-bot szűrő dropdown** — melyik bot(ok) trade-jeit mutassa
- 🟠 **Sound notification toggle** — WIN esetén opcionális hangjelzés
- 🟠 **Entry grouping** — egy bot egymást követő trade-jei csoportosítva
- 🟡 **Reason mező** megjelenítése expandálható formában per entry-nél
- 🟡 **Kombinált szűrés** (pl. UP+WIN egyszerre)
- 🟢 **Export** az aktuális feed szűrt listájának

---

### Panel 10 — Bot Thoughts

**Jelenlegi állapot:**
- AI döntési log — `trade_decision` eventek reason mezőjéből
- Stats: Total, Buy, Sell, Avg Confidence
- Filter: ALL/BUY/SELL
- Per-entry: bot ikon, bot név, idő, thought szöveg, reason (dőlt), confidence badge, action badge

**Ami jól működik:** ✅ Egyedi feature! A confidence badge szín-kódolása (zöld/sárga/szürke) informatív.

**Problémák / hiányok:**
- A "thought" szöveg sablonos: "Decided to BUY with 72% confidence" — nem igazán az AI "gondolata"
- A reason mező sokszor üres
- Nincs per-bot szűrés
- Nincs "strategy type" megjelenítve — melyik stratégia gondolkodik így?
- Max 50 entry, nincs lapozás

**Fejlesztési javaslatok:**
- 🟠 **Strategy type megjelenítése** minden entry-nél
- 🟠 **Richer "thought" text** — a backend strategy logikából részletesebb magyarázat
- 🟠 **Per-bot szűrő** dropdown
- 🟡 **Confidence heatmap** — az utolsó N döntés confidence-értékeit vizualizálva
- 🟡 **"Konszenzus" indikátor** — ha az összes bot egyszerre BUY-t dönt, highlight
- 🟢 **Copy to clipboard** per-entry

---

### Panel 11 — System Health

**Jelenlegi állapot:**
- 4 indicator: SSE, API, Bots, Backend (healthy/degraded/unknown)
- Stats: Uptime, Messages, Reconnects
- Latency bar sparkline (20 minta)
- Error count badge

**Ami jól működik:** ✅ Kompakt és informatív. A latency sparkline vizuálisan jó.

**Problémák / hiányok:**
- Backend és API indicator lényegében ugyanaz, felesleges duplikáció
- Nincs "backend version" vagy "last restart" idő
- A latency history csak az utolsó 20 minta — nincs hosszú távú átlag
- Nincs alert/warning ha a latency tartósan magas
- Az error count badge nem részletezi mi volt a hiba

**Fejlesztési javaslatok:**
- 🟠 **Backend verziószám** megjelenítése
- 🟠 **Latency history chart** — 5 perces ablakban, nem csak 20 pont
- 🟠 **Alert threshold beállítás** — ha latency >X ms értesítés
- 🟡 **Indicators összevonás** — Backend+API → egy "API" sor, jobb részletezéssel
- 🟡 **Memory/CPU indikátor** ha a backend expozál ilyen metrikát
- 🟢 **Log download gomb** — teljes SSE esemény log letöltése

---

### Panel 12 — Backtest

**Jelenlegi állapot:**
- "Coming Soon" badge
- Strategy dropdown, Date Range picker (placeholder)
- Metrics grid: Total Trades, Win Rate, Total PnL, Sharpe, Max Drawdown — mind "—"
- Equity curve placeholder szöveg

**Ami jól működik:** ✅ A UI keret jól van megtervezve, könnyen kitölthető funkcióval.

**Problémák / hiányok:**
- **TELJESEN ÜRES** — semmi tényleges funkció nincs implementálva
- A backend nem exponál `/backtest` endpointot
- Nincs date range picker widget
- A "Run Backtest" gomb disabled

**Fejlesztési javaslatok:**
- 🔴 **Backend backtest endpoint implementálása** — `/api/backtest?strategy=X&from=Y&to=Z`
- 🔴 **Date range picker** — shadcn Calendar widget integrálása
- 🔴 **Valódi eredmények** — a historikus trade adatok alapján stratégia szimulálása
- 🟠 **Multi-strategy összehasonlítás** — egyszerre több stratégia backtestje
- 🟠 **Paraméterezhető backtest** — bet_size, min_confidence threshold állítható
- 🟡 **Equity curve chart** a backtest eredményéhez

---

## Összefoglaló Prioritási Mátrix

| Panel | Állapot | Prioritás | Fő teendő |
|-------|---------|-----------|-----------|
| Header / AccountInfoBar | 🟡 Jó | Közepes | Latency sparkline nagyítás, mode switcher |
| Market Data | 🟢 Fejlesztve | Magas | Probability gauge nagyítás ✅, BTC sparkline ✅ |
| Trading & Chart | 🔴 Kritikus | Kritikus | Expected return kalkulátor, valódi BTC chart |
| Bot Fleet & Positions | 🟢 Fejlesztve | Magas | Keresés/szűrés ✅, PnL preview per bot ✅ |
| Active Bets | 🟢 Fejlesztve | Közepes | Aggregált summary ✅, YES/NO arány vizualizáció ✅ |
| Market History | 🟢 Fejlesztve | Közepes | Több sor ✅ (5→10), streak vizualizáció ✅ |
| Equity Curve | 🟢 Erős | Alacsony | Benchmark, chart annotációk |
| Strategy Performance | 🟢 ÖSSZEVONVA ✅ | Kritikus | **ÖSSZEVONVA Strategy Comparison-nel** |
| Strategy Comparison | 🟢 ÖSSZEVONVA ✅ | Kritikus | **ÖSSZEVONVA Strategy Performance-szel** |
| Trade Feed | 🟢 Fejlesztve | Alacsony | Per-bot szűrő ✅, kombinált filter |
| Bot Thoughts | 🟢 Fejlesztve | Közepes | Strategy type ✅, richer text, per-bot szűrő ✅ |
| System Health | 🟡 Jó | Közepes | Backend verzió (⏳ backend kell), latency history (✅ 20 minta + avg/min/max) |
| Backtest | 🔴 Üres | Kritikus | Teljes implementáció szükséges |

---

## Ajánlott Implementációs Sorrend

### Fázis 1 — Kritikus javítások (azonnali)
1. **Strategy Performance + Strategy Comparison összevonása** — ✅ Panel redundancia megszüntetve (StrategyPanel with card/table views)
2. **Expected Return kalkulátor** a Quick Trade panelben
3. **Valódi BTC price chart** a Trading & Chart panelben (TradingView widget vagy SSE-alapú Recharts)

### Fázis 2 — Magas prioritású fejlesztések
4. **Bot Fleet keresés + PnL preview** — ✅ Keresés + szűrés implementálva (bot-selector.tsx search bar)
5. **Market Data probability gauge** nagyítás és BTC mini sparkline — ✅ Probability Arc 44×24→80×45, BTC sparkline implementálva
6. **Active Bets aggregált summary** — ✅ Aggregált summary row (totalExposure, totalExpectedWinnings, YES/NO ratio)

### Fázis 3 — Közepes prioritású fejlesztések
7. **Bot Thoughts gazdagítása** — ✅ strategy type + per-bot szűrő implementálva
8. **Market History** — ✅ 5→10 sor, streak vizualizáció (W/L betűk)
9. **System Health** — ✅ Latency history (20 minta, avg/min/max), ⏳ Backend verzió (backend kell)
10. **Trade Feed per-bot szűrő** — ✅ Bot filter dropdown hozzáadva

### Fázis 4 — Backtest implementálás (külön sprint)
11. **Backend endpoint** `/api/backtest` — ⏳ Backend implementáció szükséges
12. **Date range picker** + **Recharts equity curve** a backtest eredményekhez — ⏳ Backend kell
