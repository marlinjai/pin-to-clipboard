export type ToastKind = "ok" | "error" | "info";

// Pinterest-style toast: dark pill, white text, centered near the bottom.
// All kinds share the same look; the `data-ptc-toast` attribute carries the
// kind for tests and any future per-kind styling.
export function showToast(message: string, kind: ToastKind = "info", durationMs = 1800) {
  const existing = document.querySelector("[data-ptc-toast]");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.setAttribute("data-ptc-toast", kind);
  el.setAttribute("role", kind === "error" ? "alert" : "status");
  el.textContent = message;
  Object.assign(el.style, {
    position: "fixed",
    bottom: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#111",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: "10px",
    boxShadow: "0 6px 20px rgba(0,0,0,.25)",
    font: "14px/1.3 -apple-system, system-ui, sans-serif",
    zIndex: "2147483647",
    pointerEvents: "none",
    maxWidth: "min(560px, calc(100vw - 32px))",
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), durationMs);
}
