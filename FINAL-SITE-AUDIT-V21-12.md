# TrendPilot V21.12 — Final Site-Wide Audit

This checklist is the release contract for the final shopper review. A box is checked only after the related surface has been inspected, corrected where needed, and covered by automated or live verification.

- [x] 00. Final audit scope and release contract created
- [ ] 01. Home page
- [ ] 02. Search / Find autocomplete and query preservation
- [ ] 03. Search result relevance and product-role purity
- [ ] 04. Product details
- [ ] 05. Seller exits / affiliate destinations
- [ ] 06. Rare Finds listing
- [ ] 07. Rare Find details
- [ ] 08. Compare
- [ ] 09. Deals
- [ ] 10. Tickets listing
- [ ] 11. Ticket details
- [ ] 12. Saved products / Price Watch
- [ ] 13. Product categories / Products hub
- [ ] 14. Buying Guides
- [ ] 15. Business sourcing / Wholesale / Software
- [ ] 16. Site navigation / menus / back paths
- [ ] 17. Visual contrast and presentation consistency
- [ ] 18. Mobile Android UX
- [ ] 19. Images / media integrity
- [ ] 20. Seller policy and catalogue leakage
- [ ] 21. Product identity / variants / comparison safety
- [ ] 22. Empty states / 404 / removed products
- [ ] 23. Performance / browser errors / failed requests
- [ ] 24. GitHub Actions / Netlify / stale workflow conflict audit
- [ ] 25. Final end-to-end shopper journeys and release sign-off

## Release rules

1. Do not mark a section complete merely because a workflow is green.
2. Prefer removing obsolete UI/runtime layers over adding another override when an older layer is the conflict source.
3. Do not rebuild V19 canonical seller catalogues or TPID/TPVID/TPOID identity unless a defect proves that rebuild is necessary.
4. Preserve the current blocked-seller policy and no-GEO-import-filter policy.
5. Search must preserve what the shopper typed; autocomplete must never silently replace a valid query on Enter.
6. A seller CTA must distinguish exact-product destinations from broader marketplace/search destinations.
7. No placeholder price, fake availability, empty details page, internal debug identifier, or unreadable text is allowed in the shopper path.
