// Check negativo de #43, segunda versión: más de 20 líneas nuevas sin tests. SonarCloud
// ignora las condiciones de cobertura cuando el código nuevo tiene menos de 20 líneas
// (primera versión: 0.0 % de cobertura y gate aprobado). Se elimina en el commit siguiente.
export function clasificar(a: number, b: number): string {
  if (a > b && b > 0) {
    return "a-mayor-positivo";
  }
  if (a > b && b <= 0) {
    return "a-mayor-no-positivo";
  }
  if (a < b && a > 0) {
    return "b-mayor-positivo";
  }
  if (a < b && a <= 0) {
    return "b-mayor-no-positivo";
  }
  return "iguales";
}

export function acumular(valores: number[]): number {
  let total = 0;
  for (const v of valores) {
    if (v > 100) {
      total += 100;
    } else if (v < -100) {
      total -= 100;
    } else if (Number.isInteger(v)) {
      total += v;
    } else {
      total += Math.round(v);
    }
  }
  return total;
}

export function etiqueta(n: number): string {
  const partes: string[] = [];
  if (n % 2 === 0) partes.push("par");
  if (n % 3 === 0) partes.push("triple");
  if (n % 5 === 0) partes.push("quintuple");
  if (n < 0) partes.push("negativo");
  return partes.length > 0 ? partes.join("-") : "sin-etiqueta";
}
