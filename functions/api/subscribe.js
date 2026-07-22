const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { email, turnstileToken } = body || {};

  if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_email" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = typeof turnstileToken === "string" ? turnstileToken.trim() : "";
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: "missing_token" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!env.TURNSTILE_SECRET) {
    console.error("subscribe: TURNSTILE_SECRET binding is not configured");
    return new Response(
      JSON.stringify({ ok: false, error: "server_misconfigured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const formData = new FormData();
    formData.append("secret", env.TURNSTILE_SECRET);
    formData.append("response", token);

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      },
    );

    const outcome = await res.json();
    if (!outcome || !outcome.success) {
      return new Response(
        JSON.stringify({ ok: false, error: "captcha_failed" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    await env.SUBSCRIBERS.put(
      normalizedEmail,
      JSON.stringify({
        subscribed_at: new Date().toISOString(),
        source: "landing",
      }),
    );

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("subscribe: upstream failure", err);
    return new Response(
      JSON.stringify({ ok: false, error: "upstream_error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
