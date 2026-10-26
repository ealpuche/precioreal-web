// Google Analytics 4 (#64). D1 (`precioreal-events`) sigue siendo la fuente de verdad de
// búsquedas y salidas a tienda; GA4 aporta adquisición, sesiones y, enlazado con Search
// Console, qué búsquedas de Google traen tráfico. Los clics de Telegram y del feed pasan
// por /ir/ con un redirect del servidor: nunca cargan página y GA4 no los ve.

// Forma de un ID de medición GA4. El valor viene de una variable de entorno y se interpola
// en un <script>: cualquier cosa fuera de este charset se rechaza en vez de escaparse.
const GA_ID_RE = /^G-[A-Z0-9]{4,16}$/;

export function gaMeasurementId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  return GA_ID_RE.test(id) ? id : null;
}

// Sin Google Signals ni personalización de anuncios: el sitio no hace remarketing y el
// aviso de /datos dice que la medición no se usa para anuncios.
export const GA_CONFIG = {
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
} as const;

// Script de arranque de gtag. Solo recibe un ID ya validado por gaMeasurementId, y aun así
// se serializa con JSON.stringify para que nunca se interpole texto crudo en el <script>.
export function gaInitScript(id: string): string {
  return [
    "window.dataLayer=window.dataLayer||[];",
    "window.gtag=function(){window.dataLayer.push(arguments);};",
    'window.gtag("js",new Date());',
    `window.gtag("config",${JSON.stringify(id)},${JSON.stringify(GA_CONFIG)});`,
  ].join("");
}

type Gtag = (...args: unknown[]) => void;

// Manda un evento a GA4 si gtag está cargado (solo en Production con el ID configurado).
// Nunca lanza: un bloqueador de contenido o un fallo de gtag no debe afectar a D1.
export function enviarAGa(
  evento: string,
  props: Record<string, string | number>,
): void {
  try {
    const gtag = (globalThis as { gtag?: unknown }).gtag;
    if (typeof gtag === "function") (gtag as Gtag)("event", evento, props);
  } catch {
    // Sin efecto: GA4 es complementario.
  }
}
