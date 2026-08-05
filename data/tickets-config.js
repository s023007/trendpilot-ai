window.TP_TICKETS_CONFIG = Object.freeze({
  version: "13.7.0",
  providers: {
    ticombo: {
      id: "ticombo",
      name: "Ticombo",
      type: "ticket marketplace",
      sampleDeepLink: "",
      homepage: "https://www.ticombo.com/en"
    }
  },
  destinations: {
    all: {
      label: "All live events",
      description: "Search across sports, music, theatre and special events.",
      url: "https://www.ticombo.com/en"
    },
    sports: {
      label: "All sports",
      description: "Football, motorsport, tennis and more.",
      url: "https://www.ticombo.com/en/sports-tickets"
    },
    football: {
      label: "Football tickets",
      description: "Browse competitions, clubs and individual matches.",
      url: "https://www.ticombo.com/en/sports-tickets/football-tickets"
    },
    premierLeague: {
      label: "Premier League",
      description: "Browse live Premier League match listings.",
      url: "https://www.ticombo.com/en/sports-tickets/football-tickets/premier-league"
    },
    nationsLeague: {
      label: "Men’s Nations League",
      description: "Browse current competition match listings.",
      url: "https://www.ticombo.com/en/sports-tickets/football-tickets/mens-nations-league"
    },
    arsenal: {
      label: "Arsenal FC",
      description: "Browse current Arsenal match listings.",
      url: "https://www.ticombo.com/en/sports-tickets/football-tickets/arsenal-fc"
    },
    chelsea: {
      label: "Chelsea FC",
      description: "Browse current Chelsea match listings.",
      url: "https://www.ticombo.com/en/sports-tickets/football-tickets/chelsea-fc"
    },
    formula1: {
      label: "Formula 1",
      description: "Browse races, weekend passes and grandstand options.",
      url: "https://www.ticombo.com/en/sports-tickets/motorsports-tickets/formula-1"
    },
    music: {
      label: "Concerts & music",
      description: "Browse artists, tours and live music events.",
      url: "https://www.ticombo.com/en/music-tickets"
    },
    theatre: {
      label: "Theatre & comedy",
      description: "Browse theatre, comedy and stage events.",
      url: "https://www.ticombo.com/en/theatre-tickets"
    }
  },
  searchAliases: [
    { terms: ["nations league", "nation league", "uefa nations"], destination: "nationsLeague", internal: "/tickets/mens-nations-league/" },
    { terms: ["premier league", "epl", "english premier"], destination: "premierLeague" },
    { terms: ["arsenal", "gunners"], destination: "arsenal" },
    { terms: ["chelsea", "blues"], destination: "chelsea" },
    { terms: ["formula 1", "formula one", "f1", "grand prix", "motorsport", "racing"], destination: "formula1" },
    { terms: ["football", "soccer", "match", "game", "club"], destination: "football" },
    { terms: ["concert", "music", "singer", "artist", "tour", "festival", "band"], destination: "music" },
    { terms: ["theatre", "theater", "comedy", "show", "stage"], destination: "theatre" },
    { terms: ["sport", "sports", "tennis", "rugby", "basketball"], destination: "sports" }
  ]
});
