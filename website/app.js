import {
  inferSkillName,
  makeCommand,
  makePrompt,
  normalizeSkillName,
  validateSkillName,
  validateSource
} from "./generator.js";
import { collectAnalytics } from "./analytics.js";

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
const skillField = scene.querySelector(".skill-field");
const pathLayer = scene.querySelector(".skill-paths");
const throat = scene.querySelector(".throat");
const monoPackage = scene.querySelector(".package");
const packageContents = scene.querySelector(".package-contents");
let nameWasEdited = false;
let completionWasTracked = false;

for (let index = 0; index < 47; index += 1) packageContents.append(document.createElement("i"));

let layoutFrame;
function layoutSkillTransfer() {
  window.cancelAnimationFrame(layoutFrame);
  layoutFrame = window.requestAnimationFrame(() => {
    const sceneRect = scene.getBoundingClientRect();
    const throatRect = throat.getBoundingClientRect();
    const packageRect = monoPackage.getBoundingClientRect();
    const fieldRect = skillField.getBoundingClientRect();
    const throatX = throatRect.left + throatRect.width / 2 - sceneRect.left;
    const throatY = throatRect.top + throatRect.height / 2 - sceneRect.top;
    const targetX = packageRect.left + packageRect.width * 0.34 - sceneRect.left;
    const targetY = packageRect.top + packageRect.height * 0.48 - sceneRect.top;
    const fieldX = fieldRect.left + fieldRect.width / 2 - sceneRect.left;
    const fieldY = fieldRect.top + fieldRect.height / 2 - sceneRect.top;
    skillField.style.setProperty("--field-tx", `${targetX - fieldX}px`);
    skillField.style.setProperty("--field-ty", `${targetY - fieldY}px`);
    pathLayer.replaceChildren();
    pathLayer.setAttribute("viewBox", `0 0 ${sceneRect.width} ${sceneRect.height}`);

    for (const skill of skillField.children) {
      const rect = skill.getBoundingClientRect();
      const startX = rect.left + rect.width / 2 - sceneRect.left;
      const startY = rect.top + rect.height / 2 - sceneRect.top;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const bendX = startX + (throatX - startX) * 0.62;
      path.setAttribute("d", `M ${startX} ${startY} C ${bendX} ${startY}, ${throatX - 32} ${throatY}, ${throatX} ${throatY} C ${throatX + 18} ${throatY}, ${targetX - 18} ${targetY}, ${targetX} ${targetY}`);
      pathLayer.append(path);
    }
  });
}

new ResizeObserver(layoutSkillTransfer).observe(scene);
layoutSkillTransfer();

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
