import React, { useEffect, useState, useMemo } from 'react';
import {
  ShieldCheck, CheckCircle2, Clock, Star, Users, Building2,
  MapPin, Stethoscope, BedDouble, Award, Check, AlertCircle,
  FileCheck, Shield, ExternalLink, HelpCircle
} from 'lucide-react';
import { supabase, type Hospital, type Job, type Profile, type NurseProfile } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';

// ============================================================================
// 1. VERIFIED HOSPITAL BADGE
// ============================================================================

export interface VerifiedHospitalBadgeProps {
  isVerified?: boolean | null;
  verificationStatus?: 'verified' | 'pending' | 'rejected' | string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showUnverifiedState?: boolean;
}

export function isHospitalVerified(hospital?: {
  verification_status?: string | null;
  is_verified?: boolean | null;
} | null): boolean {
  if (!hospital) return false;
  return hospital.verification_status === 'verified' || hospital.is_verified === true;
}

export function VerifiedHospitalBadge({
  isVerified,
  verificationStatus,
  size = 'sm',
  className,
  showUnverifiedState = false,
}: VerifiedHospitalBadgeProps) {
  const verified = isVerified === true || verificationStatus === 'verified';

  if (!verified) {
    if (!showUnverifiedState) return null;
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-slate-100 font-medium text-slate-600 border border-slate-200/80',
          size === 'xs' && 'px-1.5 py-0.5 text-[10px]',
          size === 'sm' && 'px-2 py-0.5 text-[11px]',
          size === 'md' && 'px-2.5 py-0.5 text-xs',
          size === 'lg' && 'px-3 py-1 text-xs',
          className
        )}
        title="Hospital verification in progress"
      >
        <Clock className={cn(size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3', 'text-slate-400')} />
        <span>Verification Pending</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-emerald-50 font-semibold text-emerald-800 border border-emerald-200/80 shadow-2xs transition-colors',
        size === 'xs' && 'px-1.5 py-0.5 text-[10px]',
        size === 'sm' && 'px-2 py-0.5 text-[11px]',
        size === 'md' && 'px-2.5 py-0.5 text-xs',
        size === 'lg' && 'px-3 py-1 text-xs',
        className
      )}
      title="Verified healthcare facility registered with NurseConnect"
    >
      <CheckCircle2 className={cn(size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3', 'text-emerald-600 shrink-0')} />
      <span>✓ Verified Hospital</span>
    </span>
  );
}

// ============================================================================
// 2. TRUST SUMMARY BLOCK
// ============================================================================

export interface TrustSummaryProps {
  hospitalVerified?: boolean;
  credentialsVerified?: boolean;
  hasSalaryTransparency?: boolean;
  hasShiftTransparency?: boolean;
  className?: string;
}

