import type { APIRoute } from "astro";
import { handleSubscribe } from "../../lib/subscribe";

export const prerender = false;

export const POST: APIRoute = ({ request, locals }) =>
  // runtime? y no runtime: si el adaptador no inyectó el runtime, el acceso directo lanzaría
  // un TypeError antes de entrar a handleSubscribe y el cliente recibiría un 500 sin cuerpo,
  // en vez del server_misconfigured documentado (CR #4, H4).
  handleSubscribe(request, locals.runtime?.env);
