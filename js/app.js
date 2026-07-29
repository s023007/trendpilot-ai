const tools = [
  {
    name: "ClipForge",
    category: "Video",
    initials: "CF",
    description: "Turn long videos into short clips, captions and social-ready highlights.",
    score: 92,
    badge: "Hot",
    signal: "Strong demand",
    colours: ["#8b5cf6", "#5eead4"]
  },
  {
    name: "CopyPilot",
    category: "Writing",
    initials: "CP",
    description: "Draft landing pages, email sequences and social content from a short brief.",
    score: 88,
    badge: "Rising",
    signal: "High buyer intent",
    colours: ["#60a5fa", "#8b5cf6"]
  },
  {
    name: "PixelMint",
    category: "Design",
    initials: "PM",
    description: "Generate branded visual assets, ad concepts and product mock-ups quickly.",
    score: 86,
    badge: "Rising",
    signal: "Content gap",
    colours: ["#ec4899", "#8b5cf6"]
  },
  {
    name: "MeetBrief",
    category: "Productivity",
    initials: "MB",
    description: "Capture meetings, extract decisions and turn conversations into action lists.",
    score: 84,
    badge: "Stable",
    signal: "Recurring need",
    colours: ["#5eead4", "#60a5fa"]
  },
  {
    name: "RankFlow",
    category: "Marketing",
    initials: "RF",
    description: "Plan search content, build topic clusters and find underserved keywords.",
    score: 83,
    badge: "Rising",
    signal: "Commercial niche",
    colours: ["#f59e0b", "#ec4899"]
  },
  {
    name: "CodeSprint",
    category: "Coding",
    initials: "CS",
    description: "Prototype, debug and explain code with an AI-assisted development workspace.",
    score: 81,
    badge: "Stable",
    signal: "Large audience",
    colours: ["#22c55e", "#3b82f6"]
  },
  {
    name: "VoiceDesk",
    category: "Productivity",
    initials: "VD",
    description: "Create AI phone and support agents for appointments and common questions.",
    score: 90,
    badge: "Hot",
    signal: "Fast momentum",
    colours: ["#14b8a6", "#8b5cf6"]
  },
  {
    name: "AdSpark",
    category: "Marketing",
    initials: "AS",
    description: "Generate and test multiple ad angles for paid social campaigns.",
    score: 79,
    badge: "New",
    signal: "Useful demos",
    colours: ["#f97316", "#ef4444"]
  },
  {
    name: "ResearchLens",
    category: "Writing",
    initials: "RL",
    description: "Summarise sources, organise notes and build structured research briefs.",
    score: 78,
    badge: "Stable",
    signal: "Evergreen use",
    colours: ["#6366f1", "#06b6d4"]
  },
  {
    name: "BrandCanvas",
    category: "Design",
    initials: "BC",
    description: "Create visual directions, palettes and lightweight brand systems.",
    score: 76,
    badge: "New",
    signal: "Creator audience",
    colours: ["#d946ef", "#f59e0b"]
  },
  {
    name: "DemoFlow",
    category: "Video",
    initials: "DF",
    description: "Build product walkthroughs and short demo videos without a studio.",
    score: 85,
    badge: "Rising",
    signal: "B2B demand",
    colours: ["#3b82f6", "#14b8a6"]
  },
  {
    name: "InboxIQ",
    category: "Productivity",
    initials: "IQ",
    description: "Prioritise emails, draft replies and turn inbox threads into tasks.",
    score: 74,
    badge: "Stable",
    signal: "Broad market",
    colours: ["#0ea5e9", "#8b5cf6"]
  }
];

const state = {
  filter: "All",
  query: "",
  visible: 6
};

const grid = document.getElementById("toolsGrid");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("toolSearch");
const filterButtons = document.getElementById("filterButtons");
const showMoreButton = document.getElementById("showMoreButton");
const toast = document.getElementById("toast");

function renderTools() {
  const query = state.query.toLowerCase().trim();

  const filtered = tools.filter((tool) => {
    const matchesCategory = state.filter === "All" || tool.category === state.filter;
    const searchable = `${tool.name} ${tool.category} ${tool.description} ${tool.signal}`.toLowerCase();
    return matchesCategory && searchable.includes(query);
  });

  const visibleTools = filtered.slice(0, state.visible);

  grid.innerHTML = visibleTools.map((tool) => `
    <article class="tool-card reveal visible" style="--tool-a:${tool.colours[0]};--tool-b:${tool.colours[1]}">
      <div class="tool-top">
        <div class="tool-logo" aria-hidden="true">${tool.initials}</div>
        <div class="tool-name">
          <strong>${tool.name}</strong>
          <small>${tool.category}</small>
        </div>
        <span class="tool-badge">${tool.badge}</span>
      </div>

      <p class="tool-description">${tool.description}</p>

      <div class="tool-score-row">
        <span>AI Opportunity Score™</span>
        <strong class="tool-score">${tool.score}</strong>
      </div>

      <div class="tool-footer">
        <span>${tool.signal}</span>
        <button class="tool-action" type="button" data-tool="${tool.name}" aria-label="View ${tool.name}">View →</button>
      </div>
    </article>
  `).join("");

  emptyState.classList.toggle("hidden", filtered.length > 0);
  showMoreButton.classList.toggle("hidden", filtered.length <= state.visible);
}

function setFilter(filter) {
  state.filter = filter;
  state.visible = 6;

  document.querySelectorAll(".filter-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === filter);
  });

  renderTools();
}

filterButtons.addEventListener("click", (event) => {
  const button = event.target.closest(".filter-button");
  if (!button) return;
  setFilter(button.dataset.filter);
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  state.visible = 6;
  renderTools();
});

showMoreButton.addEventListener("click", () => {
  state.visible += 6;
  renderTools();
});

document.querySelectorAll("[data-category-jump]").forEach((card) => {
  card.addEventListener("click", () => {
    const category = card.dataset.categoryJump;
    setFilter(category);
    document.getElementById("tools").scrollIntoView({ behavior: "smooth" });
  });
});

grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tool]");
  if (!button) return;
  showToast(`${button.dataset.tool} is sample data. Replace it in js/app.js with a real tool and your verified affiliate URL.`);
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3600);
}

const newsletterForm = document.getElementById("newsletterForm");
const formMessage = document.getElementById("formMessage");

newsletterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = document.getElementById("emailInput").value.trim();

  if (!email) return;

  formMessage.textContent = "Thanks — the demo form works. Connect it to your email platform before collecting real subscribers.";
  newsletterForm.reset();
  showToast("Demo subscription captured locally. No data was sent.");
});

const menuButton = document.getElementById("menuButton");
const mainNav = document.getElementById("mainNav");

menuButton.addEventListener("click", () => {
  const open = mainNav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(open));
});

mainNav.addEventListener("click", (event) => {
  if (event.target.matches("a")) {
    mainNav.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
  }
});

window.addEventListener("scroll", () => {
  document.querySelector(".site-header").classList.toggle("scrolled", window.scrollY > 16);
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

document.getElementById("currentYear").textContent = new Date().getFullYear();

renderTools();
