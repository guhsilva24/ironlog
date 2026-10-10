/**
 * Utilitários para manipulação de datas no fuso horário do dispositivo (não UTC).
 */

export function getTodayLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftDateString(dateStr: string, deltaDays: number): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const target = new Date(year, month, day + deltaDays);
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, '0');
    const d = String(target.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return dateStr;
  }
}

export function formatDateWithWeekday(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const dateObj = new Date(year, month, day);

    const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
      .format(dateObj)
      .replace('.', '')
      .toLowerCase();

    const dd = String(day).padStart(2, '0');
    const mm = String(month + 1).padStart(2, '0');
    return `${weekday}, ${dd}/${mm}/${year}`;
  } catch {
    return dateStr;
  }
}

export function formatDayDisplay(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const day = parts[2];
    const month = parts[1];
    return `${day}/${month}`;
  } catch {
    return dateStr;
  }
}

export function getMonthYearLabel(year: number, monthIndex: number): string {
  const dateObj = new Date(year, monthIndex, 1);
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(dateObj);
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${capitalized} de ${year}`;
}

export function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Retorna o índice do primeiro dia do mês (0 = Segunda, ..., 6 = Domingo).
 */
export function getFirstWeekdayIndex(year: number, monthIndex: number): number {
  const sundayBased = new Date(year, monthIndex, 1).getDay(); // 0 = Domingo, 1 = Segunda, ...
  return sundayBased === 0 ? 6 : sundayBased - 1;
}
