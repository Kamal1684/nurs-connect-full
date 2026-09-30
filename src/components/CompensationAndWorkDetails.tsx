import { type ReactNode } from 'react';
import {
  IndianRupee, Clock, Home, Utensils, Zap, Gift, ShieldCheck,
  Calendar, Info, CheckCircle2, XCircle, AlertCircle, Sparkles, Moon, Sun, RotateCw
} from 'lucide-react';
import type { Job } from '@/lib/supabase';
import {
  formatSalaryDisplay, formatShiftDisplay, getJobBenefitBadges, cn,
  type SalaryDisplayInfo, type ShiftDisplayInfo, type BenefitBadge
} from '@/lib/utils';
import { Badge } from '@/components/ui';

interface CompensationAndWorkDetailsProps {
  job: Partial<Job>;
  isVerifiedHospital?: boolean;
}

export function CompensationAndWorkDetailsSection({ job, isVerifiedHospital = false }: CompensationAndWorkDetailsProps) {
  const salaryInfo = formatSalaryDisplay(job);
  const shiftInfo = formatShiftDisplay(job);
  const benefitBadges = getJobBenefitBadges(job);

  const basisFullLabel: Record<string, string> = {
    ctc: 'Cost to Company (CTC)',
    gross: 'Gross Salary',
    take_home: 'In-Hand / Take-Home Salary',
  };

  const shiftIcon = () => {
    const s = (job.shift || '').toLowerCase();
    if (s.includes('night')) return <Moon className="h-4 w-4 text-indigo-600" />;
    if (s.includes('day')) return <Sun className="h-4 w-4 text-amber-600" />;
    return <RotateCw className="h-4 w-4 text-teal-600" />;
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <IndianRupee className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Compensation & Work Details
            </h4>
            <p className="text-xs text-slate-500">Transparent hospital-declared pay, shift schedules & benefits</p>
          </div>
        </div>
        {isVerifiedHospital && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
            <ShieldCheck className="h-3.5 w-3.5" /> Verified Hospital Disclosure
          </span>
        )}
      </div>

      <div className="grid gap-3.5 sm:grid-cols-3">
        {/* 1. COMPENSATION */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            <IndianRupee className="h-3.5 w-3.5 text-primary-600" />
            <span>Compensation</span>
          </div>

          <div className="space-y-2">
            <div>
              <div className="text-xs text-slate-400">Offered Salary</div>
              <div className="text-base font-extrabold text-slate-900">
                {salaryInfo.primary}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 block">Salary Type</span>
                <span className="font-semibold text-slate-700 capitalize">
                  {job.salary_type || 'Monthly'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Salary Basis</span>
                <span className="font-semibold text-slate-700">
                  {job.salary_basis ? (basisFullLabel[job.salary_basis] || job.salary_basis.toUpperCase()) : 'Declared Amount'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. SHIFT & SCHEDULE */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            <Clock className="h-3.5 w-3.5 text-indigo-600" />
            <span>Shift & Schedule</span>
          </div>

          <div className="space-y-2">
            <div>
              <div className="text-xs text-slate-400">Shift Type</div>
              <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                {shiftIcon()}
                <span>{job.shift || 'Rotational / General'}</span>
              </div>
            </div>

            <div className="pt-1 border-t border-slate-100 text-xs">
              <span className="text-slate-500">
                {job.shift ? `${job.shift} hospital shift schedule` : 'Standard hospital shift schedule'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. BENEFITS */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            <Gift className="h-3.5 w-3.5 text-emerald-600" />
            <span>Included Benefits</span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-600 flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5 text-slate-400" /> Accommodation:
              </span>
              <span className={`font-semibold ${job.accommodation_available ? 'text-emerald-700' : 'text-slate-400'}`}>
                {job.accommodation_available ? '✓ Provided' : 'Not provided'}
              </span>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-600 flex items-center gap-1.5">
                <Utensils className="h-3.5 w-3.5 text-slate-400" /> Meals:
              </span>
              <span className={`font-semibold ${job.meals_provided ? 'text-emerald-700' : 'text-slate-400'}`}>
                {job.meals_provided ? '✓ Provided' : 'Not provided'}
              </span>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-600 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400" /> Overtime Pay:
              </span>
              <span className={`font-semibold ${job.overtime_available ? 'text-emerald-700' : 'text-slate-400'}`}>
                {job.overtime_available ? '✓ Available' : 'Not available'}
              </span>
            </div>

            <div className="flex items-center justify-between py-0.5 border-t border-slate-100 pt-1">
              <span className="text-slate-600 flex items-center gap-1.5">
                <Gift className="h-3.5 w-3.5 text-amber-500" /> Joining Bonus:
              </span>
              <span className={`font-semibold ${job.joining_bonus_available ? 'text-amber-700' : 'text-slate-400'}`}>
                {job.joining_bonus_available
                  ? job.joining_bonus_amount
                    ? `₹${job.joining_bonus_amount.toLocaleString('en-IN')}`
                    : '✓ Available'
                  : 'None'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Benefits Badges preview */}
      {benefitBadges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-slate-500">Highlights:</span>
          {benefitBadges.map((badge) => (
            <span
              key={badge.id}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200/70"
            >
              <span>{badge.icon}</span>
              <span>{badge.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface BeforeYouApplyBannerProps {
  job: Partial<Job>;
}

export function BeforeYouApplyBanner({ job }: BeforeYouApplyBannerProps) {
  const salaryInfo = formatSalaryDisplay(job);
  const shiftInfo = formatShiftDisplay(job);
  const benefitBadges = getJobBenefitBadges(job);

  return (
    <div className="rounded-xl bg-gradient-to-br from-[#082F63] to-[#0A3B7D] p-4 text-white shadow-md">
      <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-300" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Before You Apply — Key Opportunity Facts
          </h4>
        </div>
        <span className="text-2xs text-slate-300 bg-white/10 px-2 py-0.5 rounded font-medium">
          Verified Details
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        {/* 1. Salary */}
        <div className="space-y-0.5">
          <div className="text-2xs text-slate-300 font-medium uppercase tracking-wider flex items-center gap-1">
            <IndianRupee className="h-3 w-3 text-emerald-400" /> Pay
          </div>
          <div className="font-extrabold text-white text-sm">
            {salaryInfo.primary}
          </div>
          {salaryInfo.basisLabel && (
            <div className="text-2xs text-slate-300">({salaryInfo.basisLabel})</div>
          )}
        </div>

        {/* 2. Shift */}
        <div className="space-y-0.5">
          <div className="text-2xs text-slate-300 font-medium uppercase tracking-wider flex items-center gap-1">
            <Clock className="h-3 w-3 text-indigo-300" /> Shift & Schedule
          </div>
          <div className="font-bold text-white">
            {job.shift || 'Rotational'}
          </div>
          <div className="text-2xs text-slate-300">
            {job.overtime_available ? 'Overtime pay available' : 'Standard schedule'}
          </div>
        </div>

        {/* 3. Benefits */}
        <div className="space-y-0.5">
          <div className="text-2xs text-slate-300 font-medium uppercase tracking-wider flex items-center gap-1">
            <Gift className="h-3 w-3 text-amber-300" /> Benefits
          </div>
          <div className="font-bold text-white">
            {benefitBadges.length > 0
              ? `${benefitBadges.length} included`
              : 'Standard benefits'}
          </div>
          <div className="text-2xs text-slate-300 truncate">
            {job.accommodation_available && job.meals_provided
              ? 'Stay + Meals'
              : job.accommodation_available
              ? 'Stay included'
              : job.joining_bonus_available
              ? 'Joining bonus'
              : 'Direct hospital role'}
          </div>
        </div>
      </div>
    </div>
  );
}

export function JobBenefitsBadgesRow({
  job,
  size = 'md',
  className,
}: {
  job: Partial<Job>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const badges = getJobBenefitBadges(job);
  if (badges.length === 0) return null;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-xs px-2.5 py-1',
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {badges.map((b) => (
        <span
          key={b.id}
          className={cn(
            'inline-flex items-center gap-1 rounded-md bg-emerald-50 font-semibold text-emerald-800 border border-emerald-200/80 transition-colors hover:bg-emerald-100',
            sizeClasses[size]
          )}
          title={b.fullLabel}
        >
          <span className={size === 'sm' ? 'text-[9px]' : 'text-2xs'}>{b.icon}</span>
          <span>{b.label}</span>
        </span>
      ))}
    </div>
  );
}
