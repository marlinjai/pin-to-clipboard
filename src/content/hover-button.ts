export type ButtonState = "idle" | "loading" | "ok" | "error";

export interface ButtonHandle {
  setState(s: ButtonState): void;
}

const ATTR = "data-ptc-bound";
const STYLE_ID = "ptc-style";

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    [data-ptc-host]{position:relative;}
    button[data-ptc="copy"]{position:absolute;left:8px;bottom:8px;width:36px;height:36px;border-radius:50%;border:0;background:rgba(0,0,0,.7);color:#fff;cursor:pointer;opacity:0;transition:opacity .15s;z-index:2147483600;display:grid;place-items:center;font-size:16px;}
    button[data-ptc="copy"]:focus-visible{outline:2px solid #fff;outline-offset:2px;opacity:1;}
    [data-ptc-host]:hover button[data-ptc="copy"],button[data-ptc="copy"][data-state="loading"],button[data-ptc="copy"][data-state="ok"],button[data-ptc="copy"][data-state="error"]{opacity:1;}
    button[data-ptc="copy"][data-state="ok"]{background:#1c8c3a;}
    button[data-ptc="copy"][data-state="error"]{background:#a32424;}
  `;
  document.head.appendChild(s);
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
  btn.textContent = "⧉";
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
