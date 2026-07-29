document.addEventListener("DOMContentLoaded", () => {
  const tools = window.TRENDPILOT_TOOLS || [];
  const menuButton = document.getElementById("menuButton");
  const mainNav = document.getElementById("mainNav");
  menuButton?.addEventListener("click", () => {
    const open = mainNav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(open));
  });
  mainNav?.addEventListener("click", e => {
    if (e.target.matches("a")) {
      mainNav.classList.remove("open");
      menuButton.setAttribute("aria-expanded","false");
    }
  });
  window.addEventListener("scroll", () => document.querySelector(".site-header")?.classList.toggle("scrolled", window.scrollY > 16));

  const reveal = () => document.querySelectorAll(".reveal").forEach(el => el.classList.add("visible"));
  reveal();

  const cardsHtml = (items) => items.map(t => `
    <article class="tool-card reveal visible" style="--tool-a:${t.colours[0]};--tool-b:${t.colours[1]}" data-category="${t.category}" data-search="${(t.name+" "+t.tagline+" "+t.bestFor).toLowerCase()}">
      <div class="tool-top"><div class="tool-logo">${t.initials}</div><div class="tool-name"><strong>${t.name}</strong><small>${t.category}</small></div><span class="tool-badge">${t.badge}</span></div>
      <p class="tool-description">${t.tagline}</p>
      <div class="programme-preview"><div><span>Commission</span><strong>${t.commission}</strong></div><div><span>Cookie</span><strong>${t.cookie}</strong></div></div>
      <div class="tool-score-row"><span>TrendPilot opportunity score</span><strong class="tool-score">${t.score}</strong></div>
      <div class="tool-footer"><span>Verified ${t.verified}</span><a class="tool-action" href="tool.html?tool=${t.slug}">View details →</a></div>
    </article>`).join("");

  const grid = document.getElementById("toolsGrid");
  if (grid) grid.innerHTML = cardsHtml(tools);

  const toolSearch = document.getElementById("toolSearch");
  let toolFilter = "All";
  const filterTools = () => {
    const q=(toolSearch?.value||"").toLowerCase().trim(); let shown=0;
    document.querySelectorAll("#toolsGrid .tool-card").forEach(card=>{
      const ok=(toolFilter==="All"||card.dataset.category===toolFilter)&&(card.dataset.search||"").includes(q);
      card.classList.toggle("hidden",!ok); if(ok) shown++;
    });
    document.getElementById("emptyState")?.classList.toggle("hidden",shown>0);
  };
  document.querySelectorAll("#filterButtons .filter-button").forEach(btn=>btn.addEventListener("click",()=>{
    toolFilter=btn.dataset.filter;
    document.querySelectorAll("#filterButtons .filter-button").forEach(b=>b.classList.toggle("active",b===btn));
    filterTools();
  }));
  toolSearch?.addEventListener("input",filterTools);
  document.querySelectorAll("[data-category-jump]").forEach(card=>card.addEventListener("click",()=>{
    document.querySelector(`#filterButtons [data-filter="${card.dataset.categoryJump}"]`)?.click();
    document.getElementById("tools")?.scrollIntoView({behavior:"smooth"});
  }));

  const pgrid=document.getElementById("programmeGrid");
  if(pgrid) pgrid.innerHTML=tools.map(t=>`
    <article class="programme-card" data-category="${t.category}" data-search="${(t.name+" "+t.commission+" "+t.network+" "+t.bestFor).toLowerCase()}">
      <div class="programme-card-head"><div class="tool-logo" style="--tool-a:${t.colours[0]};--tool-b:${t.colours[1]}">${t.initials}</div><div><h3>${t.name}</h3><p>${t.category} • ${t.network}</p></div><span class="tool-badge">${t.badge}</span></div>
      <div class="programme-facts"><div><span>Commission</span><strong>${t.commission}</strong></div><div><span>Duration</span><strong>${t.duration}</strong></div><div><span>Cookie</span><strong>${t.cookie}</strong></div></div>
      <p>${t.programmeNote}</p><div class="programme-actions"><a class="button button-small button-outline" href="tool.html?tool=${t.slug}">Read analysis</a><a class="button button-small button-primary" href="${t.applicationUrl}" target="_blank" rel="noopener">Apply officially</a></div>
    </article>`).join("");

  let pf="All"; const ps=document.getElementById("programmeSearch");
  const filterPrograms=()=>{const q=(ps?.value||"").toLowerCase().trim();document.querySelectorAll("#programmeGrid .programme-card").forEach(c=>c.classList.toggle("hidden",!((pf==="All"||c.dataset.category===pf)&&(c.dataset.search||"").includes(q))))};
  document.querySelectorAll("#programmeFilters .filter-button").forEach(btn=>btn.addEventListener("click",()=>{pf=btn.dataset.filter;document.querySelectorAll("#programmeFilters .filter-button").forEach(b=>b.classList.toggle("active",b===btn));filterPrograms()}));
  ps?.addEventListener("input",filterPrograms);

  if(document.getElementById("toolPage")){
    const slug=new URLSearchParams(location.search).get("tool");
    const t=tools.find(x=>x.slug===slug)||tools[0];
    document.title=`${t.name} Affiliate Programme — TrendPilot AI`;
    document.getElementById("metaDescription").content=t.description;
    const logo=document.getElementById("toolLogo"); logo.textContent=t.initials; logo.style.setProperty("--tool-a",t.colours[0]); logo.style.setProperty("--tool-b",t.colours[1]);
    document.getElementById("toolCategory").textContent=t.category;
    document.getElementById("toolName").textContent=t.name;
    document.getElementById("toolDescription").textContent=t.description;
    document.getElementById("bestFor").textContent=t.bestFor;
    document.getElementById("programmeNote").textContent=t.programmeNote;
    document.getElementById("summary").innerHTML=`<span class="status-chip">Verified ${t.verified}</span><div><span>Commission</span><strong>${t.commission}</strong></div><div><span>Duration</span><strong>${t.duration}</strong></div><div><span>Cookie window</span><strong>${t.cookie}</strong></div><div><span>Tracking platform</span><strong>${t.network}</strong></div>`;
    document.getElementById("pros").innerHTML=t.pros.map(x=>`<li>${x}</li>`).join("");
    document.getElementById("angles").innerHTML=t.angles.map(x=>`<article><span>Content angle</span><strong>${x}</strong></article>`).join("");
    const visit=document.getElementById("visitTool"), apply=document.getElementById("applyProgramme"), source=document.getElementById("sourceLink");
    const link=(window.TRENDPILOT_LINKS||{})[t.slug]||{};
    visit.textContent=`Visit ${t.name}`; visit.href=link.affiliateUrl||t.productUrl; visit.target="_blank"; visit.rel="sponsored nofollow noopener";
    apply.href=t.applicationUrl; apply.target="_blank"; apply.rel="noopener";
    source.href=t.sourceUrl;
  }

  document.getElementById("newsletterForm")?.addEventListener("submit",e=>{e.preventDefault();document.getElementById("formMessage").textContent="The design works. Connect an email service before collecting real subscribers.";e.target.reset();});
});
