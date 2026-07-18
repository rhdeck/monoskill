const skills = [
  "ab-testing", "ad-creative", "ads", "ai-seo", "analytics", "aso",
  "churn-prevention", "co-marketing", "cold-email", "community-marketing",
  "competitor-profiling", "competitors", "content-strategy", "copy-editing",
  "copywriting", "cro", "customer-research", "directory-submissions", "emails",
  "free-tools", "image", "launch", "lead-magnets", "marketing-council",
  "marketing-ideas", "marketing-loops", "marketing-plan", "marketing-psychology",
  "offers", "onboarding", "paywalls", "popups", "pricing", "product-marketing",
  "programmatic-seo", "prospecting", "public-relations", "referrals", "revops",
  "sales-enablement", "schema", "seo-audit", "signup", "site-architecture",
  "sms", "social", "video"
];

for (const cloud of document.querySelectorAll("[data-skill-cloud]")) {
  skills.forEach((skill, index) => {
    const item = document.createElement("span");
    item.textContent = skill;
    item.style.setProperty("--i", index);
    cloud.append(item);
  });
}

for (const cloud of document.querySelectorAll("[data-orbit-cloud]")) {
  skills.forEach((skill, index) => {
    const item = document.createElement("span");
    const ring = index % 3;
    const angle = (index / skills.length) * Math.PI * 2 + ring * 0.42;
    const radii = [44, 34, 24];
    item.textContent = skill;
    item.style.setProperty("--x", `${50 + Math.cos(angle) * radii[ring]}%`);
    item.style.setProperty("--y", `${50 + Math.sin(angle) * radii[ring] * 0.77}%`);
    item.style.setProperty("--angle", `${(angle * 180) / Math.PI + 90}deg`);
    item.style.setProperty("--i", index);
    cloud.append(item);
  });
}

for (const grid of document.querySelectorAll("[data-cell-grid]")) {
  grid.setAttribute("aria-label", "47 skills packaged inside");
  for (let index = 0; index < skills.length; index += 1) grid.append(document.createElement("span"));
}
