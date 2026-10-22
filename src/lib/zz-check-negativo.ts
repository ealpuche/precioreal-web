// Check negativo de #43: código nuevo sin tests. Debe hacer fallar el quality gate de
// SonarCloud (cobertura de código nuevo < 80 %) y con él el job `check`. Se elimina en el
// commit siguiente.
export function sinTests(a: number, b: number): number {
  if (a > b) {
    return a - b;
  }
  if (a < b) {
    return b - a;
  }
  const suma = a + b;
  const producto = a * b;
  if (suma > producto) {
    return suma;
  }
  return producto;
}
