import { getSettings, setSettings } from "./storage";
import { Settings } from "../shared/types";

async function hydrate() {
  const s = await getSettings();
  for (const [name, value] of Object.entries(s) as [keyof Settings, string][]) {
    const el = document.querySelector<HTMLInputElement>(
      `input[name="${name}"][value="${value}"]`
    );
    if (el) el.checked = true;
  }
}

function wire() {
  document.querySelectorAll<HTMLInputElement>("input[type=radio]").forEach((el) => {
    el.addEventListener("change", () => {
      if (!el.checked) return;
      setSettings({ [el.name]: el.value } as Partial<Settings>);
    });
  });
}

hydrate().then(wire);
