import type { APIRoute } from "astro";
import { handleEvent } from "../../lib/event";

export const prerender = false;

export const POST: APIRoute = ({ request }) => handleEvent(request);

// Cualquier otro método: 405 explícito, no el 404 por defecto.
export const ALL: APIRoute = () =>
  new Response(null, { status: 405, headers: { Allow: "POST" } });
