export type ToastKind = "ok" | "error" | "info";

export function showToast(message: string, kind: ToastKind = "info", durationMs = 1800) {
  const existing = document.querySelector("[data-ptc-toast]");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.setAttribute("data-ptc-toast", kind);
  el.textContent = message;
  Object.assign(el.style, {
    position: "fixed",
    bottom: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    background: kind === "error" ? "#a32424" : kind === "ok" ? "#1c8c3a" : "#333",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: "8px",
    font: "13px/1.4 -apple-system, system-ui, sans-serif",
    zIndex: "2147483647",
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), durationMs);
}
