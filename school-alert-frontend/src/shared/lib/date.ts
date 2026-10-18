/**
 * Fecha local en formato ISO `YYYY-MM-DD`.
 *
 * No usar `new Date().toISOString().slice(0, 10)`: devuelve la fecha en UTC y,
 * en Ecuador (UTC-5), a partir de las 19:00 produce el día siguiente.
 */
export function localDateIso(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