export function TrustSummaryBlock({
  hospitalVerified = true,
  credentialsVerified = true,
  hasSalaryTransparency = true,
  hasShiftTransparency = true,
  className,
}: TrustSummaryProps) {
  const items = [
    { label: 'Hospital Verified', confirmed: hospitalVerified, icon: Building2 },
    { label: 'Credentials Verified', confirmed: credentialsVerified, icon: FileCheck },
    { label: 'Transparent Salary', confirmed: hasSalaryTransparency, icon: ShieldCheck },
    { label: 'Clear Shift Details', confirmed: hasShiftTransparency, icon: Clock },
  ].filter(i => i.confirmed);

  if (items.length === 0) return null;

  return (
    <div className={cn('rounded-lg border border-slate-200/80 bg-slate-50/60 p-2.5', className)}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <Shield className="h-3 w-3 text-primary-700" /> NurseConnect Trust Guarantee
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-slate-700 font-medium">
            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 3. REAL CREDIBILITY DATA HOOK
// ============================================================================

export interface HospitalCredibilityMetrics {
  loading: boolean;
  nursesHired: number | null;
  responseTimeText: string;
  rating: number | null;
  reviewCount: number;
}

export function useHospitalCredibilityMetrics(hospitalId?: string | null): HospitalCredibilityMetrics {
  const [metrics, setMetrics] = useState<HospitalCredibilityMetrics>({
    loading: true,
    nursesHired: null,
    responseTimeText: 'Response time not available yet',
    rating: null,
    reviewCount: 0,
  });

  useEffect(() => {
    if (!hospitalId) {
      setMetrics({
        loading: false,
        nursesHired: null,
        responseTimeText: 'Response time not available yet',
        rating: null,
        reviewCount: 0,
      });
      return;
    }

    let isMounted = true;

    async function loadMetrics() {
      try {
        // 1. Query genuine completed hires for this hospital
        // First get jobs of this hospital
        const { data: jobs } = await supabase
          .from('jobs')
          .select('id')
          .eq('hospital_id', hospitalId);

        const jobIds = (jobs || []).map((j: { id: string }) => j.id);

        let hiredCount: number | null = null;
        let responseTimeStr = 'Response time not available yet';

        if (jobIds.length > 0) {
          // Query applications with real final hired/joined status
          const { data: apps } = await supabase
            .from('applications')
            .select('id, status, created_at, updated_at')
            .in('job_id', jobIds);

          const appList = (apps || []) as { id: string; status: string; created_at: string; updated_at: string }[];
          
          // Strict count: only actual confirmed hires
          const confirmedHires = appList.filter(a => a.status === 'selected' || a.status === 'joined').length;
          hiredCount = confirmedHires;

          // Response time calculation based on real timestamps
          // Only if there are at least 2 processed applications with updated timestamps
          const processedApps = appList.filter(
            a => a.status !== 'applied' && a.status !== 'pending' && a.created_at && a.updated_at && a.created_at !== a.updated_at
          );

          if (processedApps.length >= 2) {
            let totalHours = 0;
            let validPoints = 0;

            for (const app of processedApps) {
              const start = new Date(app.created_at).getTime();
              const end = new Date(app.updated_at).getTime();
              const diffHours = (end - start) / (1000 * 60 * 60);
              if (diffHours > 0 && diffHours < 720) { // filter extreme outliers
                totalHours += diffHours;
                validPoints++;
              }
            }

            if (validPoints >= 2) {
              const avgHours = Math.round(totalHours / validPoints);
              if (avgHours <= 24) {
                responseTimeStr = `Usually responds within ${Math.max(1, avgHours)} hours`;
              } else {
                const days = Math.round(avgHours / 24);
                responseTimeStr = `Usually responds within ${days} ${days === 1 ? 'day' : 'days'}`;
              }
            }
          }
        }

        // 2. Query workplace reviews for this hospital
        let avgRating: number | null = null;
        let revCount = 0;

        try {
          const { data: reviews } = await supabase
            .from('reviews')
            .select('rating')
            .eq('reviewer_role', 'nurse')
            .limit(50);

          if (reviews && reviews.length > 0) {
            const ratings = reviews.map((r: { rating: number }) => r.rating).filter((r: number) => r > 0);
            if (ratings.length > 0) {
              const sum = ratings.reduce((acc: number, curr: number) => acc + curr, 0);
              avgRating = Number((sum / ratings.length).toFixed(1));
              revCount = ratings.length;
            }
          }
        } catch {
          // Reviews table not populated or empty
        }

        if (isMounted) {
          setMetrics({
            loading: false,
            nursesHired: hiredCount,
            responseTimeText: responseTimeStr,
            rating: avgRating,
            reviewCount: revCount,
          });
        }
      } catch (err) {
        console.warn('Error loading hospital credibility metrics:', err);
        if (isMounted) {
          setMetrics({
            loading: false,
            nursesHired: null,
            responseTimeText: 'Response time not available yet',
            rating: null,
            reviewCount: 0,
          });
        }
      }
    }

    loadMetrics();

    return () => {
      isMounted = false;
    };
  }, [hospitalId]);

  return metrics;
}

// ============================================================================
// 4. HOSPITAL CREDIBILITY CARD ("About This Hospital")
// ============================================================================

export interface HospitalCredibilityCardProps {
  hospital?: Partial<Hospital> | null;
  hospitalId?: string | null;
  className?: string;
  compact?: boolean;
}

export function HospitalCredibilityCard({
  hospital,
  hospitalId,
  className,
  compact = false,
}: HospitalCredibilityCardProps) {
  const targetId = hospital?.id || hospitalId;
  const metrics = useHospitalCredibilityMetrics(targetId);

  const verified = isHospitalVerified(hospital);
  const hospitalName = hospital?.hospital_name || hospital?.name || 'Healthcare Facility';
  const location = [hospital?.address, hospital?.city, hospital?.state].filter(Boolean).join(', ');
  const hospitalType = hospital?.hospital_type || 'Multi-Specialty Healthcare Facility';
  const bedCount = hospital?.number_of_beds;
  const departments = hospital?.departments;

  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700 shadow-2xs', className)}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#082F63] text-white">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">{hospitalName}</h4>
            <p className="text-[11px] text-slate-500">About This Hospital</p>
          </div>
        </div>

        <VerifiedHospitalBadge
          isVerified={verified}
          verificationStatus={hospital?.verification_status}
          size="sm"
          showUnverifiedState={true}
        />
      </div>

      {/* Grid of Verified Facts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3">
        {/* Verification & License */}
        <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 border border-slate-100/80">
          <FileCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              License & Registration
            </span>
            <span className="font-medium text-slate-800">
              {verified ? '✓ Verified by NurseConnect' : 'Verification in Progress'}
            </span>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 border border-slate-100/80">
          <MapPin className="h-4 w-4 text-primary-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Location
            </span>
            <span className="font-medium text-slate-800 truncate block">
              {location || 'Location details provided upon application'}
            </span>
          </div>
        </div>

        {/* Hospital Type */}
        <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 border border-slate-100/80">
          <Building2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Hospital Type
            </span>
            <span className="font-medium text-slate-800">
              {hospitalType}
            </span>
          </div>
        </div>

        {/* Bed Capacity (if provided) */}
        {bedCount != null && bedCount > 0 ? (
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 border border-slate-100/80">
            <BedDouble className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Bed Capacity
              </span>
              <span className="font-medium text-slate-800">
                {bedCount} Beds
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 border border-slate-100/80">
            <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                HR Response
              </span>
              <span className="font-medium text-slate-800">
                {metrics.responseTimeText}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Departments if available */}
      {departments && (
        <div className="mt-2.5 rounded-lg bg-slate-50 p-2 border border-slate-100/80 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700 mb-1">
            <Stethoscope className="h-3.5 w-3.5 text-teal-600" />
            <span>Key Clinical Departments</span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            {departments}
          </p>
        </div>
      )}

      {/* Real-time Trust Strip (Response time, Hires, Reviews) */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
        {/* Response time */}
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-slate-400" />
          <span>{metrics.responseTimeText}</span>
        </div>

        {/* Nurses hired through NurseConnect */}
        <div className="flex items-center gap-1 font-medium">
          <Users className="h-3 w-3 text-primary-600" />
          {metrics.nursesHired != null && metrics.nursesHired > 0 ? (
            <span className="text-primary-800 font-semibold">
              {metrics.nursesHired} {metrics.nursesHired === 1 ? 'nurse' : 'nurses'} hired through NurseConnect
            </span>
          ) : (
            <span className="text-slate-500">First hiring cycle on NurseConnect</span>
          )}
        </div>

        {/* Workplace reviews / rating */}
        <div className="flex items-center gap-1">
          {metrics.rating != null ? (
            <span className="flex items-center gap-1 text-amber-700 font-semibold">
              <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
              <span>{metrics.rating}</span>
              <span className="text-slate-400 font-normal">({metrics.reviewCount} reviews)</span>
            </span>
          ) : (
            <span className="text-slate-400 italic">No workplace ratings yet</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 5. PROFILE TRUST FOR NURSES ("Profile & Credentials")
// ============================================================================

import { getProfileCompleteness } from '../lib/matching';

export interface NurseProfileTrustCardProps {
  basicProfile: Profile | null;
  nurseProfile: NurseProfile | null;
  documents?: Array<{ document_type: string }> | null;
  onNavigateEdit?: () => void;
  onNavigateDocs?: () => void;
  className?: string;
}

export function NurseProfileTrustCard({
  basicProfile,
  nurseProfile,
  documents,
  onNavigateEdit,
  onNavigateDocs,
  className,
}: NurseProfileTrustCardProps) {
  const completeness = getProfileCompleteness(basicProfile, nurseProfile, documents);
  const { percentage, isComplete, canApply, requiredDocs, missingFields } = completeness;

  const hasQualification = Boolean(nurseProfile?.qualification || basicProfile?.specialty);
  const hasRegistration = Boolean(nurseProfile?.nursing_registration_number || basicProfile?.license_number);
  const hasExperience = Boolean(nurseProfile?.total_experience != null || basicProfile?.years_experience != null);
  const hasContact = Boolean(basicProfile?.phone && basicProfile?.email);

  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-4 shadow-2xs', className)}>
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg',
            isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
          )}>
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Profile & Document Verification</h4>
            <p className="text-[11px] text-slate-500">
              {isComplete ? '100% Verified — Fully eligible to apply' : 'Mandatory documents required to apply'}
            </p>
          </div>
        </div>

        <span className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold',
          isComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
        )}>
          {isComplete ? '✓ 100% Complete' : `${percentage}% Complete`}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mt-2.5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isComplete ? 'bg-emerald-600' : percentage >= 70 ? 'bg-amber-500' : 'bg-primary-600'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Verified Checklist: Profile & Mandatory Documents */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {/* Profile fields */}
        <div className="flex items-center gap-1.5">
          {hasQualification ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          )}
          <span className={hasQualification ? 'font-medium text-slate-700' : 'text-slate-400'}>
            Qualification {hasQualification ? `(${nurseProfile?.qualification || 'BSc'})` : 'Missing'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {hasRegistration ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          )}
          <span className={hasRegistration ? 'font-medium text-slate-700' : 'text-slate-400'}>
            Nursing Reg. Number {hasRegistration ? '✓ Provided' : 'Missing'}
          </span>
        </div>

        {/* 4 Mandatory Documents */}
        <div className="flex items-center gap-1.5">
          {requiredDocs.hasQualificationDoc ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
          )}
          <span className={requiredDocs.hasQualificationDoc ? 'font-medium text-slate-700' : 'text-red-700 font-medium'}>
            Qualification Certificate {requiredDocs.hasQualificationDoc ? '✓ Uploaded' : '❌ Required'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {requiredDocs.hasRegistrationDoc ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
          )}
          <span className={requiredDocs.hasRegistrationDoc ? 'font-medium text-slate-700' : 'text-red-700 font-medium'}>
            Registration Certificate {requiredDocs.hasRegistrationDoc ? '✓ Uploaded' : '❌ Required'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {requiredDocs.hasIdProofDoc ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
          )}
          <span className={requiredDocs.hasIdProofDoc ? 'font-medium text-slate-700' : 'text-red-700 font-medium'}>
            Govt ID Proof {requiredDocs.hasIdProofDoc ? '✓ Uploaded' : '❌ Required'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {requiredDocs.hasPhoto ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
          )}
          <span className={requiredDocs.hasPhoto ? 'font-medium text-slate-700' : 'text-red-700 font-medium'}>
            Passport-size Photo {requiredDocs.hasPhoto ? '✓ Uploaded' : '❌ Required'}
          </span>
        </div>
      </div>

      {!isComplete && (
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-amber-50/90 p-2.5 border border-amber-200 text-xs text-amber-900">
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-900 text-[11px]">
              {requiredDocs.missingDocs.length > 0
                ? `Missing Documents: ${requiredDocs.missingDocs.join(', ')}`
                : 'Complete required profile information'}
            </p>
            <p className="text-slate-600 text-[10.5px]">
              Profile must reach 100% with all 4 mandatory documents to unlock job applications.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onNavigateDocs && requiredDocs.missingDocs.length > 0 && (
              <button
                type="button"
                onClick={onNavigateDocs}
                className="font-bold text-primary-700 hover:text-primary-900 underline cursor-pointer text-[11px]"
              >
                Upload Docs →
              </button>
            )}
            {onNavigateEdit && (
              <button
                type="button"
                onClick={onNavigateEdit}
                className="font-semibold text-slate-700 hover:text-slate-900 underline cursor-pointer text-[11px]"
              >
                Edit Profile →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
