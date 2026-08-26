# Google Ads — Manchester Derby Saudi Launch Checklist

Campaign: `TP-GADS-SA-MANCHESTER-DERBY-01`

Status: **DRAFT — DO NOT PUBLISH**

## Already complete

- Billing profile verified and active.
- No legacy Google Ads campaigns are running.
- Landing page is live on `trendpilotchoice.com`.
- Ticket-aggregator disclosure is visible above the fold.
- Daily ticket-price refresh is active.
- Saudi Arabia is the only initial geo target.
- Location mode is **Presence only**.
- Google Search only; Search Partners and Display are off.
- English Saudi Keyword Planner review is complete.
- Arabic Saudi Keyword Planner review is complete.
- Planner evidence supports **English first** for the tiny initial test; Arabic remains prepared but paused because the Arabic export did not show measurable derby-specific queries.
- Exact and phrase match only; no broad positive match for the first test.
- Negative-keyword guardrails include other Manchester United opponents so phrase matching cannot drift to a different fixture.
- Two RSA variants are prepared for each primary language group.
- UTM tracking is prepared.
- Initial spend is protected by a manual first-test guard.

## Keyword Planner findings — English / Saudi Arabia

- Export contained **460** keyword ideas.
- **179** rows were in Google's 50 avg-monthly-search bucket, **136** showed 0, and **145** had no measurable search-volume value.
- Canonical query `manchester united vs manchester city tickets`: approx. **50 avg monthly searches**, High competition, index **75**, top-of-page bid range **$0.21–$2.29**.
- Several exact-event variants showed the same approx. 50-search bucket with **Low competition / index 14**, including `man utd vs man city tickets` and `manchester united manchester city tickets`.
- First test excludes outdated-year, women/WSL, away-specific, stadium-information and other-opponent queries.
- Full snapshot: `keyword-planner-english-sa-2026-08-26.json`.

## Keyword Planner findings — Arabic / Saudi Arabia

- Export contained **16** rows: **5 Arabic** and **11 English** suggestions.
- The Arabic run showed measurable generic Manchester United ticket demand, but **no measurable Arabic query in this export explicitly named Manchester City or the Manchester derby**.
- `تذاكر مباراة مانشستر يونايتد`: approx. **50 avg monthly searches**, High competition, index **71**, top-of-page bid range about **$0.19–$0.85**.
- `حجز تذاكر مباراة مانشستر يونايتد` and `سعر تذكرة مباراة مانشستر يونايتد` also appeared in the approx. 50-search bucket, but they are not specific to this fixture.
- `تذاكر مباراة مانشستر يونايتد وليفربول` is explicitly excluded because it is a different opponent.
- Because the first budget is very small, the Arabic group remains **prepared but paused** rather than paying for generic club-ticket searches that may concern another match.
- Full snapshot: `keyword-planner-arabic-sa-2026-08-26.json`.

## Waiting on Google

- [ ] Event Ticket Sale Eligibility approval for the Google Ads account + `trendpilotchoice.com`.

Do not publish any event-ticket ad until this is explicitly approved.

## Must be completed before launch

- [ ] Confirm Google Event Ticket Sale Eligibility approval.
- [x] Run Keyword Planner for Saudi Arabia on the **English** exact/phrase keyword set.
- [x] Run Keyword Planner for Saudi Arabia on the **Arabic** keyword set.
- [x] Revisit draft CPC using Keyword Planner evidence; current controlled English cap remains **$0.45** and Arabic is paused.
- [ ] Verify affiliate-outbound-click tracking from landing page to ticket sellers.
- [ ] Confirm current ticket prices and all outbound links on launch day.
- [ ] Confirm the landing page still states that TrendPilot is a comparison/aggregator site and does not sell tickets.
- [ ] Confirm any resale-price warning remains visible.
- [ ] Confirm all ad text avoids “official”, “authorized reseller”, or affiliation claims.
- [ ] Final manual review in Google Ads before publishing.

## First controlled test

- Initial active language: **English only**.
- Arabic ad group: **Prepared but paused** until data shows derby-specific Arabic demand.
- Draft average daily budget: **$3/day**.
- First test: **2 days**.
- Manual total-spend guard: **$6**.
- The $6 guard is a manual operating rule, not a guaranteed Google billing ceiling.
- Google Search only.
- No automatic scaling.
- Do not enable broad match.
- Do not switch to conversion-based automated bidding until conversion tracking is verified and there is enough qualified data.

## Daily review during the first test

1. Review Search terms.
2. Add irrelevant queries as negative keywords.
3. Record CPC by keyword/ad group.
4. Record landing-page engagement.
5. Record affiliate outbound clicks separately from independent-reference clicks.
6. Pause any keyword that consumes spend without showing purchase intent.
7. Do not judge performance by CTR alone; prioritize qualified outbound seller clicks and eventual commission economics.

## Stop conditions

Pause the campaign immediately if any of these occur:

- Google event-ticket eligibility is missing/revoked.
- Landing page or ticket links fail.
- Search terms are substantially unrelated to buying this specific match ticket.
- The manual first-test spend guard is reached without a qualified affiliate outbound click.
- Policy warnings appear in Google Ads.

## Expansion only after evidence

If the first test produces qualified traffic, expand in this order:

1. Winning English exact-match keywords.
2. Winning English phrase-match keywords.
3. Additional high-intent Saudi search terms from the Search terms report.
4. Test Arabic only when derby-specific Arabic demand appears in Search Terms, later Planner data, or organic query data.
5. Time-of-day/device adjustments only after enough data.
6. Broader Gulf-country campaigns only as separate controlled tests with localized landing pages/currency presentation.
