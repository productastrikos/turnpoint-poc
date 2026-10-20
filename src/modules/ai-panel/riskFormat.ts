import { dayToDate, shortDate } from '../../mocks/_gen';

export const pct = (p: number) => `${Math.round(p * 100)}%`;
/** TA day (possibly fractional) to "06 Sep". */
export const dayLabel = (day: number) => shortDate(dayToDate(Math.round(day)));
export const riskTone = (p: number) => (p >= 0.5 ? 'crit' : p >= 0.3 ? 'warn' : 'good') as 'crit' | 'warn' | 'good';
