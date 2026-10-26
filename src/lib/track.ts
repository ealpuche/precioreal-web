import { enviarAGa } from "./analytics";
import { validateEvent, type Evento } from "./event";

export function track(
  evento: Evento,
  props: Record<string, string | number>,
): boolean {
  try {
    const payload = validateEvent({ evento, props });
    if (!payload) return false;

    const body = JSON.stringify(payload);
    // Mismo evento validado a GA4 (#64). No lanza, así que no puede impedir el envío a D1.
    enviarAGa(payload.evento, payload.props);

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      if (navigator.sendBeacon("/api/event", body)) {
        return true;
      }
    }

    fetch("/api/event", {
      method: "POST",
      body,
      keepalive: true,
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
      },
    }).catch(() => {});

    return true;
  } catch {
    return false;
  }
}
