import { useState } from 'react';
import { Zap, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateSmartMatch, type SmartMatchResult } from '@/lib/matching';
import { SmartMatchBreakdownModal } from './SmartMatchBreakdownModal';

interface SmartMatchBadgeProps {
  match?: SmartMatchResult | null;
  score?: number;
  breakdown?: any;
  size?: 'sm' | 'md' | 'lg';
  showDetailsOnClick?: boolean;
  jobTitle?: string;
  candidateName?: string;
  className?: string;
}

export function SmartMatchBadge({
  match,
  score,
  breakdown,
  size = 'md',
  showDetailsOnClick = true,
  jobTitle,
  candidateName,
  className,
}: SmartMatchBadgeProps) {
  const [showModal, setShowModal] = useState(false);

  // Derive match result
  const resolvedMatch: SmartMatchResult = match || (breakdown && typeof breakdown.total === 'number'
    ? {
        score: breakdown.total,
        total: breakdown.total,
        isCalculable: true,
        isProfileReady: true,
        tier: (breakdown.total >= 90 ? 'exceptional' : breakdown.total >= 80 ? 'great' : breakdown.total >= 70 ? 'good' : 'moderate') as SmartMatchResult['tier'],
        tierLabel: breakdown.total >= 90 ? 'Top Match' : breakdown.total >= 80 ? 'Great Match' : 'Good Match',
        badgeColor: (breakdown.total >= 90 ? 'emerald' : breakdown.total >= 80 ? 'teal' : 'blue') as SmartMatchResult['badgeColor'],
        activeWeightTotal: 100,
        breakdown: {
          specialty: { score: breakdown.specialty?.score ?? 28, max: 30, weight: 30, label: 'Specialty / Dept (30%)', detail: breakdown.specialty?.detail || 'Clinical Department Alignment', matched: true, isAvailable: true },
          experience: { score: breakdown.experience?.score ?? 18, max: 20, weight: 20, label: 'Experience (20%)', detail: breakdown.experience?.detail || 'Clinical Experience Requirement', matched: true, isAvailable: true },
          location: { score: breakdown.location?.score ?? 18, max: 20, weight: 20, label: 'Preferred Location (20%)', detail: breakdown.location?.detail || 'Location Compatibility', matched: true, isAvailable: true },
          shift: { score: breakdown.shift?.score ?? 15, max: 15, weight: 15, label: 'Preferred Shift (15%)', detail: breakdown.shift?.detail || 'Shift Preference Alignment', matched: true, isAvailable: true },
          salary: { score: breakdown.salary?.score ?? 14, max: 15, weight: 15, label: 'Salary Expectation (15%)', detail: breakdown.salary?.detail || 'Compensation Alignment', matched: true, isAvailable: true },
        },
        reasons: [],
        matchReasons: breakdown.matchReasons || ['Specialty Alignment', 'Experience Requirement Met'],
        matchingHighlights: breakdown.matchingHighlights || ['Specialty Alignment', 'Experience Requirement Met'],
        mismatchNotes: breakdown.mismatchNotes || [],
      }
    : typeof score === 'number'
    ? calculateSmartMatch({ job_title: jobTitle }, { profile: { full_name: candidateName } })
    : calculateSmartMatch({}, {}));

  const displayScore = typeof score === 'number' ? score : resolvedMatch.score;
  const isHighMatch = displayScore >= 80;
  const isGoodMatch = displayScore >= 70;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          if (showDetailsOnClick) {
            e.stopPropagation();
            setShowModal(true);
          }
        }}
        className={cn(
          'inline-flex items-center font-bold tracking-tight rounded-full transition-all duration-150 select-none shadow-2xs cursor-pointer',
          // Brand #082F63 styling with high-contrast accenting
          'bg-[#082F63] text-white border border-[#082F63]/30',
          'hover:bg-[#0c3d7e] hover:shadow-xs active:scale-95',
          sizeClasses[size],
          className
        )}
        title="Click to view transparent Smart Match breakdown"
      >
        <Zap
          className={cn(
            iconSizes[size],
            'fill-current',
            isHighMatch ? 'text-amber-300 animate-pulse' : isGoodMatch ? 'text-cyan-300' : 'text-blue-300'
          )}
        />
        <span className="font-semibold">{displayScore}%</span>
        <span className="font-medium text-slate-200 opacity-90">Smart Match</span>
        {showDetailsOnClick && (
          <Info className={cn('opacity-60 hover:opacity-100 ml-0.5', iconSizes[size])} />
        )}
      </button>

      {showModal && (
        <SmartMatchBreakdownModal
          match={resolvedMatch}
          jobTitle={jobTitle}
          candidateName={candidateName}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

