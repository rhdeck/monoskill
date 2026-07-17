import {
  inferSkillName,
  makeCommand,
  makePrompt,
  normalizeSkillName,
  validateSkillName,
  validateSource
} from "./generator.js";
import { collectAnalytics } from "./analytics.js";
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
const scene = document.querySelector(".convergence");
const skillRows = [...scene.querySelectorAll(".skill-row")];
const flood = scene.querySelector(".flood");
const basinLabel = scene.querySelector(".basin-label");
const funnel = scene.querySelector(".transfer-funnel");
const monoPackage = scene.querySelector(".package");
const packageInlet = scene.querySelector(".package-inlet");
const packageContents = scene.querySelector(".package-contents");
const packageCount = scene.querySelector(".package-count");
const waitingKicker = scene.querySelector(".package-kicker-waiting");
const filledKicker = scene.querySelector(".package-kicker-filled");
const oneEntry = scene.querySelector(".one-entry");
let nameWasEdited = false;
let completionWasTracked = false;

for (let index = 0; index < 47; index += 1) packageContents.append(document.createElement("i"));
const packageCells = [...packageContents.children];

function setPackedCount(count) {
  packageCount.textContent = count === 47 ? "47 skills inside" : `${count} / 47 packed`;
}

function transferGeometry() {
  const inletRect = packageInlet.getBoundingClientRect();
  const targetX = inletRect.left + inletRect.width / 2;
  const targetY = inletRect.top + inletRect.height / 2;
  return skillRows.map((row) => [...row.children].map((skill) => {
    const rect = skill.getBoundingClientRect();
    return {
      x: targetX - (rect.left + rect.width / 2),
      y: targetY - (rect.top + rect.height / 2)
    };
  }));
}

