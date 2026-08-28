# Competitor Keyword Research — GCC Big Matches

Date: 2026-08-29

## Goal
Find keyword/copy patterns repeatedly used by established football-ticket advertisers and ticket comparison sites, while protecting the initial TrendPilot budget. This is research only; it does not enable or change the live campaign.

## Important limitation
Public Google tools do not reveal a competitor's Google Ads account age, exact keyword list, bid, conversion rate or profitability. Google Ads Transparency Center can expose active ads/advertiser history, but not the actual search keyword that triggered each ad. Therefore, "tested keyword" below means a strong proxy based on repeated exact-match landing-page titles, long-lived commercial page architecture, repeated advertiser presence, and buyer-intent wording — not proof of profitability.

## Competitors observed / researched
- Viagogo — observed in TrendPilot's Google Ad Preview for Manchester derby-related search.
- Football Ticket Net — observed in Ad Preview and has dedicated exact-match event pages.
- LiveFootballTickets — dedicated exact-match event pages for multiple TrendPilot fixtures.
- SeatPick — exact-match comparison pages for Liverpool v Manchester United and El Clasico.
- 1BoxOffice — Arabic team/ticket pages and Arabic fixture inventory.
- Goal / Kooora affiliate ticket content — useful for Arabic search wording, but informational intent must be filtered carefully.

## What established players repeatedly use
1. Exact fixture naming: `Team A vs Team B tickets`
2. Shortened fixture naming: `Team A Team B tickets`
3. Rivalry naming: `El Clasico tickets`, `Manchester Derby tickets`, `North London Derby tickets`, `Madrid Derby tickets`
4. Team-level ticket terms: `Manchester United tickets`, `Liverpool tickets`, etc. These have volume but are much broader and are NOT recommended for the first low-budget TrendPilot test.
5. Purchase verbs: `buy ... tickets`, Arabic `شراء تذاكر ...`
6. Stadium/event specificity in copy and landing pages: Anfield, Old Trafford, Camp Nou, Emirates, Tottenham Hotspur Stadium.
7. Comparison/value wording: compare tickets, compare prices, best deal, ticket options.
8. Trust/friction reducers: verified sellers, money-back guarantee, seated together, secure payments, fees/seat visibility.

## Highest-priority challenger keywords
These are candidates to test only as EXACT first, then PHRASE after a seller-click signal. Do not use BROAD at launch.

### Manchester United v Manchester City
EN:
- [manchester united vs manchester city tickets]
- [man united vs man city tickets]
- [manchester derby tickets]
- [buy manchester united vs manchester city tickets]
AR:
- [تذاكر مانشستر يونايتد ضد مانشستر سيتي]
- [شراء تذاكر مانشستر يونايتد مانشستر سيتي]
- [شراء تذاكر ديربي مانشستر]

### Liverpool v Manchester United
EN:
- [liverpool vs manchester united tickets]
- [liverpool vs man united tickets]
- [liverpool man united tickets]
- [buy liverpool vs manchester united tickets]
AR:
- [تذاكر ليفربول ضد مانشستر يونايتد]
- [شراء تذاكر ليفربول مانشستر يونايتد]

### El Clasico
EN:
- [el clasico tickets]
- [barcelona vs real madrid tickets]
- [barcelona real madrid tickets]
- [buy el clasico tickets]
AR:
- [تذاكر الكلاسيكو]
- [شراء تذاكر الكلاسيكو]
- [تذاكر برشلونة ضد ريال مدريد]
- [شراء تذاكر برشلونة ريال مدريد]

### Atletico Madrid v Real Madrid
EN:
- [atletico madrid vs real madrid tickets]
- [madrid derby tickets]
- [buy madrid derby tickets]
AR:
- [تذاكر أتلتيكو مدريد ريال مدريد]
- [شراء تذاكر ديربي مدريد]

### Tottenham v Arsenal
EN:
- [tottenham vs arsenal tickets]
- [tottenham arsenal tickets]
- [north london derby tickets]
- [buy tottenham vs arsenal tickets]
AR:
- [تذاكر توتنهام ضد أرسنال]
- [شراء تذاكر توتنهام أرسنال]
- [شراء تذاكر ديربي شمال لندن]

### Arsenal v Manchester City
EN:
- [arsenal vs manchester city tickets]
- [arsenal vs man city tickets]
- [arsenal man city tickets]
- [buy arsenal vs manchester city tickets]
AR:
- [تذاكر أرسنال ضد مانشستر سيتي]
- [شراء تذاكر أرسنال مانشستر سيتي]

## Keywords deliberately NOT recommended for the first $20 test
- `manchester united tickets`
- `man city tickets`
- `liverpool tickets`
- `arsenal tickets`
- `real madrid tickets`
- `barcelona tickets`
- Arabic equivalents of generic team tickets

Reason: these can attract users wanting a different fixture, memberships, season tickets or general club inventory. They may be useful later in a separate exploratory campaign with its own budget cap, but should not consume the initial six-match test.

## Arabic insight
Arabic commercial SERPs often use natural language such as `كيفية الحصول على تذاكر...` and `كيفية شراء تذاكر...`. These phrases indicate demand but can have informational intent. TrendPilot should test the shorter purchase-intent form `شراء تذاكر + fixture` before testing `كيفية شراء`.

## Money-protection test design
- Core keywords: keep existing exact/phrase fixture terms.
- Challenger layer: add only the new `شراء / buy / shortened fixture` terms as EXACT first.
- Give challenger terms no higher CPC than the current ad-group max CPC.
- Never introduce broad match during the initial test.
- After data arrives, judge by seller_outbound_click cost, not CTR alone.
- Pause any keyword after 20 clicks with no seller signal.
- If a challenger produces a seller click at a lower cost than the original keyword, promote it to PHRASE in the next round.
- Keep generic team-ticket keywords isolated in a future campaign, not mixed into the current fixture test.

## Current conclusion
The strongest competitor-derived pattern is not a secret generic keyword; it is exact fixture intent. The most promising incremental tests for TrendPilot are:
1. `buy + exact fixture + tickets`
2. Arabic `شراء تذاكر + exact fixture`
3. shortened club-name variants (`man united`, `man city`)
4. rivalry-name terms (`el clasico`, `manchester derby`, `north london derby`, `madrid derby`)

These preserve purchase intent while staying much safer than copying broad team-level terms used by large advertisers with much larger budgets.