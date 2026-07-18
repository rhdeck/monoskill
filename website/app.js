import {
  inferSkillName,
  makeCommand,
  makePrompt,
  normalizeSkillName,
  validateSkillName,
  validateSource
} from "./generator.js";
import { collectAnalytics } from "./analytics.js";
import { inspectGitHubSkills } from "./github-repository.js";
import { githubRepository } from "../src/naming.js";
import { gsap } from "gsap";

if (["127.0.0.1", "localhost"].includes(window.location.hostname)) {
  import("./agentation.js").catch(() => {});
}

const form = document.querySelector("#generator-form");
const sourceInput = document.querySelector("#source");
const nameInput = document.querySelector("#name");
const sourceMessage = document.querySelector("#source-message");
const nameMessage = document.querySelector("#name-message");
const scopeInputs = document.querySelectorAll('input[name="scope"]');
const commandOutput = document.querySelector("#command-output");
const promptOutput = document.querySelector("#prompt-output");
const status = document.querySelector("#copy-status");
const generatorTitle = document.querySelector("#generator-title");
const collectionSummary = document.querySelector("#collection-summary");
const scene = document.querySelector(".convergence");
const skillRows = [...scene.querySelectorAll(".skill-row")];
const skillItems = skillRows.flatMap((row) => [...row.children]);
const flood = scene.querySelector(".flood");
const basinLabel = scene.querySelector(".basin-label");
const pipeFill = scene.querySelector(".pipe-fill");
const monoPackage = scene.querySelector(".pressure-package");
const packageContents = scene.querySelector(".package-contents");
const packageCount = scene.querySelector(".package-count");
const pressureResult = scene.querySelector(".pressure-result");
const contextCount = scene.querySelector("[data-context-count]");
const heroBeat = scene.querySelector("[data-hero-beat]");
const heroTitle = scene.querySelector("[data-hero-title]");
const heroDetail = scene.querySelector("[data-hero-detail]");
const heroProgress = [...scene.querySelectorAll(".hero-progress i")];
const sceneWash = scene.querySelector(".hero-scene-wash");
let nameWasEdited = false;
let completionWasTracked = false;
let inspectionController;
let inspectionTimer;

for (let index = 0; index < 47; index += 1) packageContents.append(document.createElement("i"));
const packageCells = [...packageContents.children];

function setPackedCount(count) {
  packageCount.textContent = count === 47 ? "47 skills inside" : `${count} / 47 packed`;
}

function transferGeometry() {
  const inletRect = monoPackage.getBoundingClientRect();
  const targetX = inletRect.left + inletRect.width / 2;
  const targetY = inletRect.top + inletRect.height / 2;
  return skillItems.map((skill) => {
    const rect = skill.getBoundingClientRect();
    return {
      x: targetX - (rect.left + rect.width / 2),
      y: targetY - (rect.top + rect.height / 2)
    };
  });
}

const heroCopy = {
  before: ["01 · Before", "Forty-seven skills flood discovery.", "Every useful capability advertises itself separately."],
  during: ["02 · During", "Package the collection without loss.", "Every skill crosses one visible throat into the same small package."],
  after: ["03 · After", "The pressure is gone. The abilities remain.", "One 331-character entry still routes to all 47 skills."]
};

function setHeroCopy(key) {
  const [beat, title, detail] = heroCopy[key];
  heroBeat.textContent = beat;
  heroTitle.textContent = title;
  heroDetail.textContent = detail;
  heroProgress.forEach((bar, index) => bar.classList.toggle("active", index <= ["before", "during", "after"].indexOf(key)));
  basinLabel.textContent = key === "before" ? "47 separate entries" : key === "during" ? "Packaging 47 / 47" : "Discovery context cleared";
  scene.dataset.animationStep = key;
}

function setContextCount(progress) {
  contextCount.textContent = Math.round(32817 + (331 - 32817) * progress).toLocaleString("en-US");
}

function exposeHeroTimeline(timeline) {
  window.__monoskillAnimation = {
    labels: Object.keys(timeline.labels),
    play: () => timeline.play(),
    seek: (label, offset = 0) => {
      timeline.pause().seek(timeline.labels[label] + offset, false);
      if (heroCopy[label]) setHeroCopy(label);
      if (label === "before") setContextCount(0);
      if (label === "after") setContextCount(1);
    }
  };
}

