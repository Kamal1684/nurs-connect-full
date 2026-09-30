export function formatDate(date?: string | null | number | Date): string {
  if (!date) return 'N/A';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

export function formatTime(date?: string | null | number | Date): string {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function formatDateTime(date?: string | null | number | Date): string {
  if (!date) return 'N/A';
  const fd = formatDate(date);
  const ft = formatTime(date);
  return ft ? `${fd} at ${ft}` : fd;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatSalaryNumber(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

export type SalaryDisplayInfo = {
  primary: string;
  basisLabel: string | null;
  formattedFull: string;
  isDisclosed: boolean;
  periodText: string;
};

export function formatSalaryDisplay(job?: any): SalaryDisplayInfo {
  if (!job || typeof job !== 'object') {
    return {
      primary: 'Salary not disclosed',
      basisLabel: null,
      formattedFull: 'Salary not disclosed',
      isDisclosed: false,
      periodText: '/month',
    };
  }

  let minNum: number | null = null;
  let maxNum: number | null = null;

  if (typeof job.salary_min === 'number') minNum = job.salary_min;
  else if (typeof job.salary_min === 'string') {
    const parsed = parseFloat(job.salary_min);
    if (!isNaN(parsed)) minNum = parsed;
  } else if (job.salary_min && typeof job.salary_min === 'object') {
    minNum = typeof job.salary_min.amount === 'number' ? job.salary_min.amount : parseFloat(job.salary_min.amount) || null;
  }

  if (typeof job.salary_max === 'number') maxNum = job.salary_max;
  else if (typeof job.salary_max === 'string') {
    const parsed = parseFloat(job.salary_max);
    if (!isNaN(parsed)) maxNum = parsed;
  } else if (job.salary_max && typeof job.salary_max === 'object') {
    maxNum = typeof job.salary_max.amount === 'number' ? job.salary_max.amount : parseFloat(job.salary_max.amount) || null;
  }

  if (minNum === null && maxNum === null && job.salary) {
    if (typeof job.salary === 'number') {
      minNum = job.salary;
    } else if (typeof job.salary === 'string') {
      const match = job.salary.match(/(\d+[\d,]*)/g);
      if (match && match.length >= 2) {
        minNum = parseFloat(match[0].replace(/,/g, ''));
        maxNum = parseFloat(match[1].replace(/,/g, ''));
      } else if (match && match.length === 1) {
        minNum = parseFloat(match[0].replace(/,/g, ''));
      }
    }
  }

  const min = minNum != null && !isNaN(minNum) && minNum > 0 ? minNum : null;
  const max = maxNum != null && !isNaN(maxNum) && maxNum > 0 ? maxNum : null;
  const period = typeof job.salary_type === 'string' && job.salary_type.toLowerCase() === 'annual' ? '/year' : '/month';
  const basisMap: Record<string, string> = {
    ctc: 'CTC',
    gross: 'Gross',
    take_home: 'Take-home',
  };
  const basisKey = typeof job.salary_basis === 'string' ? job.salary_basis.toLowerCase() : '';
  const basisLabel = basisKey ? basisMap[basisKey] || basisKey.toUpperCase() : null;

  if (min !== null && max !== null) {
    if (min === max) {
      const primary = `${formatSalaryNumber(min)}${period}`;
      const formattedFull = `${primary}${basisLabel ? ` · ${basisLabel}` : ''}`;
      return { primary, basisLabel, formattedFull, isDisclosed: true, periodText: period };
    }
    const primary = `${formatSalaryNumber(min)} – ${formatSalaryNumber(max)}${period}`;
    const formattedFull = `${primary}${basisLabel ? ` · ${basisLabel}` : ''}`;
    return { primary, basisLabel, formattedFull, isDisclosed: true, periodText: period };
  }

  if (min !== null) {
    const primary = `${formatSalaryNumber(min)}+${period}`;
    const formattedFull = `${primary}${basisLabel ? ` · ${basisLabel}` : ''}`;
    return { primary, basisLabel, formattedFull, isDisclosed: true, periodText: period };
  }

  if (max !== null) {
    const primary = `Up to ${formatSalaryNumber(max)}${period}`;
    const formattedFull = `${primary}${basisLabel ? ` · ${basisLabel}` : ''}`;
    return { primary, basisLabel, formattedFull, isDisclosed: true, periodText: period };
  }

  return {
    primary: 'Salary not disclosed',
    basisLabel: null,
    formattedFull: 'Salary not disclosed',
    isDisclosed: false,
    periodText: period,
  };
}

export type ShiftDisplayInfo = {
  shift: string | null;
  summaryText: string;
  hasDetails: boolean;
};

export function formatShiftDisplay(job?: any): ShiftDisplayInfo {
  if (!job || typeof job !== 'object') {
    return {
      shift: null,
      summaryText: 'Shift schedule not specified',
      hasDetails: false,
    };
  }

  let shiftStr: string | null = null;
  if (typeof job.shift === 'string' && job.shift.trim()) {
    shiftStr = job.shift.trim();
  } else if (Array.isArray(job.shift)) {
    shiftStr = job.shift.map((s: any) => typeof s === 'object' ? (s.name || s.shift || '') : String(s)).filter(Boolean).join(', ') || null;
  } else if (job.shift && typeof job.shift === 'object') {
    shiftStr = job.shift.shift || job.shift.shift_type || job.shift.name || job.shift.label || null;
  }

  const summaryText = shiftStr ? `Shift: ${shiftStr}` : 'Shift schedule not specified';

  return {
    shift: shiftStr,
    summaryText,
    hasDetails: Boolean(shiftStr),
  };
}

export function normalizeJob<T extends { job_description?: string | null; last_date_to_apply?: string | null; [key: string]: any }>(
  rawJob: T | null | undefined
): T {
  if (!rawJob || typeof rawJob !== 'object') return rawJob as unknown as T;
  const job = { ...rawJob };

  let meta: Record<string, any> = {};
  if (job.job_description && typeof job.job_description === 'string' && job.job_description.includes('<!--NC_META:')) {
    try {
      const match = job.job_description.match(/<!--NC_META:([\s\S]*?)-->/);
      if (match && match[1]) {
        meta = JSON.parse(match[1]);
        job.job_description = job.job_description.replace(/<!--NC_META:[\s\S]*?-->/g, '').trim();
      }
    } catch (e) {
      console.warn('Failed to parse job metadata:', e);
    }
  }

  const rawShift = (job as any).shift || meta.shift;
  let cleanShift = 'Rotational';
  if (typeof rawShift === 'string') {
    cleanShift = rawShift;
  } else if (Array.isArray(rawShift)) {
    cleanShift = rawShift.map((s: any) => typeof s === 'object' ? (s.name || s.shift || '') : String(s)).filter(Boolean).join(', ') || 'Rotational';
  } else if (rawShift && typeof rawShift === 'object') {
    cleanShift = rawShift.shift || rawShift.shift_type || rawShift.name || 'Rotational';
  }

  return {
    ...job,
    job_title: typeof job.job_title === 'string' ? job.job_title : job.job_title ? String(job.job_title) : 'Untitled Job',
    department: typeof job.department === 'string' ? job.department : Array.isArray(job.department) ? job.department.join(', ') : job.department ? String(job.department) : 'General',
    location: typeof job.location === 'string' ? job.location : job.location ? String(job.location) : '',
    last_date_to_apply: job.last_date_to_apply || meta.last_date_to_apply || null,
    salary_type: typeof (job as any).salary_type === 'string' ? (job as any).salary_type : meta.salary_type || 'monthly',
    salary_basis: typeof (job as any).salary_basis === 'string' ? (job as any).salary_basis : meta.salary_basis || 'ctc',
    shift: cleanShift,
    meals_provided: (job as any).meals_provided !== undefined ? Boolean((job as any).meals_provided) : meta.meals_provided ?? false,
    overtime_available: (job as any).overtime_available !== undefined ? Boolean((job as any).overtime_available) : meta.overtime_available ?? false,
    joining_bonus_available: (job as any).joining_bonus_available !== undefined ? Boolean((job as any).joining_bonus_available) : meta.joining_bonus_available ?? false,
    joining_bonus_amount: typeof (job as any).joining_bonus_amount === 'number' ? (job as any).joining_bonus_amount : typeof (job as any).joining_bonus_amount === 'string' ? parseFloat((job as any).joining_bonus_amount) : meta.joining_bonus_amount ?? null,
  };
}

export function encodeJobDescription(
  description: string | null | undefined,
  meta: Record<string, any>
): string {
  const cleanDesc = (description || '').replace(/<!--NC_META:[\s\S]*?-->/g, '').trim();
  const metaObj: Record<string, any> = {};
  if (meta.last_date_to_apply) metaObj.last_date_to_apply = meta.last_date_to_apply;
  if (meta.salary_type) metaObj.salary_type = meta.salary_type;
  if (meta.salary_basis) metaObj.salary_basis = meta.salary_basis;
  if (meta.shift) metaObj.shift = meta.shift;
  if (meta.meals_provided !== undefined) metaObj.meals_provided = meta.meals_provided;
  if (meta.overtime_available !== undefined) metaObj.overtime_available = meta.overtime_available;
  if (meta.joining_bonus_available !== undefined) metaObj.joining_bonus_available = meta.joining_bonus_available;
  if (meta.joining_bonus_amount !== undefined) metaObj.joining_bonus_amount = meta.joining_bonus_amount;

  if (Object.keys(metaObj).length === 0) return cleanDesc;
  return `${cleanDesc}\n\n<!--NC_META:${JSON.stringify(metaObj)}-->`;
}

export function isJobExpired(lastDateToApply?: string | null): boolean {
  if (!lastDateToApply) return false;
  try {
    const today = new Date().toISOString().split('T')[0];
    const deadlineDate = lastDateToApply.split('T')[0];
    return deadlineDate < today;
  } catch {
    return false;
  }
}

export type BenefitBadge = {
  id: string;
  label: string;
  icon: string;
  fullLabel: string;
};

export function getJobBenefitBadges(job?: {
  accommodation_available?: boolean | null;
  meals_provided?: boolean | null;
  overtime_available?: boolean | null;
  joining_bonus_available?: boolean | null;
  joining_bonus_amount?: number | null;
} | null): BenefitBadge[] {
  if (!job || typeof job !== 'object') return [];
  const badges: BenefitBadge[] = [];

  if (job.accommodation_available === true) {
    badges.push({
      id: 'accommodation',
      label: 'Accommodation',
      icon: '🏠',
      fullLabel: '🏠 Accommodation Provided',
    });
  }

  if (job.meals_provided === true) {
    badges.push({
      id: 'meals',
      label: 'Meals Provided',
      icon: '🍱',
      fullLabel: '🍱 Meals Provided',
    });
  }

  if (job.overtime_available === true) {
    badges.push({
      id: 'overtime',
      label: 'Overtime Available',
      icon: '⏱',
      fullLabel: '⏱ Overtime Pay Available',
    });
  }

  if (job.joining_bonus_available === true) {
    const rawAmt = job.joining_bonus_amount;
    const num = typeof rawAmt === 'number' ? rawAmt : typeof rawAmt === 'string' ? parseFloat(rawAmt) : null;
    const amountStr =
      num && !isNaN(num) && num > 0
        ? `₹${num.toLocaleString('en-IN')}`
        : null;
    const label = amountStr ? `${amountStr} Bonus` : 'Joining Bonus';
    badges.push({
      id: 'joining_bonus',
      label,
      icon: '🎁',
      fullLabel: `🎁 ${amountStr ? `${amountStr} ` : ''}Joining Bonus`,
    });
  }

  return badges;
}

export function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 30) return formatDate(dateStr);
  if (diffDay > 1) return `Posted ${diffDay}d ago`;
  if (diffDay === 1) return 'Posted yesterday';
  if (diffHour > 0) return `Posted ${diffHour}h ago`;
  if (diffMin > 0) return `Posted ${diffMin}m ago`;
  return 'Posted just now';
}

export function timeUntil(date: string): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = target.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffHours / 24);

  if (diffMs < 0) return 'Started';
  if (diffHours < 1) return '< 1 hour';
  if (diffHours < 24) return `${diffHours}h away`;
  if (diffDays === 1) return 'Tomorrow';
  return `${diffDays} days away`;
}

export function shiftDurationHours(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.round((e - s) / (1000 * 60 * 60));
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
