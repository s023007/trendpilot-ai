/* TrendPilot V13.6 ticket-provider configuration.
   The installer replaces  with the exact Admitad link supplied at install time. */
window.TP_TICKETS_CONFIG = Object.freeze({
  version: "13.6.0",
  providers: {
    ticombo: {
      id: "ticombo",
      name: "Ticombo",
      publicType: "Ticket marketplace",
      sampleDeepLink: "",
      homepage: "https://www.ticombo.com/",
      disclosure: "Ticombo is presented as a ticket marketplace. Confirm seller, seat, fees, delivery, refund and buyer-protection terms on the live listing."
    }
  },
  events: {
    "mens-nations-league": {
      id: "mens-nations-league",
      name: "Men’s Nations League tickets",
      category: "Football",
      dateLabel: "24 Sep–17 Nov 2026",
      destination: "https://www.ticombo.com/en/sports-tickets/football-tickets/mens-nations-league",
      provider: "ticombo"
    }
  }
});