function buildHeroTimeline() {
  const geometry = transferGeometry();
  const counter = { progress: 0 };
  const timeline = gsap.timeline({
    repeat: -1,
    repeatDelay: 0.5,
    defaults: { ease: "power2.inOut" }
  });

  gsap.set(scene, { autoAlpha: 1 });
  gsap.set(skillItems, { x: 0, y: 0, scale: 1, rotation: 0, autoAlpha: 1, transformOrigin: "center" });
  gsap.set(flood, { scaleY: 1, transformOrigin: "bottom" });
  gsap.set(pipeFill, { scaleX: 0, autoAlpha: 0, transformOrigin: "left" });
  gsap.set(packageCells, { autoAlpha: 0, scale: 0.45, transformOrigin: "center" });
  gsap.set(pressureResult, { autoAlpha: 0, y: 18 });
  gsap.set(sceneWash, { autoAlpha: 0 });
  gsap.set(monoPackage, { x: 0, y: 0, scale: 1, rotation: 0 });
  setPackedCount(0);
  setContextCount(0);
  setHeroCopy("before");

  timeline.addLabel("before", 0)
    .call(() => { setHeroCopy("before"); setPackedCount(0); setContextCount(0); }, null, "before")
    .to({}, { duration: 1.8 })
    .addLabel("during")
    .call(() => setHeroCopy("during"), null, "during")
    .to(pipeFill, { scaleX: 1, autoAlpha: 1, duration: 0.5 }, "during")
    .to(flood, { scaleY: 0.13, duration: 3 }, "during+=0.15")
    .to(skillItems, {
      x: (index) => geometry[index].x,
      y: (index) => geometry[index].y,
      scale: 0.1,
      rotation: (index) => (index % 3 - 1) * 5,
      autoAlpha: 0,
      duration: 1.25,
      stagger: { amount: 2.25, from: "end" },
      ease: "power2.in"
    }, "during+=0.25")
    .to(packageCells, { autoAlpha: 0.82, scale: 1, duration: 0.25, stagger: { amount: 2.25, from: "start" }, ease: "power2.out" }, "during+=0.5")
    .to(counter, { progress: 1, duration: 2.6, onUpdate: () => setContextCount(counter.progress) }, "during+=0.2")
    .call(() => setPackedCount(47), null, "during+=2.7")
    .to(pipeFill, { autoAlpha: 0.3, duration: 0.4 }, "during+=2.8")
    .addLabel("after")
    .call(() => { setHeroCopy("after"); setContextCount(1); }, null, "after")
    .to(pressureResult, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, "after")
    .to({}, { duration: 2.4 })
    .addLabel("reset")
    .to(sceneWash, { autoAlpha: 1, duration: 0.35 })
    .set(skillItems, { x: 0, y: 0, scale: 1, rotation: 0, autoAlpha: 1 })
    .set(packageCells, { autoAlpha: 0, scale: 0.45 })
    .set(flood, { scaleY: 1 })
    .set(pipeFill, { scaleX: 0, autoAlpha: 0 })
    .set(pressureResult, { autoAlpha: 0, y: 18 })
    .set(counter, { progress: 0 })
    .call(() => { setPackedCount(0); setContextCount(0); setHeroCopy("before"); })
    .to(sceneWash, { autoAlpha: 0, duration: 0.35 });

  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !document.hidden) timeline.resume();
    else timeline.pause();
  }, { threshold: 0.08 });
  const onVisibility = () => { document.hidden ? timeline.pause() : timeline.resume(); };
  observer.observe(scene);
  document.addEventListener("visibilitychange", onVisibility);

  exposeHeroTimeline(timeline);

  return () => {
    observer.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    timeline.kill();
    delete window.__monoskillAnimation;
  };
}

const motion = gsap.matchMedia();
motion.add({
  isDesktop: "(min-width: 621px)",
  isMobile: "(max-width: 620px)",
  reduceMotion: "(prefers-reduced-motion: reduce)"
}, (context) => {
  if (!context.conditions.reduceMotion) return buildHeroTimeline();

  const staticTimeline = gsap.timeline({ paused: true }).addLabel("before", 0).addLabel("during", 0.1).addLabel("after", 0.2).addLabel("reset", 0.3);
  gsap.set(skillItems, { autoAlpha: 0 });
  gsap.set(flood, { scaleY: 0.13, transformOrigin: "bottom" });
  gsap.set(pipeFill, { autoAlpha: 0 });
  gsap.set(packageCells, { autoAlpha: 0.82, scale: 1 });
  gsap.set(pressureResult, { autoAlpha: 1, y: 0 });
  setPackedCount(47);
  setContextCount(1);
  setHeroCopy("after");
  exposeHeroTimeline(staticTimeline);
  return () => gsap.set(scene.querySelectorAll("*"), { clearProps: "transform,opacity,visibility" });
});

function track(event, detail = {}) {
  const safeDetail = { event, ...detail };
  window.dispatchEvent(new CustomEvent("monoskill:analytics", { detail: safeDetail }));
  collectAnalytics(event, detail);
}

function trackSourceCompletion() {
  const sourceResult = validateSource(sourceInput.value);
  if (completionWasTracked || !sourceResult.valid || !validateSkillName(nameInput.value)) return;
  track("source_input_completed", { source_type: sourceResult.type });
  completionWasTracked = true;
}

