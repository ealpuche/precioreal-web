import type { APIRoute } from "astro";
import { handleEvent } from "../../lib/event";

export const prerender = false;

export const POST: APIRoute = ({ request, locals }) =>
  // locals? y runtime sin desreferenciar: los tests invocan POST sin locals y el
  // adaptador puede no inyectar el runtime; storeEvent tolera undefined (#32).
  handleEvent(request, undefined, locals?.runtime);

// Cualquier otro método: 405 explícito, no el 404 por defecto.
export const ALL: APIRoute = () =>
  new Response(null, { status: 405, headers: { Allow: "POST" } });
