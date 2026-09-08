# ADR-001: Adopción de Astro + TypeScript para la web de PrecioReal

## Estado

Aceptado

## Fecha

2026-09-07

## Contexto

PrecioReal.mx inició con una landing page estática en HTML/CSS/JS y una Cloudflare Pages Function para la captura de correos. Para la Fase 1 (UI de hardware: buscador y ficha con historial de Cyberpuerta, Refs #3) se requiere una base técnica escalable con tipado estricto pero sin el peso ni la sobrecarga de hidratación de un framework tradicional de SPA.

## Decisión

Adoptar **Astro** con el adaptador de Cloudflare (`@astrojs/cloudflare`) y TypeScript:

1. **Sin framework de UI** en esta fase inicial: Astro genera HTML puro por defecto (zero-JS overhead salvo interactividad puntual requerida).
2. **Estático por defecto**: las rutas se prerenderizan como estáticas a menos que declaren `export const prerender = false;` (como los endpoints de API que interactúan con Cloudflare KV y validación Turnstile).
3. **Bindings de Cloudflare Pages**: las variables de entorno y KV namespaces se acceden mediante `locals.runtime.env`.
4. **TypeScript**: configuración estricta (`astro/tsconfigs/strict`) para garantizar seguridad de tipos en la lógica de cliente y endpoints.

## Consecuencias

- Migración 1:1 de la landing existente sin cambios visuales ni de funcionalidad observables.
- Compatibilidad nativa con Cloudflare Pages y compatibilidad local mediante `wrangler` / Astro dev server.
- Toolchain unificado de linting, formateo y pruebas con Prettier, Astro check y Vitest.
