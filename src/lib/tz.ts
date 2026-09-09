/**
 * El runtime del edge corre en UTC: sin fijar la zona, una observación de las 03:00Z se
 * muestra con la fecha del día siguiente al que fue en México (CR PR #7, H7). Vive en su
 * propio módulo porque lo usan tanto `format.ts` como el frontmatter de `PriceChart.astro`
 * (CR PR #7 ronda final, H3).
 */
export const TZ = "America/Mexico_City";