function selectedScope() {
  return document.querySelector('input[name="scope"]:checked').value;
}

function scheduleRepositoryInspection({ immediate = false, label } = {}) {
  window.clearTimeout(inspectionTimer);
  inspectionController?.abort();
  const repository = githubRepository(sourceInput.value);
  if (!repository) {
    generatorTitle.textContent = "Turn many skills into one.";
    collectionSummary.textContent = "Choose an example or paste any public GitHub repository.";
    return;
  }

  const run = async () => {
    inspectionController = new AbortController();
    const sourceAtStart = sourceInput.value;
    collectionSummary.textContent = `Checking ${repository.owner}/${repository.repo} on GitHub…`;
    try {
      const result = await inspectGitHubSkills(sourceAtStart, { signal: inspectionController.signal });
      if (sourceInput.value !== sourceAtStart) return;
      const provider = label || result.fullName.split("/")[0];
      generatorTitle.textContent = `${provider}’s ${result.skillCount} skills. One Monoskill.`;
      collectionSummary.textContent = `Found ${result.skillCount} skills on GitHub. The generated name is ${nameInput.value}.`;
    } catch (error) {
      if (error.name === "AbortError" || sourceInput.value !== sourceAtStart) return;
      generatorTitle.textContent = "Turn many skills into one.";
      collectionSummary.textContent = error.message;
    }
  };
  inspectionTimer = window.setTimeout(run, immediate ? 0 : 450);
}

function render({ inferName = true } = {}) {
  const sourceResult = validateSource(sourceInput.value);
  if (inferName && !nameWasEdited && sourceResult.valid) nameInput.value = inferSkillName(sourceResult.value);
  const nameValid = validateSkillName(nameInput.value);

  sourceInput.setAttribute("aria-invalid", String(sourceInput.value.length > 0 && !sourceResult.valid));
  nameInput.setAttribute("aria-invalid", String(nameInput.value.length > 0 && !nameValid));
  sourceMessage.textContent = sourceInput.value.length && !sourceResult.valid ? sourceResult.message : "GitHub shorthand, Git URL, or a local path.";
  nameMessage.textContent = nameInput.value.length && !nameValid
    ? "Use 1–63 lowercase letters, digits, and hyphens."
    : "This becomes the folder and skill trigger name.";

  const ready = sourceResult.valid && nameValid;
  form.dataset.ready = String(ready);
  scene.dataset.ready = String(ready);
  for (const button of document.querySelectorAll("[data-copy]")) button.disabled = !ready;

  if (!ready) {
    commandOutput.textContent = "monoskill add <source> --name <name>";
    promptOutput.textContent = "Your AI-ready installation prompt will appear here.";
    completionWasTracked = false;
    return;
  }

  commandOutput.textContent = makeCommand(sourceResult.value, nameInput.value, selectedScope());
  promptOutput.textContent = makePrompt(sourceResult.value, nameInput.value, selectedScope());
}

sourceInput.addEventListener("input", () => {
  completionWasTracked = false;
  render();
  scheduleRepositoryInspection();
});
sourceInput.addEventListener("blur", trackSourceCompletion);
nameInput.addEventListener("input", () => {
  nameWasEdited = true;
  render();
});
nameInput.addEventListener("blur", () => {
  const normalized = normalizeSkillName(nameInput.value);
  if (normalized) nameInput.value = normalized;
  render();
});
for (const input of scopeInputs) input.addEventListener("change", () => render({ inferName: false }));
form.addEventListener("submit", (event) => event.preventDefault());

for (const button of document.querySelectorAll("[data-example-source]")) {
  button.addEventListener("click", () => {
    sourceInput.value = button.dataset.exampleSource;
    nameWasEdited = false;
    render();
    scheduleRepositoryInspection({ immediate: true, label: button.dataset.exampleLabel });
    sourceInput.focus();
  });
}

for (const button of document.querySelectorAll("[data-copy]")) {
  const originalLabel = button.textContent;
  let resetTimer;
  button.addEventListener("click", async () => {
    const target = document.querySelector(`#${button.dataset.copy}`);
    trackSourceCompletion();
    try {
      await navigator.clipboard.writeText(target.textContent);
      window.clearTimeout(resetTimer);
      button.textContent = "Copied";
      status.textContent = `${button.dataset.label} copied to clipboard.`;
      track(button.dataset.event);
      resetTimer = window.setTimeout(() => { button.textContent = originalLabel; }, 1800);
    } catch {
      status.textContent = "Clipboard access was blocked. Select the text and copy it manually.";
      target.focus();
      const selection = window.getSelection();
      selection.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(target);
      selection.addRange(range);
    }
  });
}

render();
