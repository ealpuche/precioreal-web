import type { APIRoute } from "astro";
import { handleSubscribe } from "../../lib/subscribe";

export const prerender = false;

export const POST: APIRoute = ({ request, locals }) =>
  handleSubscribe(request, locals.runtime.env);
