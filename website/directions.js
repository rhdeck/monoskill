import { gsap } from "gsap";

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

for (const field of document.querySelectorAll("[data-skill-field]")) {
  skills.forEach((skill, index) => {
    const item = document.createElement("span");
    item.textContent = skill;
    item.style.setProperty("--index", index);
    field.append(item);
  });
}

const orbitField = document.querySelector("[data-orbit-field]");
skills.forEach((skill, index) => {
  const item = document.createElement("span");
  const angle = (index / skills.length) * Math.PI * 2;
  const ring = index % 3;
  const radiusX = [42, 36, 29][ring];
  const radiusY = [43, 35, 27][ring];
  item.textContent = skill;
  item.style.setProperty("--x", `${50 + Math.cos(angle) * radiusX}%`);
  item.style.setProperty("--y", `${50 + Math.sin(angle) * radiusY}%`);
  item.style.setProperty("--rotation", `${(angle * 180) / Math.PI + 90}deg`);
  orbitField.append(item);
});

const reviewParams = new URLSearchParams(window.location.search);
const requestedFrame = reviewParams.get("frame");
const requested = reviewParams.get("view") || "all";
const active = ["all", "pressure", "press", "gravity"].includes(requested) ? requested : "all";
document.body.dataset.view = active;
document.querySelector(`.review-bar a[href="?view=${active}"]`)?.setAttribute("aria-current", "page");

function deltaTo(target, element) {
  const targetRect = target.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  return {
    x: targetRect.left + targetRect.width / 2 - (elementRect.left + elementRect.width / 2),
    y: targetRect.top + targetRect.height / 2 - (elementRect.top + elementRect.height / 2)
  };
}

function watch(section, timeline) {
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !document.hidden) timeline.play();
    else timeline.pause();
  }, { threshold: 0.18 });
  const onVisibility = () => {
    const visible = section.getBoundingClientRect().bottom > 0 && section.getBoundingClientRect().top < innerHeight;
    if (document.hidden || !visible) timeline.pause();
    else timeline.play();
  };
  observer.observe(section);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    observer.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    timeline.kill();
  };
}

function pressureTimeline() {
  const section = document.querySelector(".pressure");
  const stage = section.querySelector(".pressure-stage");
  const items = [...section.querySelectorAll(".pressure-skills span")];
  const water = section.querySelector(".pressure-water");
  const valve = section.querySelector(".pressure-valve");
  const inlet = section.querySelector(".pressure-valve strong");
  const load = section.querySelector(".pressure-meter b");
  const result = section.querySelector(".pressure-result");
  const geometry = items.map((item) => deltaTo(inlet, item));
  const groups = Array.from({ length: 6 }, (_, index) => items.slice(index * 8, index === 5 ? items.length : (index + 1) * 8));
  const timeline = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.2, defaults: { ease: "power3.inOut" } });

  gsap.set(items, { x: 0, y: 0, scale: 1, rotation: 0, autoAlpha: 1, transformOrigin: "center" });
  gsap.set(water, { scaleY: 1, transformOrigin: "bottom" });
  gsap.set(valve, { rotation: 0, scale: 1 });
  gsap.set(result, { autoAlpha: 0, y: 12 });
  load.textContent = "32,817";

  timeline.addLabel("flooded", 0).to({}, { duration: 1.35 });
  groups.forEach((group, groupIndex) => {
    const label = `release-${groupIndex + 1}`;
    timeline.addLabel(label)
      .to(group, {
        x: (_, item) => geometry[items.indexOf(item)].x,
        y: (_, item) => geometry[items.indexOf(item)].y,
        scale: 0.08,
        rotation: (_, item) => (items.indexOf(item) % 3 - 1) * 5,
        autoAlpha: 0,
        duration: 0.78,
        stagger: 0.035,
        ease: "power3.in"
      }, label)
      .to(water, { scaleY: 1 - ((groupIndex + 1) / groups.length) * 0.92, duration: 0.9 }, label)
      .to(valve, { rotation: `+=${groupIndex % 2 ? 24 : -24}`, duration: 0.45, ease: "power3.out" }, `${label}+=0.42`);
  });
  timeline.addLabel("clear")
    .call(() => { load.textContent = "331"; })
    .to(valve, { rotation: 90, scale: 1.06, duration: 0.8, ease: "power3.out" }, "clear")
    .to(result, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power3.out" }, "clear+=0.35")
    .to({}, { duration: 2.2 })
    .addLabel("reset")
    .to(stage, { autoAlpha: 0, duration: 0.3, ease: "power2.in" })
    .set(items, { x: 0, y: 0, scale: 1, rotation: 0, autoAlpha: 1 })
    .set(water, { scaleY: 1 })
    .set(valve, { rotation: 0, scale: 1 })
    .set(result, { autoAlpha: 0, y: 12 })
    .call(() => { load.textContent = "32,817"; })
    .to(stage, { autoAlpha: 1, duration: 0.4, ease: "power2.out" });

  return { section, timeline };
}

