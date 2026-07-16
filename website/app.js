import {
  inferSkillName,
  makeCommand,
  makePrompt,
  normalizeSkillName,
  validateSkillName,
  validateSource
} from "./generator.js";
import { collectAnalytics } from "./analytics.js";

const form = document.querySelector("#generator-form");
const sourceInput = document.querySelector("#source");
const nameInput = document.querySelector("#name");
const sourceMessage = document.querySelector("#source-message");
const nameMessage = document.querySelector("#name-message");
const commandOutput = document.querySelector("#command-output");
const promptOutput = document.querySelector("#prompt-output");
const status = document.querySelector("#copy-status");
const scene = document.querySelector(".convergence");
let nameWasEdited = false;
let completionWasTracked = false;

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

function render() {
  const sourceResult = validateSource(sourceInput.value);
  if (!nameWasEdited && sourceResult.valid) nameInput.value = inferSkillName(sourceResult.value);
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
    commandOutput.textContent = "npx monoskill build <source> --name <name>";
    promptOutput.textContent = "Your AI-ready installation prompt will appear here.";
    completionWasTracked = false;
    return;
  }

  commandOutput.textContent = makeCommand(sourceResult.value, nameInput.value);
  promptOutput.textContent = makePrompt(sourceResult.value, nameInput.value);
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
