# Graph Report - trading-ai-platform  (2026-07-14)

## Corpus Check
- 57 files · ~39,731 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 600 nodes · 1106 edges · 58 communities (25 shown, 33 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ec97af80`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Bias Scoring Engine
- Bias Scoring Engine 1
- Bias Scoring Engine 2
- Bias Scoring Engine 3
- Market Data and Watchlist
- Bias Scoring Engine 5
- Audit, DB, and Evaluation
- Frontend Dashboard UI
- News and Calendar Context
- Audit, DB, and Evaluation 9
- Bias Scoring Engine 10
- Community 11
- News and Calendar Context 12
- Market Data and Watchlist 13
- Bias Scoring Engine 14
- Bias Scoring Engine 15
- News and Calendar Context 16
- Community 17
- News and Calendar Context 18
- Community 19
- Community 20
- Backend API Surface
- News and Calendar Context 22
- Community 23
- Frontend Dashboard UI 24
- Frontend Dashboard UI 25
- Community 26
- Q: Audit the logic and see why it is failing, why is it giving off false positives, why is it neutral on all tickers. and generate a answer on how to fix it
- Q: how is the expected move being calculated here ?
- README.md
- buildGroupedAssets
- file.svg icon
- globe.svg icon
- next.svg Next.js logo
- vercel.svg Vercel logo
- window.svg browser window icon
- app/page.tsx
- create-next-app
- Development server
- Geist font
- Learn Next.js
- next/font
- Next.js Deployment Documentation
- Next.js Documentation
- Next.js GitHub Repository
- Next.js Project
- Vercel Platform
- /api/dashboard
- /api/evaluations
- /api/system
- Backend localhost:5000
- Backend server.js
- Fresh clone data directory rationale
- Frontend localhost:3000
- Futures and Macro Markets
- Market Dashboard
- NEXT_PUBLIC_API_BASE_URL
- SQLite runtime data

## God Nodes (most connected - your core abstractions)
1. `buildBiasEngine()` - 28 edges
2. `buildConfluenceForAsset()` - 17 edges
3. `compilerOptions` - 16 edges
4. `analyzeGex()` - 15 edges
5. `containsKeyword()` - 15 edges
6. `analyzeCvd()` - 12 edges
7. `Home()` - 11 edges
8. `WhyBiasSection()` - 11 edges
9. `PostMortemPanel()` - 11 edges
10. `formatScore()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `normalizeOptionResult()` --indirect_call--> `contract()`  [INFERRED]
  backend/services/marketStructureDataService.js → backend/test/gexService.test.js
- `buildBiasSnapshot()` --calls--> `buildBiasEngine()`  [EXTRACTED]
  backend/server.js → backend/services/biasService.js
- `buildBiasSnapshot()` --calls--> `buildNewsImpactFeed()`  [EXTRACTED]
  backend/server.js → backend/services/impactService.js
- `buildBiasSnapshot()` --calls--> `buildSessionContext()`  [EXTRACTED]
  backend/server.js → backend/services/sessionService.js
- `fetchBiasInputs()` --calls--> `fetchAtrSnapshotsForAssets()`  [EXTRACTED]
  backend/server.js → backend/services/atrService.js

## Import Cycles
- None detected.

## Communities (58 total, 33 thin omitted)

### Community 0 - "Bias Scoring Engine"
Cohesion: 0.03
Nodes (48): AdvancedConfluence, AppView, AssetCard, assetOrder, BiasBreakdown, BiasShift, BiasShiftsResponse, Briefing (+40 more)

### Community 1 - "Bias Scoring Engine 1"
Cohesion: 0.06
Nodes (62): coreFlowAssets, flowAssets, buildAnalysisPayload(), buildDriverSentence(), buildEventSentence(), buildRiskSentence(), buildSentimentSentence(), cleanupFallbackLabel() (+54 more)

### Community 2 - "Bias Scoring Engine 2"
Cohesion: 0.08
Nodes (35): assetRelevanceRules, assetRules, calendarImpactWeights, dashboardAssets, impactCategoryRules, negativeSentimentPatterns, newsFeeds, newsSources (+27 more)

### Community 3 - "Bias Scoring Engine 3"
Cohesion: 0.08
Nodes (27): router, app, buildBiasSnapshot(), buildNewsFreshnessStatus(), expectedMoveSymbols, fetchBiasInputs(), marketStructureTargets, startedAt (+19 more)

### Community 4 - "Market Data and Watchlist"
Cohesion: 0.12
Nodes (32): localSymbolUniverse, getCalendarSourceStatus(), getSystemStats(), getWatchlistItems(), getWatchlistStats(), buildStatus(), fetchFinnhubJson(), fetchFinnhubQuote() (+24 more)

### Community 5 - "Bias Scoring Engine 5"
Cohesion: 0.11
Nodes (36): symbols, coreWatchlistItems, supportedAssetClasses, supportedProviders, addColumnIfMissing(), addWatchlistItem(), allSql(), BIAS_HISTORY_COLUMNS (+28 more)

### Community 6 - "Audit, DB, and Evaluation"
Cohesion: 0.50
Nodes (3): Backend, Frontend, trading-ai-platform

### Community 7 - "Frontend Dashboard UI"
Cohesion: 0.08
Nodes (23): dependencies, lucide-react, next, react, react-dom, rss-parser, devDependencies, eslint (+15 more)

### Community 8 - "News and Calendar Context"
Cohesion: 0.18
Nodes (20): forexFactoryCalendarSource, manualCalendarEvents, manualCalendarSource, buildCalendarBundle(), buildCalendarStatus(), buildForexFactoryDatetime(), cacheCalendarBundle(), decodeXmlValue() (+12 more)

### Community 9 - "Audit, DB, and Evaluation 9"
Cohesion: 0.09
Nodes (21): author, dependencies, cors, dotenv, express, node-fetch, rss-parser, sqlite3 (+13 more)

### Community 10 - "Bias Scoring Engine 10"
Cohesion: 0.22
Nodes (19): BiasLoggingCard(), EvaluationsView(), explainScore(), FlowPressureRow(), formatDateTime(), formatExpectedMove(), formatPercentMetric(), formatQuoteValue() (+11 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 12 - "News and Calendar Context 12"
Cohesion: 0.24
Nodes (14): aggregateByStrike(), analyzeGex(), calculateBlackScholesGamma(), clamp(), enrichContract(), findGammaFlip(), findNearestLevel(), isPositiveNumber() (+6 more)

### Community 13 - "Market Data and Watchlist 13"
Cohesion: 0.24
Nodes (12): analyzeCvd(), clamp(), detectDivergence(), hasUsableOhlcv(), isFiniteNumber(), linearSlope(), maxBy(), minBy() (+4 more)

### Community 14 - "Bias Scoring Engine 14"
Cohesion: 0.17
Nodes (22): buildAvoidReasons(), buildComponents(), buildConfluenceForAsset(), buildConfluenceSummary(), buildContradictions(), buildEventRiskAdjustment(), buildWatchReasons(), clamp() (+14 more)

### Community 15 - "Bias Scoring Engine 15"
Cohesion: 0.19
Nodes (14): AdvancedConfluencePanel(), BiasBreakdownCard(), BiasPill(), CalendarEvent, displayBias(), formatExpectedMoveValue(), formatScore(), formatScoreOrDash() (+6 more)

### Community 16 - "News and Calendar Context 16"
Cohesion: 0.28
Nodes (9): buildSessionInfo(), CalendarEventRow(), explainCalendarEvent(), formatDuration(), formatImpactLabel(), formatTimeUntil(), getSessionInfos(), ImpactDot() (+1 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (29): atrCache, buildAtrSnapshot(), buildStartDate(), buildUnavailableSnapshot(), calculateAtr(), expectedMoveFromAtr(), fetchATR(), fetchATRForAssets() (+21 more)

### Community 18 - "News and Calendar Context 18"
Cohesion: 0.40
Nodes (6): buildEventKey(), CalendarEmptyState(), DataSourceHealthCard(), formatHealthTime(), isDataDegraded(), UpcomingNewsView()

### Community 20 - "Community 20"
Cohesion: 0.67
Nodes (3): buildLinePath(), formatCompactNumber(), MiniChartCard()

### Community 22 - "News and Calendar Context 22"
Cohesion: 0.22
Nodes (14): candleCache, fetchIntradayCandles(), fetchValidatedOptionsChain(), isFiniteNumber(), isStaleCandle(), isUsableOptionContract(), normalizeCandle(), normalizeOptionContract() (+6 more)

### Community 27 - "Q: Audit the logic and see why it is failing, why is it giving off false positives, why is it neutral on all tickers. and generate a answer on how to fix it"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Audit the logic and see why it is failing, why is it giving off false positives, why is it neutral on all tickers. and generate a answer on how to fix it, Source Nodes

### Community 28 - "Q: how is the expected move being calculated here ?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: how is the expected move being calculated here ?, Source Nodes

### Community 29 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 30 - "buildGroupedAssets"
Cohesion: 0.67
Nodes (3): buildGroupedAssets(), normalizeAssetKey(), WatchlistSearchBar()

## Knowledge Gaps
- **171 isolated node(s):** `newsFeeds`, `calendarImpactWeights`, `name`, `version`, `description` (+166 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildBiasEngine()` connect `Bias Scoring Engine 1` to `Bias Scoring Engine 2`, `Bias Scoring Engine 3`, `News and Calendar Context 12`, `Market Data and Watchlist 13`, `Bias Scoring Engine 14`, `Community 17`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `analyzeGex()` connect `News and Calendar Context 12` to `Bias Scoring Engine 1`, `Market Data and Watchlist`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `analyzeCvd()` connect `Market Data and Watchlist 13` to `Bias Scoring Engine 1`, `Market Data and Watchlist`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `analyzeGex()` (e.g. with `toZone()` and `contract()`) actually correct?**
  _`analyzeGex()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `newsFeeds`, `calendarImpactWeights`, `name` to the rest of the system?**
  _172 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Bias Scoring Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.032242063492063495 - nodes in this community are weakly interconnected._
- **Should `Bias Scoring Engine 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06219918548685672 - nodes in this community are weakly interconnected._