function pressTimeline() {
  const section = document.querySelector(".press");
  const stage = section.querySelector(".press-stage");
  const items = [...section.querySelectorAll(".press-field span")];
  const volume = section.querySelector(".press-volume");
  const target = section.querySelector(".press-volume strong");
  const ruleFrom = section.querySelector(".press-rule span:first-child");
  const ruleTo = section.querySelector(".press-rule span:last-child");
  const geometry = items.map((item) => deltaTo(target, item));
  const timeline = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.2, defaults: { ease: "power3.inOut" } });

  gsap.set(items, { x: 0, y: 0, scale: 1, rotation: 0, autoAlpha: 1, transformOrigin: "center" });
  gsap.set(volume, { scale: 1, rotation: 0, transformOrigin: "center" });
  gsap.set(ruleFrom, { autoAlpha: 1 });
  gsap.set(ruleTo, { color: "#111016", scale: 1 });

  timeline.addLabel("crowded", 0).to({}, { duration: 1.4 })
    .addLabel("bind")
    .to(items, {
      x: (_, item) => geometry[items.indexOf(item)].x,
      y: (_, item) => geometry[items.indexOf(item)].y,
      scale: 0.06,
      rotation: (_, item) => (items.indexOf(item) % 5 - 2) * 2,
      autoAlpha: 0,
      duration: 1.6,
      stagger: { each: 0.025, from: "end" },
      ease: "power3.in"
    }, "bind")
    .to(volume, { scale: 1.035, duration: 0.55, repeat: 2, yoyo: true, ease: "power2.inOut" }, "bind+=0.85")
    .to(ruleFrom, { autoAlpha: 0.22, duration: 0.5 }, "bind+=1.4")
    .to(ruleTo, { color: "#f2643d", scale: 1.35, duration: 0.55, transformOrigin: "right center", ease: "power3.out" }, "bind+=1.45")
    .addLabel("bound")
    .to({}, { duration: 2.2 })
    .addLabel("reset")
    .to(stage, { autoAlpha: 0, duration: 0.3, ease: "power2.in" })
    .set(items, { x: 0, y: 0, scale: 1, rotation: 0, autoAlpha: 1 })
    .set(volume, { scale: 1, rotation: 0 })
    .set(ruleFrom, { autoAlpha: 1 })
    .set(ruleTo, { color: "#111016", scale: 1 })
    .to(stage, { autoAlpha: 1, duration: 0.4, ease: "power2.out" });

  return { section, timeline };
}

function gravityTimeline() {
  const section = document.querySelector(".gravity");
  const stage = section.querySelector(".gravity-stage");
  const items = [...section.querySelectorAll(".gravity-skills span")];
  const core = section.querySelector(".gravity-core");
  const rings = [...section.querySelectorAll(".context-orbit")];
  const result = section.querySelector(".gravity-result");
  const geometry = items.map((item) => deltaTo(core, item));
  const timeline = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.2, defaults: { ease: "power3.inOut" } });

  gsap.set(items, { x: 0, y: 0, scale: 1, autoAlpha: 1, transformOrigin: "center" });
  gsap.set(rings, { scale: 1, autoAlpha: 1, transformOrigin: "center" });
  gsap.set(core, { scale: 1, rotation: 0 });
  gsap.set(result, { autoAlpha: 0, y: 10 });

  timeline.addLabel("orbit", 0).to({}, { duration: 1.4 })
    .addLabel("collapse")
    .to(rings, { scale: (index) => 0.55 + index * 0.08, duration: 2.2, stagger: 0.12, ease: "power3.inOut" }, "collapse")
    .to(items, {
      x: (_, item) => geometry[items.indexOf(item)].x,
      y: (_, item) => geometry[items.indexOf(item)].y,
      scale: 0.04,
      autoAlpha: 0,
      duration: 1.75,
      stagger: { each: 0.025, from: "edges" },
      ease: "power3.in"
    }, "collapse+=0.35")
    .to(core, { scale: 1.11, rotation: 8, duration: 0.8, ease: "power3.out" }, "collapse+=1.5")
    .to(core, { scale: 1.04, rotation: 0, duration: 0.5, ease: "power2.out" })
    .to(result, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power3.out" }, "<")
    .addLabel("light")
    .to({}, { duration: 2.2 })
    .addLabel("reset")
    .to(stage, { autoAlpha: 0, duration: 0.3, ease: "power2.in" })
    .set(items, { x: 0, y: 0, scale: 1, autoAlpha: 1 })
    .set(rings, { scale: 1, autoAlpha: 1 })
    .set(core, { scale: 1, rotation: 0 })
    .set(result, { autoAlpha: 0, y: 10 })
    .to(stage, { autoAlpha: 1, duration: 0.4, ease: "power2.out" });

  return { section, timeline };
}

const animations = {};
const media = gsap.matchMedia();
media.add({
  motion: "(prefers-reduced-motion: no-preference)",
  reduced: "(prefers-reduced-motion: reduce)"
}, (context) => {
  if (context.conditions.reduced) return undefined;
  const cleanup = [];
  for (const [name, makeTimeline] of Object.entries({ pressure: pressureTimeline, press: pressTimeline, gravity: gravityTimeline })) {
    const { section, timeline } = makeTimeline();
    animations[name] = {
      labels: Object.keys(timeline.labels),
      play: () => timeline.play(),
      pause: () => timeline.pause(),
      seek: (label, offset = 0) => timeline.pause().seek(timeline.labels[label] + offset, false)
    };
    cleanup.push(requestedFrame ? () => timeline.kill() : watch(section, timeline));
  }
  return () => cleanup.forEach((stop) => stop());
});

window.__directionAnimations = animations;

if (active !== "all" && requestedFrame) {
  const finalFrames = {
    pressure: ["clear", 0.9],
    press: ["bound", 0],
    gravity: ["light", 0]
  };
  const startFrames = {
    pressure: ["flooded", 0],
    press: ["crowded", 0],
    gravity: ["orbit", 0]
  };
  requestAnimationFrame(() => {
    const [label, offset] = requestedFrame === "final" ? finalFrames[active] : startFrames[active];
    animations[active].seek(label, offset);
    document.body.dataset.frame = requestedFrame;
  });
}
