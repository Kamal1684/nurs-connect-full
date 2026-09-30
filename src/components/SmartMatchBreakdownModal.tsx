import { Zap, CheckCircle2, ShieldCheck, HelpCircle, AlertCircle } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import type { SmartMatchResult } from '@/lib/matching';

interface SmartMatchBreakdownModalProps {
  match: SmartMatchResult;
  jobTitle?: string;
  candidateName?: string;
  onClose: () => void;
}

export function SmartMatchBreakdownModal({
  match,
  jobTitle,
  candidateName,
  onClose,
}: SmartMatchBreakdownModalProps) {
  const { breakdown, score, tierLabel, matchingHighlights, mismatchNotes, activeWeightTotal } = match;

  const factors = [
    { key: 'specialty', ...breakdown.specialty },
    { key: 'experience', ...breakdown.experience },
    { key: 'location', ...breakdown.location },
    { key: 'shift', ...breakdown.shift },
    { key: 'salary', ...breakdown.salary },
  ];

  return (
    <Modal
      onClose={onClose}
      title="Smart Match — Transparent Scoring Breakdown"
      size="lg"
    >
      <div className="space-y-5">
        {/* Header summary banner */}
        <div className="rounded-xl bg-[#082F63] p-4 text-white shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-300 backdrop-blur-xs">
              <Zap className="h-6 w-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black">{score}% Match</span>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-slate-100">
                  {tierLabel}
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-0.5">
                {candidateName ? `Candidate: ${candidateName}` : ''}
                {candidateName && jobTitle ? ' • ' : ''}
                {jobTitle ? `Job: ${jobTitle}` : 'Calculated against verified profile criteria'}
              </p>
            </div>
          </div>

          <div className="text-right sm:border-l sm:border-white/10 sm:pl-4">
            <div className="text-xs text-slate-300">Scoring Formula</div>
            <div className="text-sm font-semibold text-white flex items-center gap-1">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> 5-Pillar Normalized
            </div>
          </div>
        </div>

        {/* Why this matches you / Candidate highlights */}
        <div className="space-y-2">
          {matchingHighlights && matchingHighlights.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" /> Positive Match Criteria
              </h4>
              <div className="grid sm:grid-cols-2 gap-2">
                {matchingHighlights.map((reason, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-emerald-800 font-medium">
                    <span className="text-emerald-600 font-bold shrink-0">✓</span>
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mismatchNotes && mismatchNotes.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 mb-2">
                <AlertCircle className="h-4 w-4 text-slate-500" /> Criteria Notes & Variations
              </h4>
              <div className="space-y-1.5">
                {mismatchNotes.map((note, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="text-slate-400 font-bold shrink-0">○</span>
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Detailed Breakdown of 5 Pillars */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              5-Pillar Weighting & Earned Score
            </h4>
            {activeWeightTotal < 100 && (
              <span className="text-[11px] text-slate-500 italic">
                (Score dynamically normalized for missing optional fields)
              </span>
            )}
          </div>

          <div className="space-y-3">
            {factors.map((factor) => {
              const percent = factor.max > 0 ? Math.round((factor.score / factor.max) * 100) : 0;
              return (
                <div
                  key={factor.key}
                  className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-slate-900">
                      {factor.label}
                    </span>
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {factor.score} / {factor.max} pts ({percent}%)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden mb-1.5">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        percent >= 85
                          ? 'bg-emerald-600'
                          : percent >= 60
                          ? 'bg-blue-600'
                          : percent >= 30
                          ? 'bg-amber-500'
                          : 'bg-slate-400'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <p className="text-xs text-slate-600">
                    {factor.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Note on Eligibility */}
        <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <HelpCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <p>
            Smart Match is a transparent matching algorithm. Clinical verification, nursing registration compliance, and hospital credentialing remain prerequisite before hiring confirmation.
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="primary" onClick={onClose}>
            Close Breakdown
          </Button>
        </div>
      </div>
    </Modal>
  );
}
