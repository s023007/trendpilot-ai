from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / 'events/manchester-derby-2026/nl-nl/index.html'


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    html = PAGE.read_text(encoding='utf-8')

    require('<html lang="nl-NL"' in html, 'Paid Manchester page must remain Dutch')
    require('Laatst gecontroleerd: 12 sep 2026' in html, 'Fresh 12 Sep price timestamp is required')
    require('last-minute' in html.lower(), 'Landing page must explain the last-minute comparison value')
    require('save-search.js?v=1.0.2' in html, 'Seller-outbound tracking script must remain cache-busted')

    # Current exact-fixture references verified on 12 Sep 2026.
    require('<span class="seller">Football Ticket Pad</span><strong class="price">£125</strong>' in html,
            'Football Ticket Pad exact-fixture reference must be £125')
    require('https://www.footballticketpad.com/premier-league/manchester-united-v-manchester-city' in html,
            'Football Ticket Pad must link to the exact fixture')

    require('<span class="seller">LiveFootballTickets</span><strong class="price">£128</strong>' in html,
            'LiveFootballTickets exact-fixture reference must be £128')
    require('https://www.livefootballtickets.com/fixtures/manchester-united-v-manchester-city-tickets-english-premier-league.html' in html,
            'LiveFootballTickets must link to the exact fixture')

    require('<span class="seller">Ticombo</span><strong class="price">€159</strong>' in html,
            'Ticombo current reference must be €159')
    require('manchester-united-fc-vs-manchester-city-fc-premier-league-3001252536' in html,
            'Ticombo affiliate link must preserve the exact event destination')

    # Do not pay for traffic into stale or broad seller references.
    for stale in ('£250', '£288.40', '€378', '$364', 'Laatst gecontroleerd: 30 aug 2026'):
        require(stale not in html, f'Stale Manchester Derby reference remains: {stale}')
    require('sportsevents365.com/events/venue/' not in html,
            'Broad Sports Events venue link must not remain on paid last-minute landing page')

    cards = re.findall(r'<article class="price-card[^>]*>', html)
    require(len(cards) == 3, f'Expected exactly 3 freshly verified ticket cards, got {len(cards)}')

    require('Prijzen zijn referenties' in html, 'Price-disclaimer must remain visible')
    require('eindprijs' in html.lower(), 'Final seller checkout price warning must remain visible')

    print('PASS Manchester Derby last-minute landing requirements')


if __name__ == '__main__':
    main()