function buildHeroTimeline({ isDesktop }) {
  const geometry = transferGeometry();
  const timeline = gsap.timeline({
    repeat: -1,
    repeatDelay: 1.1,
    defaults: { ease: "power3.inOut" }
  });
  const initial = [...skillRows.flatMap((row) => [...row.children]), ...packageCells];

  gsap.set(scene, { autoAlpha: 1 });
  gsap.set(skillRows.flatMap((row) => [...row.children]), { x: 0, y: 0, scale: 1, autoAlpha: 1, transformOrigin: "center" });
  gsap.set(flood, { scaleY: 0.93, transformOrigin: "bottom" });
  gsap.set(funnel, { autoAlpha: 0.28, scaleX: 0.82, transformOrigin: "right center" });
  gsap.set(packageCells, { autoAlpha: 0.1, scale: 0.65, transformOrigin: "center" });
  gsap.set([filledKicker, oneEntry], { autoAlpha: 0, y: 8 });
  gsap.set([waitingKicker, basinLabel], { autoAlpha: 1, y: 0 });
  gsap.set(monoPackage, { x: 0, y: 0, scale: 1, rotation: 1 });
  setPackedCount(0);
  scene.dataset.animationStep = "flooded";

  timeline.addLabel("flooded", 0)
    .call(() => { scene.dataset.animationStep = "flooded"; setPackedCount(0); }, null, "flooded")
    .to({}, { duration: 1.8 });

  let packed = 0;
  skillRows.forEach((row, rowIndex) => {
    const skills = [...row.children];
    const start = packed;
    packed += skills.length;
    const packedAtRow = packed;
    const label = `transfer-${String(rowIndex + 1).padStart(2, "0")}`;
    const waterLevel = 0.93 - (packedAtRow / 47) * 0.875;

    timeline.addLabel(label)
      .call(() => { scene.dataset.animationStep = label; }, null, label)
      .to(funnel, { autoAlpha: 1, scaleX: 1, duration: 0.18, ease: "power2.out" }, label)
      .to(skills, {
        x: (index) => geometry[rowIndex][index].x,
        duration: 0.92,
        stagger: { each: 0.05, from: "end" },
        ease: "power2.in"
      }, label)
      .to(skills, {
        y: (index) => geometry[rowIndex][index].y,
        scale: 0.08,
        rotation: (index) => (index - 2) * -1.4,
        autoAlpha: 0,
        duration: 0.92,
        stagger: { each: 0.05, from: "end" },
        ease: "power4.in"
      }, label)
      .to(flood, { scaleY: waterLevel, duration: 1.02, ease: "power2.inOut" }, label)
      .to(packageCells.slice(start, packedAtRow), {
        autoAlpha: 0.78,
        scale: 1,
        duration: 0.24,
        stagger: 0.025,
        ease: "back.out(1.5)"
      }, `${label}+=0.76`)
      .call(() => { setPackedCount(packedAtRow); }, null, `${label}+=0.9`)
      .to(funnel, { autoAlpha: 0.55, scaleX: 0.9, duration: 0.16, ease: "power2.out" }, ">-0.08");
  });

  timeline.addLabel("packed")
    .call(() => { scene.dataset.animationStep = "packed"; setPackedCount(47); }, null, "packed")
    .to(funnel, { autoAlpha: 0, scaleX: 0.7, duration: 0.3 }, "packed")
    .to(waitingKicker, { autoAlpha: 0, y: -8, duration: 0.25 }, "packed")
    .to(filledKicker, { autoAlpha: 1, y: 0, duration: 0.3 }, "packed+=0.12")
    .to(basinLabel, { autoAlpha: 0, duration: 0.25 }, "packed")
    .to({}, { duration: 0.45 })
    .addLabel("settled")
    .call(() => { scene.dataset.animationStep = "settled"; }, null, "settled")
    .to(monoPackage, {
      y: isDesktop ? 150 : 54,
      scale: isDesktop ? 1.06 : 1.02,
      rotation: 0,
      duration: 0.8,
      ease: "back.out(1.25)"
    }, "settled")
    .to(oneEntry, { autoAlpha: 1, y: 0, duration: 0.4 }, "settled+=0.36")
    .to({}, { duration: 2.6 })
    .addLabel("reset")
    .call(() => { scene.dataset.animationStep = "reset"; }, null, "reset")
    .to(scene, { autoAlpha: 0, duration: 0.3, ease: "power2.in" }, "reset")
    .set(initial, { clearProps: "transform,opacity,visibility" })
    .set([flood, funnel, monoPackage, waitingKicker, filledKicker, oneEntry, basinLabel], { clearProps: "transform,opacity,visibility" })
    .call(() => { setPackedCount(0); scene.dataset.animationStep = "flooded"; })
    .to(scene, { autoAlpha: 1, duration: 0.42, ease: "power2.out" });

  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !document.hidden) timeline.resume();
    else timeline.pause();
  }, { threshold: 0.08 });
  const onVisibility = () => { document.hidden ? timeline.pause() : timeline.resume(); };
  observer.observe(scene);
  document.addEventListener("visibilitychange", onVisibility);

  window.__monoskillAnimation = {
    labels: Object.keys(timeline.labels),
    play: () => timeline.play(),
    seek: (label, offset = 0) => { timeline.pause().seek(timeline.labels[label] + offset, false); }
  };

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
  if (!context.conditions.reduceMotion) return buildHeroTimeline(context.conditions);

  gsap.set(skillRows, { autoAlpha: 0 });
  gsap.set(flood, { scaleY: 0.055, transformOrigin: "bottom" });
  gsap.set(funnel, { autoAlpha: 0 });
  gsap.set(packageCells, { autoAlpha: 0.78, scale: 1 });
  gsap.set([waitingKicker, basinLabel], { autoAlpha: 0 });
  gsap.set([filledKicker, oneEntry], { autoAlpha: 1, y: 0 });
  gsap.set(monoPackage, { y: context.conditions.isDesktop ? 150 : 54, scale: context.conditions.isDesktop ? 1.06 : 1.02, rotation: 0 });
  setPackedCount(47);
  scene.dataset.animationStep = "settled";
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

document.querySelector("#example-button").addEventListener("click", () => {
  sourceInput.value = "coreyhaines31/marketingskills";
  nameInput.value = "corey-marketing";
  nameWasEdited = true;
  render();
  nameWasEdited = false;
  sourceInput.focus();
});

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
