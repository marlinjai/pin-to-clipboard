export type ButtonState = "idle" | "loading" | "ok" | "error";

export interface ButtonHandle {
  setState(s: ButtonState): void;
}

const ATTR = "data-ptc-bound";
const STYLE_ID = "ptc-style";

const ICONS: Record<"copy" | "loading" | "ok" | "error", string> = {
  copy: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  loading: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke-opacity="0.3"/><path d="M21 12a9 9 0 0 0-9-9"/></svg>`,
  ok: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
  error: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`,
};

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    [data-ptc-host]{position:relative;}
    button[data-ptc="copy"]{
      position:absolute;left:10px;bottom:10px;
      width:40px;height:40px;border-radius:50%;
      border:0;padding:0;cursor:pointer;
      background:#E60023;color:#fff;
      box-shadow:0 2px 8px rgba(0,0,0,.18);
      opacity:0;transform:translateY(4px);
      transition:opacity .12s ease,transform .12s ease,background .12s ease;
      display:grid;place-items:center;
      z-index:2147483600;
      font:14px/1 -apple-system,system-ui,sans-serif;
    }
    [data-ptc-host]:hover button[data-ptc="copy"],
    button[data-ptc="copy"]:focus-visible,
    button[data-ptc="copy"][data-state="loading"],
    button[data-ptc="copy"][data-state="ok"],
    button[data-ptc="copy"][data-state="error"]{
      opacity:1;transform:translateY(0);
    }
    button[data-ptc="copy"]:hover{background:#AD081B;}
    button[data-ptc="copy"]:focus-visible{outline:2px solid #fff;outline-offset:2px;}
    button[data-ptc="copy"][data-state="ok"]{background:#AD081B;}
    button[data-ptc="copy"][data-state="error"]{background:#444;}
    button[data-ptc="copy"] [data-icon]{display:none;line-height:0;}
    button[data-ptc="copy"][data-state="idle"] [data-icon="copy"],
    button[data-ptc="copy"][data-state="loading"] [data-icon="loading"],
    button[data-ptc="copy"][data-state="ok"] [data-icon="ok"],
    button[data-ptc="copy"][data-state="error"] [data-icon="error"]{display:block;}
    button[data-ptc="copy"][data-state="loading"] [data-icon="loading"]{
      animation:ptc-spin .8s linear infinite;transform-origin:50% 50%;
    }
    @keyframes ptc-spin{to{transform:rotate(360deg);}}
  `;
  document.head.appendChild(s);
}

function buildIconHosts(): string {
  return (
    `<span data-icon="copy">${ICONS.copy}</span>` +
    `<span data-icon="loading">${ICONS.loading}</span>` +
    `<span data-icon="ok">${ICONS.ok}</span>` +
    `<span data-icon="error">${ICONS.error}</span>`
  );
}

export function attachHoverButton(
  card: HTMLElement,
  onClick: (card: HTMLElement) => void
): ButtonHandle {
  ensureStyle();
  if (card.getAttribute(ATTR)) {
    const existing = card.querySelector<HTMLButtonElement>('button[data-ptc="copy"]')!;
    return { setState: (s) => (existing.dataset.state = s) };
  }
  card.setAttribute(ATTR, "1");
  card.setAttribute("data-ptc-host", "1");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.ptc = "copy";
  btn.dataset.state = "idle";
  btn.setAttribute("aria-label", "Copy image to clipboard");
  btn.innerHTML = buildIconHosts();
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(card);
  });
  card.appendChild(btn);
  return {
    setState: (s) => {
      btn.dataset.state = s;
    },
  };
}
