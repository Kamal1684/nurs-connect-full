import { useEffect, useState, useMemo, useCallback, type FormEvent, type ReactNode } from 'react';
import {
  Calendar, Clock, DollarSign, MapPin, Search, Stethoscope, Send, Briefcase,
  User as UserIcon, CheckCircle2, XCircle, FileText, Bookmark, BookmarkCheck,
  Video, Phone, MapPin as MapIcon, Bell, Award, Building2, FileUp,
  Trash2, Download, Home as HomeIcon, PartyPopper, AlertCircle, ArrowRight,
  ExternalLink, Sparkles, Check, ChevronDown, ChevronUp, Info, ShieldCheck, Eye,
  IndianRupee,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type {
  JobWithHospital, Application, ApplicationWithJob, NurseProfile,
  NurseDocument, SavedJob, SavedJobWithJob, Notification, InterviewWithApplication, Profile,
} from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Badge, Button, Input, Select, Spinner, EmptyState, Textarea, Modal, useToast } from '@/components/ui';
import { formatCurrency, formatDate, cn, getInitials, formatSalaryDisplay, formatShiftDisplay, normalizeJob, isJobExpired } from '@/lib/utils';
import { INDIAN_STATES_AND_UTS, NURSING_QUALIFICATIONS } from '@/lib/constants';
import { calculateSmartMatch, getProfileCompleteness, type NurseMatchProfile, type SmartMatchResult } from '@/lib/matching';
import { SmartMatchBadge } from '@/components/SmartMatchBadge';
import { SmartMatchBreakdownModal } from '@/components/SmartMatchBreakdownModal';
import {
  CompensationAndWorkDetailsSection,
  BeforeYouApplyBanner,
  JobBenefitsBadgesRow,
} from '@/components/CompensationAndWorkDetails';
import {
  VerifiedHospitalBadge,
  HospitalCredibilityCard,
  TrustSummaryBlock,
  NurseProfileTrustCard,
} from '@/components/HospitalTrustLayer';
import { NursePhotoAvatar, NursePassportPhotoUpload } from '@/components/NursePhotoAvatar';

type Tab = 'browse' | 'applications' | 'saved' | 'interviews' | 'profile' | 'documents' | 'notifications';

export function NursePortal({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { profile, user } = useAuth();
  const [selectedAppForModal, setSelectedAppForModal] = useState<ApplicationWithJob | null>(null);
  const [hasDismissedCongrat, setHasDismissedCongrat] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [nurseProfileData, setNurseProfileData] = useState<NurseProfile | null>(null);
  const [nurseDocsData, setNurseDocsData] = useState<NurseDocument[]>([]);
  const [applicationsFilter, setApplicationsFilter] = useState<string>('all');

  // Summary Metrics State
  const [metrics, setMetrics] = useState({
    upcomingInterviews: 0,
    shortlisted: 0,
    selected: 0,
  });

  // Load summary metrics and check for selected applications to show Congratulations popup
  const loadMetricsAndSelection = useCallback(async () => {
    if (!user) return;
    try {
      const [{ data: apps }, { data: ivs }] = await Promise.all([
        supabase
          .from('applications')
          .select('id, status, updated_at, jobs(*, hospitals(id, hospital_name, name, city, state, address, verification_status)), interviews(*)')
          .eq('nurse_id', user.id),
        supabase
          .from('interviews')
          .select('id, status, interview_date, applications!inner(nurse_id)')
          .eq('applications.nurse_id', user.id)
          .eq('status', 'scheduled'),
      ]);

      const appList = (apps as unknown as ApplicationWithJob[]) || [];
      const shortlistedCount = appList.filter((a) => a.status === 'shortlisted').length;
      const selectedApps = appList.filter((a) => a.status === 'selected' || a.status === 'joined');
      const selectedCount = selectedApps.length;
      const upcomingInterviewsCount = (ivs || []).length;

      setMetrics({
        upcomingInterviews: upcomingInterviewsCount,
        shortlisted: shortlistedCount,
        selected: selectedCount,
      });

      if (selectedApps.length > 0 && !hasDismissedCongrat) {
        const sortedSelected = [...selectedApps].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        const dismissedKey = `dismissed_congrat_${sortedSelected[0].id}`;
        if (!sessionStorage.getItem(dismissedKey)) {
          setSelectedAppForModal(sortedSelected[0]);
        }
      }
    } catch {}
  }, [user, hasDismissedCongrat]);

  useEffect(() => {
    loadMetricsAndSelection();
  }, [loadMetricsAndSelection]);

  // Check nurse profile completeness including mandatory documents
  const loadNurseProfileAndDocs = useCallback(async () => {
    if (!user) return;
    try {
      const [{ data: np }, { data: docs }] = await Promise.all([
        supabase
          .from('nurse_profiles')
          .select('*')
          .eq('nurse_id', user.id)
          .maybeSingle(),
        supabase
          .from('nurse_documents')
          .select('*')
          .eq('nurse_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      const nProfile = (np as NurseProfile | null) || null;
      const nDocs = (docs as NurseDocument[]) || [];
      setNurseProfileData(nProfile);
      setNurseDocsData(nDocs);

      const completeness = getProfileCompleteness(profile, nProfile, nDocs);
      setIsProfileComplete(completeness.isComplete);
    } catch {
      const completeness = getProfileCompleteness(profile, null, []);
      setIsProfileComplete(completeness.isComplete);
    }
  }, [user, profile]);

  useEffect(() => {
    loadNurseProfileAndDocs();
  }, [loadNurseProfileAndDocs]);

  const isVerified = profile?.verification_status === 'verified';

  return (
    <div className="space-y-6">
      {/* Top Status Banner */}
      <div className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-xs',
        isVerified
          ? 'border-emerald-200 bg-emerald-50/80 text-emerald-900'
          : 'border-amber-200 bg-amber-50/80 text-amber-900'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          )}>
            {isVerified ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <span>Account Status:</span>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
                isVerified ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
              )}>
                {isVerified ? 'Verified ✓' : 'Pending Verification'}
              </span>
            </div>
            <p className="text-xs opacity-80 mt-0.5">
              {isVerified
                ? 'Your credentials have been verified by the NurseConnect administrative team.'
                : 'Your profile is currently under review by our admin team. You can explore positions and complete your profile.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isProfileComplete && (
            <button
              onClick={() => setTab('profile')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-xs font-medium transition-colors"
            >
              Complete Profile <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Clickable Nurse Dashboard Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Upcoming Interviews Card */}
        <button
          onClick={() => setTab('interviews')}
          className={cn(
            'flex items-center justify-between p-4 rounded-xl border text-left transition-all hover:shadow-md cursor-pointer group',
            metrics.upcomingInterviews > 0
              ? 'bg-blue-50/70 border-blue-200 hover:border-blue-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
          )}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
              metrics.upcomingInterviews > 0 ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-100 text-blue-600'
            )}>
              <Video className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Upcoming Interviews</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{metrics.upcomingInterviews}</h3>
              <p className="text-xs text-blue-600 font-medium group-hover:underline flex items-center gap-1 mt-0.5">
                View schedules <ArrowRight className="h-3 w-3" />
              </p>
            </div>
          </div>
        </button>

        {/* Shortlisted Card */}
        <button
          onClick={() => {
            setApplicationsFilter('shortlisted');
            setTab('applications');
          }}
          className={cn(
            'flex items-center justify-between p-4 rounded-xl border text-left transition-all hover:shadow-md cursor-pointer group',
            metrics.shortlisted > 0
              ? 'bg-teal-50/70 border-teal-200 hover:border-teal-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
          )}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
              metrics.shortlisted > 0 ? 'bg-teal-600 text-white shadow-xs' : 'bg-teal-100 text-teal-600'
            )}>
              <Award className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Shortlisted</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{metrics.shortlisted}</h3>
              <p className="text-xs text-teal-600 font-medium group-hover:underline flex items-center gap-1 mt-0.5">
                Review applications <ArrowRight className="h-3 w-3" />
              </p>
            </div>
          </div>
        </button>

        {/* Selected / Job Offers Card */}
        <button
          onClick={() => {
            setApplicationsFilter('selected');
            setTab('applications');
          }}
          className={cn(
            'flex items-center justify-between p-4 rounded-xl border text-left transition-all hover:shadow-md cursor-pointer group',
            metrics.selected > 0
              ? 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-400'
              : 'bg-white border-slate-200 hover:border-slate-300'
          )}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
              metrics.selected > 0 ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-100 text-emerald-600'
            )}>
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Selected / Offers</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{metrics.selected}</h3>
              <p className="text-xs text-emerald-600 font-medium group-hover:underline flex items-center gap-1 mt-0.5">
                View selections <ArrowRight className="h-3 w-3" />
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Nurse Profile & Credential Trust Card */}
      <NurseProfileTrustCard
        basicProfile={profile}
        nurseProfile={nurseProfileData}
        documents={nurseDocsData}
        onNavigateEdit={() => setTab('profile')}
        onNavigateDocs={() => setTab('documents')}
      />

      {/* Professional Healthcare-Themed Selection Congratulations Popup Modal */}
      {selectedAppForModal && (
        <Modal
          onClose={() => {
            sessionStorage.setItem(`dismissed_congrat_${selectedAppForModal.id}`, 'true');
            setSelectedAppForModal(null);
            setHasDismissedCongrat(true);
          }}
          title=""
        >
          <div className="space-y-4">
            {/* Header with Medical Celebration Icon */}
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-inner ring-8 ring-emerald-50 mb-3">
                <Award className="h-9 w-9 text-emerald-600" />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> Official Selection Offer
              </span>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-900 tracking-tight">Congratulations, {profile?.full_name || 'Nurse'}!</h2>
              <p className="mt-1 text-sm text-slate-600">
                You have been officially selected by the hospital hiring committee for the following nursing role:
              </p>
            </div>

            {/* Position & Hospital Card */}
            <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-teal-50/40 p-4.5 space-y-3">
              <div>
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Designation</span>
                <h3 className="font-bold text-slate-900 text-lg">{selectedAppForModal.jobs?.job_title}</h3>
              </div>

              <div className="space-y-1.5 border-t border-emerald-200/60 pt-2.5 text-sm">
                <div className="flex items-center gap-2 font-semibold text-slate-800">
                  <Building2 className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>{selectedAppForModal.jobs?.hospitals?.hospital_name || selectedAppForModal.jobs?.hospitals?.name}</span>
                  <Badge color="green">Verified Hospital</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Stethoscope className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Department: {selectedAppForModal.jobs?.department}</span>
                </div>
                {(selectedAppForModal.jobs?.hospitals?.city || selectedAppForModal.jobs?.location) && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>Location: {selectedAppForModal.jobs?.hospitals?.city || selectedAppForModal.jobs?.location}</span>
                  </div>
                )}
                {selectedAppForModal.jobs?.salary_min && (
                  <div className="flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Compensation: {formatCurrency(selectedAppForModal.jobs.salary_min)}{selectedAppForModal.jobs.salary_max ? ` – ${formatCurrency(selectedAppForModal.jobs.salary_max)}` : ''}/month</span>
                  </div>
                )}
              </div>
            </div>

            {/* Next Steps Guidance */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 space-y-1.5">
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Next Steps & Onboarding:
              </p>
              <ul className="space-y-1 pl-5 list-disc text-slate-600">
                <li>The hospital HR department will contact you directly to share your official appointment letter.</li>
                <li>Ensure all nursing registration and ID certificates in <strong>My Documents</strong> are up to date.</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  sessionStorage.setItem(`dismissed_congrat_${selectedAppForModal.id}`, 'true');
                  setSelectedAppForModal(null);
                  setHasDismissedCongrat(true);
                }}
              >
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  sessionStorage.setItem(`dismissed_congrat_${selectedAppForModal.id}`, 'true');
                  setSelectedAppForModal(null);
                  setHasDismissedCongrat(true);
                  setApplicationsFilter('selected');
                  setTab('applications');
                }}
              >
                View Selected Application Details
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Main Tab Render */}
      {tab === 'browse' && (
        <BrowseJobs
          isProfileComplete={isProfileComplete}
          onNavigateProfile={() => setTab('profile')}
          onNavigateDocuments={() => setTab('documents')}
          nurseProfile={nurseProfileData}
          nurseBasicProfile={profile}
          nurseDocs={nurseDocsData}
        />
      )}
      {tab === 'applications' && (
        <MyApplications
          initialFilter={applicationsFilter}
          nurseProfile={nurseProfileData}
          nurseBasicProfile={profile}
        />
      )}
      {tab === 'saved' && (
        <SavedJobs
          onBrowse={() => setTab('browse')}
          nurseProfile={nurseProfileData}
          nurseBasicProfile={profile}
        />
      )}
      {tab === 'interviews' && <MyInterviews onNavigateNotifications={() => setTab('notifications')} />}
      {tab === 'profile' && (
        <NurseProfileTab
          onProfileUpdated={loadNurseProfileAndDocs}
        />
      )}
      {tab === 'documents' && (
        <MyDocuments
          onDocsUpdated={loadNurseProfileAndDocs}
        />
      )}
      {tab === 'notifications' && <MyNotifications />}
    </div>
  );
}

// ============ BROWSE JOBS ============
function BrowseJobs({
  isProfileComplete,
  onNavigateProfile,
  onNavigateDocuments,
  nurseProfile,
  nurseBasicProfile,
  nurseDocs,
}: {
  isProfileComplete: boolean;
  onNavigateProfile: () => void;
  onNavigateDocuments: () => void;
  nurseProfile: NurseProfile | null;
  nurseBasicProfile: Profile | null;
  nurseDocs: NurseDocument[] | null;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<JobWithHospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'match' | 'recent' | 'salary' | 'deadline'>('match');
  const [filterDept, setFilterDept] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterMatchScore, setFilterMatchScore] = useState<'all' | '90' | '80' | '70'>('all');
  const [filterExp, setFilterExp] = useState<'all' | 'fresher' | 'mid' | 'senior'>('all');
  const [filterShift, setFilterShift] = useState<'all' | 'day' | 'night' | 'flexible'>('all');
  const [filterSalary, setFilterSalary] = useState<'all' | '25000' | '40000' | '60000'>('all');
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [selectedJob, setSelectedJob] = useState<JobWithHospital | null>(null);
  const [jobForDetailModal, setJobForDetailModal] = useState<(JobWithHospital & { matchScore: number; matchBreakdown: SmartMatchResult }) | null>(null);
  const [breakdownModalMatch, setBreakdownModalMatch] = useState<{ match: SmartMatchResult; jobTitle: string } | null>(null);
  const [expandedMatchJobIds, setExpandedMatchJobIds] = useState<Set<string>>(new Set());
  const [coverMessage, setCoverMessage] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);

  // Analyze Profile Completeness (including mandatory documents)
  const profileCompleteness = useMemo(() => {
    return getProfileCompleteness(nurseBasicProfile, nurseProfile, nurseDocs);
  }, [nurseBasicProfile, nurseProfile, nurseDocs]);

  const loadData = useCallback(async () => {
    const [{ data: jobData, error: jobError }, { data: appData }, { data: savedData }] = await Promise.all([
      supabase
        .from('jobs')
        .select('*, hospitals(id, hospital_name, name, city, state, verification_status, address, hospital_type, number_of_beds, departments, website, phone)')
        .in('status', ['active', 'published'])
        .order('created_at', { ascending: false }),
      supabase.from('applications').select('job_id').eq('nurse_id', user!.id).not('job_id', 'is', null),
      supabase.from('saved_jobs').select('job_id').eq('nurse_id', user!.id),
    ]);

    if (jobError || !jobData) {
      // Fallback query if relation join has issue
      const { data: rawJobs } = await supabase
        .from('jobs')
        .select('*')
        .in('status', ['active', 'published'])
        .order('created_at', { ascending: false });

      if (rawJobs && rawJobs.length > 0) {
        const hospIds = Array.from(new Set(rawJobs.map((j) => j.hospital_id).filter(Boolean)));
        const { data: rawHosps } = await supabase
          .from('hospitals')
          .select('id, hospital_name, name, city, state, verification_status, address, hospital_type, number_of_beds, departments, website, phone')
          .in('id', hospIds);

        const hospMap = new Map((rawHosps || []).map((h) => [h.id, h]));
        const combined = rawJobs.map((j) => {
          const norm = normalizeJob(j);
          return {
            ...norm,
            hospitals: hospMap.get(norm.hospital_id) || null,
          };
        });
        setJobs(combined as JobWithHospital[]);
      } else {
        setJobs([]);
      }
    } else {
      const normalizedJobs = (jobData || []).map((j) => {
        const norm = normalizeJob(j);
        return {
          ...norm,
          hospitals: j.hospitals,
        };
      });
      setJobs(normalizedJobs as JobWithHospital[]);
    }

    setAppliedJobIds(new Set((appData as Application[] || []).map((a) => a.job_id).filter(Boolean) as string[]));
    setSavedJobIds(new Set((savedData as SavedJob[] || []).map((s) => s.job_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Compute 5-Pillar Smart Match for each job against nurse profile
  const jobsWithMatch = useMemo(() => {
    const nurseTarget: NurseMatchProfile = {
      id: user?.id,
      nurse_id: user?.id,
      full_name: nurseBasicProfile?.full_name,
      qualification: nurseProfile?.qualification,
      specialty: nurseBasicProfile?.specialty || nurseProfile?.departments,
      departments: nurseProfile?.departments || nurseBasicProfile?.specialty,
      total_experience: nurseProfile?.total_experience ?? nurseBasicProfile?.years_experience,
      years_experience: nurseBasicProfile?.years_experience ?? nurseProfile?.total_experience,
      preferred_location: nurseProfile?.preferred_location || nurseBasicProfile?.city,
      city: nurseBasicProfile?.city,
      state: nurseBasicProfile?.state,
      expected_salary: nurseProfile?.expected_salary,
      shift_preference: nurseProfile?.shift_preference,
      accommodation_required: nurseProfile?.accommodation_required,
      availability: nurseProfile?.availability,
    };

    return jobs.map((job) => {
      const matchResult = calculateSmartMatch(nurseTarget, job);
      return {
        ...job,
        matchScore: matchResult.score,
        matchBreakdown: matchResult,
      };
    });
  }, [jobs, nurseProfile, nurseBasicProfile, user?.id]);

  function isDeadlinePassed(job: JobWithHospital) {
    return isJobExpired(job.last_date_to_apply);
  }

  function getApplicationDeadline(job: JobWithHospital) {
    if (job.last_date_to_apply) {
      return formatDate(job.last_date_to_apply);
    }
    const created = new Date(job.created_at || Date.now());
    const deadline = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
    return formatDate(deadline.toISOString());
  }

  // Top Recommended Smart Matches for the spotlight
  // Strict sort: 1. Match Score (descending) -> 2. Freshness -> 3. Deadline
  const topSmartMatches = useMemo(() => {
    if (!profileCompleteness.isReadyForMatching) return [];

    return jobsWithMatch
      .filter((j) => j.matchScore >= 70 && !appliedJobIds.has(j.id) && !isDeadlinePassed(j))
      .sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, 3);
  }, [jobsWithMatch, appliedJobIds, profileCompleteness.isReadyForMatching]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => { if (j.department) set.add(j.department); });
    return Array.from(set).sort();
  }, [jobs]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => { if (j.location) set.add(j.location); });
    return Array.from(set).sort();
  }, [jobs]);

  const filteredAndSortedJobs = useMemo(() => {
    // 1. Filter
    const filtered = jobsWithMatch.filter((j) => {
      if (filterDept !== 'all' && j.department !== filterDept) return false;
      if (filterLocation !== 'all' && j.location !== filterLocation) return false;

      // Smart match score filter
      if (filterMatchScore === '90' && j.matchScore < 90) return false;
      if (filterMatchScore === '80' && j.matchScore < 80) return false;
      if (filterMatchScore === '70' && j.matchScore < 70) return false;

      // Experience filter
      if (filterExp === 'fresher' && (j.experience_required ?? 0) > 1) return false;
      if (filterExp === 'mid' && ((j.experience_required ?? 0) < 2 || (j.experience_required ?? 0) > 4)) return false;
      if (filterExp === 'senior' && (j.experience_required ?? 0) < 5) return false;

      // Shift filter
      if (filterShift === 'day' && j.shift && !j.shift.toLowerCase().includes('day') && !j.shift.toLowerCase().includes('general')) return false;
      if (filterShift === 'night' && j.shift && !j.shift.toLowerCase().includes('night')) return false;
      if (filterShift === 'flexible' && j.shift && !j.shift.toLowerCase().includes('rotat') && !j.shift.toLowerCase().includes('flex')) return false;

      // Salary filter
      if (filterSalary === '25000' && (j.salary_max ?? j.salary_min ?? 0) < 25000) return false;
      if (filterSalary === '40000' && (j.salary_max ?? j.salary_min ?? 0) < 40000) return false;
      if (filterSalary === '60000' && (j.salary_max ?? j.salary_min ?? 0) < 60000) return false;

      if (search) {
        const q = search.toLowerCase();
        return (
          j.job_title.toLowerCase().includes(q) ||
          j.department.toLowerCase().includes(q) ||
          j.hospitals?.hospital_name?.toLowerCase().includes(q) ||
          j.hospitals?.name?.toLowerCase().includes(q) ||
          j.location?.toLowerCase().includes(q) ||
          (j.required_skills && j.required_skills.toLowerCase().includes(q))
        );
      }
      return true;
    });

    // 2. Sort
    return filtered.sort((a, b) => {
      if (sortBy === 'match') {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'recent') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'salary') {
        const salA = a.salary_max || a.salary_min || 0;
        const salB = b.salary_max || b.salary_min || 0;
        return salB - salA;
      }
      if (sortBy === 'deadline') {
        const dateA = a.last_date_to_apply ? new Date(a.last_date_to_apply).getTime() : Number.MAX_SAFE_INTEGER;
        const dateB = b.last_date_to_apply ? new Date(b.last_date_to_apply).getTime() : Number.MAX_SAFE_INTEGER;
        return dateA - dateB;
      }
      return 0;
    });
  }, [jobsWithMatch, search, sortBy, filterDept, filterLocation, filterMatchScore, filterExp, filterShift, filterSalary]);

  function toggleExpandMatch(jobId: string) {
    setExpandedMatchJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  function handleInitiateApply(job: JobWithHospital) {
    if (isDeadlinePassed(job)) {
      showToast('error', 'The application deadline for this position has passed.');
      return;
    }
    if (!profileCompleteness.isComplete || !profileCompleteness.canApply) {
      setShowIncompleteModal(true);
      return;
    }
    setSelectedJob(job);
    setCoverMessage('');
    setApplyError(null);
  }

  async function handleApply() {
    if (!selectedJob || !user) return;
    if (isDeadlinePassed(selectedJob)) {
      setApplyError('The deadline to apply for this position has passed.');
      return;
    }
    setApplying(true);
    setApplyError(null);

    const { error } = await supabase.from('applications').insert({
      job_id: selectedJob.id,
      nurse_id: user.id,
      status: 'applied',
      cover_message: coverMessage || null,
    });

    if (error) {
      setApplyError(error.message);
      setApplying(false);
      return;
    }

    await supabase.rpc('create_notification', {
      p_user_id: user.id,
      p_title: 'Application Submitted',
      p_message: `You applied for ${selectedJob.job_title}`,
      p_type: 'application',
    });

    setAppliedJobIds(new Set([...appliedJobIds, selectedJob.id]));
    setSelectedJob(null);
    setJobForDetailModal(null);
    setCoverMessage('');
    setApplying(false);
    showToast('success', 'Application submitted successfully!');
  }

  async function toggleSave(jobId: string) {
    if (savedJobIds.has(jobId)) {
      const { error } = await supabase.from('saved_jobs').delete().eq('nurse_id', user!.id).eq('job_id', jobId);
      if (error) { showToast('error', 'Failed to remove saved job'); return; }
      setSavedJobIds(new Set([...savedJobIds].filter((id) => id !== jobId)));
    } else {
      const { error } = await supabase.from('saved_jobs').insert({ nurse_id: user!.id, job_id: jobId });
      if (error) { showToast('error', 'Failed to save job'); return; }
      setSavedJobIds(new Set([...savedJobIds, jobId]));
    }
  }

  if (loading) return <Spinner className="py-20" />;

  return (
    <div className="space-y-6">
      {/* 1. Profile Completeness & "Improve Your Matches" Indicator */}
      {!profileCompleteness.isReadyForMatching ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-amber-900 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-950">Complete your profile to unlock Smart Match</h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  Profile is {profileCompleteness.percentage}% complete. Add your clinical specialty, qualification, and preferred city to see personalized match scores.
                </p>
                {profileCompleteness.missingFields.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {profileCompleteness.missingFields.slice(0, 3).map((mf) => (
                      <span key={mf.key} className="text-[11px] font-medium bg-amber-100/90 border border-amber-200 text-amber-900 px-2 py-0.5 rounded-md">
                        + Add {mf.label} ({mf.impact})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Button size="sm" onClick={onNavigateProfile} className="shrink-0 font-semibold">
              Complete Profile
            </Button>
          </div>
        </div>
      ) : profileCompleteness.percentage < 100 ? (
        <div className="rounded-xl border border-blue-200/80 bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-white p-3.5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs shadow-xs">
                {profileCompleteness.percentage}%
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900">Profile Completion: {profileCompleteness.percentage}%</span>
                  <span className="text-[11px] text-blue-600 font-medium hidden md:inline">• Smart Match Active</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 truncate">
                  {profileCompleteness.suggestion}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onNavigateProfile}
              className="shrink-0 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
            >
              Improve Matches <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* 2. Top "Recommended for You" Spotlight Section */}
      {topSmartMatches.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-[#082F63]/5 via-white to-teal-50/30 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#082F63] text-amber-300 shadow-xs">
                <Sparkles className="h-5 w-5 fill-current" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Recommended for You</h3>
                <p className="text-xs text-slate-500">
                  Ranked by 5-pillar transparent match score, freshness, and application deadline
                </p>
              </div>
            </div>
            <Badge color="blue" className="bg-[#082F63] text-white border-[#082F63]/30 w-fit">
              {topSmartMatches.length} Top Opportunities
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {topSmartMatches.map((topJob) => {
              const hospName = topJob.hospitals?.hospital_name || topJob.hospitals?.name || 'Hospital Partner';
              const isHospVerified = topJob.hospitals?.verification_status === 'verified';
              const isExpired = isDeadlinePassed(topJob);
              const isExpanded = expandedMatchJobIds.has(topJob.id);
              const reasonsList = topJob.matchBreakdown?.reasons || [];
              const positiveReasons = reasonsList.filter((r) => r.type === 'positive');

              return (
                <div
                  key={topJob.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-[#082F63]/40 hover:shadow-sm transition-all"
                >
                  <div>
                    {/* Header: Score & Hospital */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <SmartMatchBadge
                            match={topJob.matchBreakdown}
                            jobTitle={topJob.job_title}
                            size="sm"
                          />
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm mt-2 line-clamp-1">{topJob.job_title}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-semibold text-primary-700 truncate">{hospName}</span>
                          <VerifiedHospitalBadge
                            isVerified={isHospVerified}
                            verificationStatus={topJob.hospitals?.verification_status}
                            size="xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Job Details Meta */}
                    <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                        <Stethoscope className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                        <span className="truncate">{topJob.department}</span>
                      </div>
                      {topJob.location && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{topJob.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                        <IndianRupee className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>{formatSalaryDisplay(topJob).formattedFull}</span>
                      </div>
                      {topJob.experience_required != null && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{topJob.experience_required}+ yrs experience</span>
                        </div>
                      )}
                      {topJob.shift && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{formatShiftDisplay(topJob).shift || formatShiftDisplay(topJob).summaryText}</span>
                        </div>
                      )}

                      {/* Benefits badges */}
                      <div className="pt-1">
                        <JobBenefitsBadgesRow job={topJob} size="sm" />
                      </div>
                    </div>

                    {/* "Why this matches you" Accordion */}
                    {reasonsList.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => toggleExpandMatch(topJob.id)}
                          className="w-full flex items-center justify-between text-left text-xs font-semibold text-primary-700 hover:text-primary-800"
                        >
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-amber-500" />
                            Why this matches you ({positiveReasons.length})
                          </span>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>

                        {isExpanded ? (
                          <div className="mt-2 space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                            {reasonsList.slice(0, 5).map((r, idx) => (
                              <div key={idx} className="flex items-start gap-1.5 text-[11px]">
                                {r.type === 'positive' ? (
                                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                                ) : (
                                  <span className="text-slate-400 font-bold shrink-0">○</span>
                                )}
                                <span className={r.type === 'positive' ? 'text-slate-800 font-medium' : 'text-slate-500'}>
                                  {r.text}
                                </span>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => setBreakdownModalMatch({ match: topJob.matchBreakdown, jobTitle: topJob.job_title })}
                              className="text-[10px] text-blue-600 hover:underline pt-1 block font-semibold"
                            >
                              View full 5-pillar scoring formula →
                            </button>
                          </div>
                        ) : (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {positiveReasons.slice(0, 2).map((r, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800"
                              >
                                <Check className="h-2.5 w-2.5 text-emerald-600" /> {r.text}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      Last date: {getApplicationDeadline(topJob)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setJobForDetailModal(topJob)}
                        className="text-xs px-2 py-1 h-auto"
                      >
                        View Job
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleInitiateApply(topJob)}
                        disabled={appliedJobIds.has(topJob.id) || isExpired}
                        className="text-xs px-2.5 py-1 h-auto"
                      >
                        {appliedJobIds.has(topJob.id) ? 'Applied' : isExpired ? 'Closed' : 'Quick Apply'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Find Jobs Search & Smart Filtering Controls */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by job title, department, hospital, city, or skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Sort:</span>
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="w-48 text-xs font-medium">
              <option value="match">⚡ Best Match (Smart Match)</option>
              <option value="recent">Most Recent</option>
              <option value="salary">Salary: High to Low</option>
              <option value="deadline">Deadline: Ending Soon</option>
            </Select>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <Select value={filterMatchScore} onChange={(e) => setFilterMatchScore(e.target.value as any)}>
            <option value="all">⚡ All Match Levels</option>
            <option value="90">⚡ 90%+ Top Match</option>
            <option value="80">⚡ 80%+ Great Match</option>
            <option value="70">⚡ 70%+ Good Match</option>
          </Select>

          <Select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="all">All Departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>

          <Select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
            <option value="all">All Locations</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>

          <Select value={filterExp} onChange={(e) => setFilterExp(e.target.value as any)}>
            <option value="all">All Experience</option>
            <option value="fresher">Fresher (0–1 yr)</option>
            <option value="mid">Mid Level (2–4 yrs)</option>
            <option value="senior">Senior (5+ yrs)</option>
          </Select>

          <Select value={filterShift} onChange={(e) => setFilterShift(e.target.value as any)}>
            <option value="all">All Shifts</option>
            <option value="day">Day Shift</option>
            <option value="night">Night Shift</option>
            <option value="flexible">Rotational / Flexible</option>
          </Select>

          <Select value={filterSalary} onChange={(e) => setFilterSalary(e.target.value as any)}>
            <option value="all">All Salary Ranges</option>
            <option value="25000">₹25,000+ / mo</option>
            <option value="40000">₹40,000+ / mo</option>
            <option value="60000">₹60,000+ / mo</option>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500 font-medium">
        <p>{filteredAndSortedJobs.length} {filteredAndSortedJobs.length === 1 ? 'job' : 'jobs'} available</p>
        {sortBy === 'match' && profileCompleteness.isReadyForMatching && (
          <span className="text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-600" /> Sorted by 5-Pillar Smart Match
          </span>
        )}
      </div>

      {/* 4. Jobs Grid List */}
      {filteredAndSortedJobs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#082F63] mb-3">
            <Briefcase className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No matching jobs found</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1">
            Try adjusting your search criteria, department, or shift preferences to discover more clinical positions.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSearch('');
                setFilterDept('all');
                setFilterLocation('all');
                setFilterExp('all');
                setFilterShift('all');
                setFilterSalary('all');
                setFilterMatchScore('all');
              }}
              className="text-xs"
            >
              Reset Filters
            </Button>
            {!profileCompleteness.isReadyForMatching && (
              <Button
                size="sm"
                onClick={onNavigateProfile}
                className="text-xs bg-[#082F63] hover:bg-[#0c4389]"
              >
                Complete Profile for Matches
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredAndSortedJobs.map((job) => {
            const hospitalName = job.hospitals?.hospital_name || job.hospitals?.name || 'Hospital Partner';
            const isHospVerified = job.hospitals?.verification_status === 'verified';
            const deadlineStr = getApplicationDeadline(job);
            const expired = isDeadlinePassed(job);
            const isExpanded = expandedMatchJobIds.has(job.id);
            const reasonsList = job.matchBreakdown?.reasons || [];
            const positiveReasons = reasonsList.filter((r) => r.type === 'positive');

            return (
              <Card key={job.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  {/* Top card header */}
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-slate-900 text-base">{job.job_title}</h3>
                        {job.matchScore > 0 && job.matchBreakdown?.isCalculable && (
                          <SmartMatchBadge
                            match={job.matchBreakdown}
                            jobTitle={job.job_title}
                            size="sm"
                          />
                        )}
                      </div>

                      {/* Prominent Hospital Name Display */}
                      <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-primary-700">
                        <Building2 className="h-4 w-4 shrink-0 text-primary-600" />
                        <span className="truncate">{hospitalName}</span>
                        <VerifiedHospitalBadge
                          isVerified={isHospVerified}
                          verificationStatus={job.hospitals?.verification_status}
                          size="xs"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => toggleSave(job.id)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 transition-colors"
                      title={savedJobIds.has(job.id) ? 'Unsave' : 'Save job'}
                    >
                      {savedJobIds.has(job.id) ? <BookmarkCheck className="h-5 w-5 text-primary-600" /> : <Bookmark className="h-5 w-5" />}
                    </button>
                  </div>

                  {/* Metadata Fields */}
                  <div className="space-y-2 text-sm text-slate-600 mt-2">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>{job.department}</span>
                    </div>
                    {job.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                        <span>{job.location}</span>
                      </div>
                    )}
                    {job.experience_required != null && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-slate-400 shrink-0" />
                        <span>{job.experience_required}+ yrs experience</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 font-semibold text-emerald-700">
                      <IndianRupee className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{formatSalaryDisplay(job).formattedFull}</span>
                    </div>
                    {job.shift && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{formatShiftDisplay(job).summaryText}</span>
                      </div>
                    )}

                    {/* Job Benefits Transparency Badges */}
                    <div className="pt-0.5">
                      <JobBenefitsBadgesRow job={job} size="sm" />
                    </div>

                    {/* Last Date to Apply */}
                    <div className="flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-50 rounded-md px-2 py-1 w-fit">
                      <Calendar className="h-3.5 w-3.5 text-amber-600" /> Last date: {deadlineStr}
                    </div>

                    {job.required_skills && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {job.required_skills.split(',').slice(0, 3).map((s, i) => (
                          <Badge key={i} color="teal">{s.trim()}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* "Why this matches you" Accordion */}
                  {job.matchBreakdown?.isCalculable && reasonsList.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => toggleExpandMatch(job.id)}
                        className="w-full flex items-center justify-between text-left text-xs font-semibold text-primary-700 hover:text-primary-800"
                      >
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-amber-500" />
                          Why this matches you ({positiveReasons.length})
                        </span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                          {reasonsList.slice(0, 5).map((r, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-[11px]">
                              {r.type === 'positive' ? (
                                <span className="text-emerald-600 font-bold shrink-0">✓</span>
                              ) : (
                                <span className="text-slate-400 font-bold shrink-0">○</span>
                              )}
                              <span className={r.type === 'positive' ? 'text-slate-800 font-medium' : 'text-slate-500'}>
                                {r.text}
                              </span>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setBreakdownModalMatch({ match: job.matchBreakdown, jobTitle: job.job_title })}
                            className="text-[10px] text-blue-600 hover:underline pt-1 block font-semibold"
                          >
                            View transparent scoring formula →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setJobForDetailModal(job)}
                      className="text-xs px-2 py-1 h-auto"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> View Details
                    </Button>
                    {job.accommodation_available && <Badge color="green"><HomeIcon className="h-3 w-3" /> Housing</Badge>}
                    {expired && <Badge color="red">Deadline Closed</Badge>}
                  </div>

                  {appliedJobIds.has(job.id) ? (
                    <Badge color="green"><CheckCircle2 className="h-3 w-3" /> Applied</Badge>
                  ) : expired ? (
                    <Button size="sm" variant="ghost" disabled>
                      Closed
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => handleInitiateApply(job)}>
                      <Send className="h-3.5 w-3.5" /> Apply
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 5. Job Detail Modal with Signature Match Panel for logged-in nurse */}
      {jobForDetailModal && (
        <Modal
          onClose={() => setJobForDetailModal(null)}
          title="Nursing Position Details"
          size="lg"
        >
          <div className="space-y-4">
            {/* Header info */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{jobForDetailModal.job_title}</h3>
                  <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-primary-700">
                    <Building2 className="h-4 w-4 text-primary-600" />
                    <span>{jobForDetailModal.hospitals?.hospital_name || jobForDetailModal.hospitals?.name}</span>
                    <VerifiedHospitalBadge
                      isVerified={jobForDetailModal.hospitals?.verification_status === 'verified'}
                      verificationStatus={jobForDetailModal.hospitals?.verification_status}
                      size="xs"
                      showUnverifiedState={true}
                    />
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleSave(jobForDetailModal.id)}
                >
                  {savedJobIds.has(jobForDetailModal.id) ? 'Saved' : 'Save Job'}
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
                <span className="flex items-center gap-1 font-medium text-slate-800">
                  <Stethoscope className="h-3.5 w-3.5 text-teal-600" /> {jobForDetailModal.department}
                </span>
                {jobForDetailModal.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" /> {jobForDetailModal.location}
                  </span>
                )}
                <span className="flex items-center gap-1 font-bold text-emerald-700">
                  <IndianRupee className="h-3.5 w-3.5 text-emerald-600" /> {formatSalaryDisplay(jobForDetailModal).formattedFull}
                </span>
                <span className="flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                  <Calendar className="h-3.5 w-3.5 text-amber-600" /> Deadline: {getApplicationDeadline(jobForDetailModal)}
                </span>
              </div>
            </div>

            {/* 1. Signature Match Panel for logged-in nurse */}
            {jobForDetailModal.matchBreakdown && (
              <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/80 via-indigo-50/30 to-white p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#082F63] px-3 py-1 text-xs font-black text-amber-300">
                        ⚡ {jobForDetailModal.matchScore}% Match
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#082F63]">
                        {jobForDetailModal.matchBreakdown.tierLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Calculated from your clinical department, experience, location, shift, and compensation expectations.
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBreakdownModalMatch({ match: jobForDetailModal.matchBreakdown, jobTitle: jobForDetailModal.job_title })}
                    className="text-xs font-semibold text-blue-700 border-blue-300 hover:bg-blue-100 shrink-0"
                  >
                    View Score Breakdown
                  </Button>
                </div>

                {/* Match criteria reasons */}
                {jobForDetailModal.matchBreakdown.reasons.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Why this matches you:</h5>
                    <div className="grid sm:grid-cols-2 gap-1.5">
                      {jobForDetailModal.matchBreakdown.reasons.map((r, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-xs">
                          {r.type === 'positive' ? (
                            <span className="text-emerald-600 font-bold shrink-0">✓</span>
                          ) : (
                            <span className="text-slate-400 font-bold shrink-0">○</span>
                          )}
                          <span className={r.type === 'positive' ? 'text-slate-800 font-medium' : 'text-slate-500'}>
                            {r.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. Real Salary & Shift Transparency Section */}
            <CompensationAndWorkDetailsSection job={jobForDetailModal} />

            {/* 3. Before You Apply & Deadline Checklist */}
            <BeforeYouApplyBanner job={jobForDetailModal} />

            {/* 4. Hospital Credibility Card ("About This Hospital") */}
            <HospitalCredibilityCard
              hospital={jobForDetailModal.hospitals}
              hospitalId={jobForDetailModal.hospital_id}
            />

            {/* 5. Clinical Specifications */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                <span className="text-slate-400 block uppercase tracking-wider font-semibold text-[10px]">Experience Required</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">{jobForDetailModal.experience_required != null ? `${jobForDetailModal.experience_required}+ Years` : 'Fresher Welcome'}</span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                <span className="text-slate-400 block uppercase tracking-wider font-semibold text-[10px]">Qualification</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">{jobForDetailModal.qualification_required || 'GNM / B.Sc Nursing'}</span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                <span className="text-slate-400 block uppercase tracking-wider font-semibold text-[10px]">Shift Schedule</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">{jobForDetailModal.shift || 'General / Rotational'}</span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                <span className="text-slate-400 block uppercase tracking-wider font-semibold text-[10px]">Accommodation</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">{jobForDetailModal.accommodation_available ? 'Housing Provided' : 'Not Provided'}</span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                <span className="text-slate-400 block uppercase tracking-wider font-semibold text-[10px]">Vacancies</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">{jobForDetailModal.vacancies} {jobForDetailModal.vacancies === 1 ? 'Opening' : 'Openings'}</span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                <span className="text-slate-400 block uppercase tracking-wider font-semibold text-[10px]">Status</span>
                <span className="font-bold text-emerald-700 text-sm mt-0.5 block">{jobForDetailModal.status === 'active' || jobForDetailModal.status === 'published' ? 'Active / Hiring' : jobForDetailModal.status}</span>
              </div>
            </div>

            {/* 6. Required Skills */}
            {jobForDetailModal.required_skills && (
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Required Clinical Skills:</span>
                <div className="flex flex-wrap gap-1.5">
                  {jobForDetailModal.required_skills.split(',').map((s, i) => (
                    <Badge key={i} color="teal">{s.trim()}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 7. Description */}
            {jobForDetailModal.job_description && (
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Job Description & Responsibilities:</span>
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
                  {jobForDetailModal.job_description}
                </div>
              </div>
            )}

            {/* 8. Trust Summary Guarantee */}
            <TrustSummaryBlock
              hospitalVerified={jobForDetailModal.hospitals?.verification_status === 'verified'}
              credentialsVerified={true}
              hasSalaryTransparency={Boolean(jobForDetailModal.salary_min || jobForDetailModal.salary_max)}
              hasShiftTransparency={Boolean(jobForDetailModal.shift || jobForDetailModal.duty_hours)}
            />

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setJobForDetailModal(null)}>
                Close
              </Button>

              {appliedJobIds.has(jobForDetailModal.id) ? (
                <Badge color="green" className="py-1 px-3 text-xs">
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Application Submitted
                </Badge>
              ) : isDeadlinePassed(jobForDetailModal) ? (
                <Button disabled variant="outline">Deadline Passed</Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => {
                    handleInitiateApply(jobForDetailModal);
                  }}
                >
                  <Send className="h-4 w-4 mr-1.5" /> Apply for this Role
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* 6. Transparent 5-Pillar Score Breakdown Modal */}
      {breakdownModalMatch && (
        <SmartMatchBreakdownModal
          match={breakdownModalMatch.match}
          jobTitle={breakdownModalMatch.jobTitle}
          onClose={() => setBreakdownModalMatch(null)}
        />
      )}

      {/* 7. Incomplete Profile & Mandatory Documents Alert Modal */}
      {showIncompleteModal && (
        <Modal onClose={() => setShowIncompleteModal(false)} title="Profile & Documents Required to Apply">
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-4 text-amber-900 border border-amber-200">
              <AlertCircle className="h-6 w-6 text-amber-600 shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-amber-950">100% Profile & Mandatory Documents Required</h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  To ensure clinical safety and regulatory compliance, your profile must be 100% complete with all 4 mandatory verification documents uploaded before submitting applications.
                </p>
              </div>
            </div>

            {/* Mandatory Documents Checklist */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Required Documents ({profileCompleteness.mandatoryDocsStatus.filter((d) => d.uploaded).length}/4 Uploaded)
                </h5>
                <span className="text-xs font-bold text-primary-700">
                  {profileCompleteness.percentage}% Total Completion
                </span>
              </div>
              <div className="grid gap-2">
                {profileCompleteness.mandatoryDocsStatus.map((doc) => (
                  <div key={doc.key} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                    <span className="font-medium text-slate-800 flex items-center gap-2">
                      {doc.uploaded ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
                      )}
                      {doc.label}
                    </span>
                    <Badge color={doc.uploaded ? 'green' : 'red'}>
                      {doc.uploaded ? 'Uploaded ✓' : 'Missing ❌'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {profileCompleteness.missingFields.length > 0 && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Missing profile details: </span>
                {profileCompleteness.missingFields.map((f) => f.label).join(', ')}
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setShowIncompleteModal(false)}>Close</Button>
              {profileCompleteness.mandatoryDocsStatus.some((d) => !d.uploaded) && (
                <Button variant="outline" onClick={() => { setShowIncompleteModal(false); onNavigateDocuments(); }}>
                  <FileUp className="h-4 w-4 mr-1.5" /> Upload Missing Documents
                </Button>
              )}
              {profileCompleteness.missingFields.length > 0 && (
                <Button onClick={() => { setShowIncompleteModal(false); onNavigateProfile(); }}>
                  Complete Profile Details
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* 8. 1-Click Fast Apply Modal */}
      {selectedJob && (
        <Modal onClose={() => setSelectedJob(null)} title="Apply for Position">
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900 text-base">{selectedJob.job_title}</h3>
              <p className="mt-1 text-sm font-semibold text-primary-700">
                {selectedJob.hospitals?.hospital_name || selectedJob.hospitals?.name} — {selectedJob.department}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                {selectedJob.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedJob.location}</span>}
                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                  <IndianRupee className="h-3 w-3" /> {formatSalaryDisplay(selectedJob).formattedFull}
                </span>
                {selectedJob.shift && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatShiftDisplay(selectedJob).shift || formatShiftDisplay(selectedJob).summaryText}</span>}
                <span className="flex items-center gap-1 text-amber-700 font-medium"><Calendar className="h-3 w-3" /> Last Date: {getApplicationDeadline(selectedJob)}</span>
              </div>
              {selectedJob.job_description && <p className="mt-2 text-sm text-slate-600 line-clamp-3">{selectedJob.job_description}</p>}
            </div>

            <Textarea
              label="Cover message (optional)"
              value={coverMessage}
              onChange={(e) => setCoverMessage(e.target.value)}
              placeholder="Tell the hospital why you're a great fit for this nursing position..."
              rows={3}
            />

            {applyError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{applyError}</div>}

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setSelectedJob(null)}>Cancel</Button>
              <Button onClick={handleApply} disabled={applying}>{applying ? 'Submitting...' : 'Submit Application'}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============ APPLICATION STATUS TRACKER ============
export function ApplicationStatusTracker({
  status,
  hasCompletedInterview,
}: {
  status: string;
  hasCompletedInterview?: boolean;
}) {
  const steps = [
    { key: 'applied', label: 'Applied' },
    { key: 'shortlisted', label: 'Shortlisted' },
    { key: 'interview_scheduled', label: 'Interview Scheduled' },
    { key: 'interview_completed', label: 'Interview Completed' },
    { key: 'selected', label: 'Selected' },
  ];

  const isRejected = status === 'rejected' || status === 'withdrawn';

  const getStepProgress = (st: string) => {
    switch (st) {
      case 'applied':
      case 'pending':
      case 'under_review':
        return 0;
      case 'shortlisted':
        return 1;
      case 'interview_scheduled':
        return hasCompletedInterview ? 3 : 2;
      case 'interview_completed':
        return 3;
      case 'selected':
      case 'joined':
      case 'accepted':
        return 4;
      case 'rejected':
      case 'withdrawn':
        return -1;
      default:
        return 0;
    }
  };

  const currentIdx = getStepProgress(status);

  if (isRejected) {
    return (
      <div className="mt-3 rounded-lg border border-red-200 bg-red-50/60 p-3 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2 text-red-700 font-semibold">
          <XCircle className="h-4 w-4 text-red-600" />
          <span>Application Status: Declined / Not Selected</span>
        </div>
        <Badge color="red">Rejected</Badge>
      </div>
    );
  }

  const statusLabel =
    status === 'selected' || status === 'joined'
      ? 'Selected / Offer Extended'
      : status === 'interview_completed' || (status === 'interview_scheduled' && hasCompletedInterview)
      ? 'Interview Completed'
      : status.replace(/_/g, ' ');

  return (
    <div className="mt-4 pt-3 border-t border-slate-100">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
        <span className="flex items-center gap-1.5 text-slate-600">
          <Clock className="h-3.5 w-3.5 text-primary-600" /> Progress Status
        </span>
        <span className="text-primary-700 font-bold capitalize">
          {statusLabel}
        </span>
      </div>

      <div className="relative flex items-center justify-between px-2 pt-1 pb-2">
        {/* Background Connecting line */}
        <div className="absolute left-6 right-6 top-4.5 h-1 bg-slate-200 -z-0 rounded-full" />
        {/* Active Filled line */}
        <div
          className="absolute left-6 top-4.5 h-1 bg-emerald-500 transition-all duration-500 -z-0 rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, (currentIdx / (steps.length - 1)) * 88))}%` }}
        />

        {steps.map((step, idx) => {
          const isDone = currentIdx > idx || (idx === steps.length - 1 && currentIdx >= idx);
          const isCurrent = currentIdx === idx && !isDone;
          const isPending = currentIdx < idx;

          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all shadow-xs',
                  isDone && 'bg-emerald-600 text-white',
                  isCurrent && 'bg-primary-600 text-white ring-4 ring-primary-100 scale-110',
                  isPending && 'bg-white border-2 border-slate-300 text-slate-400'
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </div>
              <span
                className={cn(
                  'mt-1.5 text-[11px] text-center whitespace-nowrap hidden sm:inline-block font-medium',
                  isDone ? 'text-emerald-700 font-bold' : isCurrent ? 'text-primary-700 font-bold' : 'text-slate-400'
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ MY APPLICATIONS ============
function MyApplications({
  initialFilter = 'all',
  nurseProfile,
  nurseBasicProfile,
}: {
  initialFilter?: string;
  nurseProfile: NurseProfile | null;
  nurseBasicProfile: Profile | null;
}) {
  const { user } = useAuth();
  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter);

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('applications')
        .select('*, jobs(*, hospitals(id, hospital_name, name, city, state, address, verification_status)), profiles(id, full_name, profile_photo, email, phone, specialty, city, state), interviews(*)')
        .eq('nurse_id', user!.id)
        .not('job_id', 'is', null)
        .order('created_at', { ascending: false });
      setApplications(data as ApplicationWithJob[] || []);
      setLoading(false);
    }
    load();
  }, [user]);

  const filtered = filter === 'all'
    ? applications
    : filter === 'selected'
      ? applications.filter((a) => a.status === 'selected' || a.status === 'joined')
      : filter === 'interview_completed'
        ? applications.filter((a) => a.status === 'interview_completed' || ((a as any).interviews && ((a as any).interviews as any[]).some((iv) => iv.status === 'completed')))
        : filter === 'interview_scheduled'
          ? applications.filter((a) => a.status === 'interview_scheduled' && !((a as any).interviews && ((a as any).interviews as any[]).some((iv) => iv.status === 'completed')))
          : applications.filter((a) => a.status === filter);

  const statusConfig: Record<string, { color: 'amber' | 'blue' | 'green' | 'red' | 'slate' | 'teal'; label: string }> = {
    applied: { color: 'blue', label: 'Applied' },
    under_review: { color: 'amber', label: 'Under Review' },
    shortlisted: { color: 'teal', label: 'Shortlisted' },
    interview_scheduled: { color: 'blue', label: 'Interview Scheduled' },
    interview_completed: { color: 'teal', label: 'Interview Completed' },
    selected: { color: 'green', label: 'Selected ✓' },
    joined: { color: 'green', label: 'Joined Staff ✓' },
    rejected: { color: 'red', label: 'Rejected' },
    pending: { color: 'amber', label: 'Pending' },
    accepted: { color: 'green', label: 'Accepted' },
    withdrawn: { color: 'slate', label: 'Withdrawn' },
  };

  if (loading) return <Spinner className="py-20" />;

  const filterOptions = ['all', 'applied', 'shortlisted', 'interview_scheduled', 'interview_completed', 'selected', 'joined', 'rejected'];

  const nurseTarget: NurseMatchProfile = {
    id: user?.id,
    nurse_id: user?.id,
    full_name: nurseBasicProfile?.full_name,
    qualification: nurseProfile?.qualification,
    specialty: nurseBasicProfile?.specialty || nurseProfile?.departments,
    departments: nurseProfile?.departments || nurseBasicProfile?.specialty,
    total_experience: nurseProfile?.total_experience ?? nurseBasicProfile?.years_experience,
    years_experience: nurseBasicProfile?.years_experience ?? nurseProfile?.total_experience,
    preferred_location: nurseProfile?.preferred_location || nurseBasicProfile?.city,
    city: nurseBasicProfile?.city,
    state: nurseBasicProfile?.state,
    expected_salary: nurseProfile?.expected_salary,
    shift_preference: nurseProfile?.shift_preference,
    accommodation_required: nurseProfile?.accommodation_required,
    availability: nurseProfile?.availability,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              filter === f ? 'bg-primary-600 text-white font-semibold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {f === 'all' ? 'All Applications' : f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<FileText className="h-7 w-7" />} title="No applications found" description="No applications match the selected filter." />
      ) : (
        <div className="space-y-4">
          {filtered.map((app) => {
            const hasCompletedInterview =
              app.status === 'interview_completed' ||
              Boolean((app as any).interviews && ((app as any).interviews as any[]).some((iv) => iv.status === 'completed'));
            
            const isSelected = app.status === 'selected' || app.status === 'joined';
            
            const effectiveStatus = isSelected
              ? app.status
              : hasCompletedInterview
              ? 'interview_completed'
              : app.status;

            const sc = statusConfig[effectiveStatus] || statusConfig[app.status] || statusConfig.applied;
            const job = app.jobs;
            const hospitalName = job?.hospitals?.hospital_name || job?.hospitals?.name || 'Hospital Partner';

            const matchBreakdown = job ? calculateSmartMatch(nurseTarget, job) : null;

            return (
              <Card key={app.id} className={cn('flex flex-col gap-3', isSelected && 'border-emerald-300 bg-emerald-50/20')}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-bold text-slate-900 text-base">{job?.job_title || 'Position'}</h3>
                      <Badge color={sc.color}>{sc.label}</Badge>
                      {matchBreakdown && (
                        <SmartMatchBadge
                          match={matchBreakdown}
                          jobTitle={job?.job_title}
                          size="sm"
                        />
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <Building2 className="h-3.5 w-3.5 text-primary-600" />
                        {hospitalName}
                        <VerifiedHospitalBadge
                          isVerified={job?.hospitals?.verification_status === 'verified'}
                          verificationStatus={job?.hospitals?.verification_status}
                          size="xs"
                        />
                      </span>
                      <span className="flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5 text-slate-400" /> {job?.department}</span>
                      {job?.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {job.location}</span>}
                    </div>
                    {app.cover_message && <p className="mt-2 text-sm text-slate-500 italic">"{app.cover_message}"</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-slate-400">Applied on</div>
                    <div className="text-sm font-medium text-slate-700">{formatDate(app.created_at)}</div>
                  </div>
                </div>

                {/* Visual Status Tracker */}
                <ApplicationStatusTracker
                  status={app.status}
                  hasCompletedInterview={hasCompletedInterview}
                />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ SAVED JOBS ============
function SavedJobs({
  onBrowse,
  nurseProfile,
  nurseBasicProfile,
}: {
  onBrowse: () => void;
  nurseProfile: NurseProfile | null;
  nurseBasicProfile: Profile | null;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [saved, setSaved] = useState<SavedJobWithJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('saved_jobs')
        .select('*, jobs(*, hospitals(id, hospital_name, name, city, state, verification_status))')
        .eq('nurse_id', user!.id)
        .order('created_at', { ascending: false });
      setSaved(data as any || []);
      setLoading(false);
    }
    load();
  }, [user]);

  async function removeSaved(jobId: string) {
    const { error } = await supabase.from('saved_jobs').delete().eq('nurse_id', user!.id).eq('job_id', jobId);
    if (error) { showToast('error', 'Failed to remove saved job'); return; }
    setSaved(saved.filter((s) => s.job_id !== jobId));
    showToast('success', 'Job removed from saved');
  }

  if (loading) return <Spinner className="py-20" />;

  const nurseTarget: NurseMatchProfile = {
    id: user?.id,
    nurse_id: user?.id,
    full_name: nurseBasicProfile?.full_name,
    qualification: nurseProfile?.qualification,
    specialty: nurseBasicProfile?.specialty || nurseProfile?.departments,
    departments: nurseProfile?.departments || nurseBasicProfile?.specialty,
    total_experience: nurseProfile?.total_experience ?? nurseBasicProfile?.years_experience,
    years_experience: nurseBasicProfile?.years_experience ?? nurseProfile?.total_experience,
    preferred_location: nurseProfile?.preferred_location || nurseBasicProfile?.city,
    city: nurseBasicProfile?.city,
    state: nurseBasicProfile?.state,
    expected_salary: nurseProfile?.expected_salary,
    shift_preference: nurseProfile?.shift_preference,
    accommodation_required: nurseProfile?.accommodation_required,
    availability: nurseProfile?.availability,
  };

  if (saved.length === 0) {
    return (
      <EmptyState
        icon={<Bookmark className="h-7 w-7" />}
        title="No saved jobs"
        description="Save jobs you're interested in to find them quickly later."
        action={<Button onClick={onBrowse}>Browse Jobs</Button>}
      />
    );
  }

  return (
    <div className="space-y-3">
      {saved.map((s) => {
        const job = s.jobs;
        const hospitalName = job?.hospitals?.hospital_name || job?.hospitals?.name || 'Hospital';
        const matchBreakdown = job ? calculateSmartMatch(nurseTarget, job) : null;

        return (
          <Card key={s.id} className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-900">{job?.job_title}</h3>
                {matchBreakdown && (
                  <SmartMatchBadge
                    match={matchBreakdown}
                    jobTitle={job?.job_title}
                    size="sm"
                  />
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <Building2 className="h-3.5 w-3.5 text-primary-600" />
                  {hospitalName}
                  <VerifiedHospitalBadge
                    isVerified={job?.hospitals?.verification_status === 'verified'}
                    verificationStatus={job?.hospitals?.verification_status}
                    size="xs"
                  />
                </span>
                <span className="flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" /> {job?.department}</span>
                {job?.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location}</span>}
              </div>
            </div>
            <button
              onClick={() => removeSaved(s.job_id)}
              className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Remove from saved"
            >
              <BookmarkCheck className="h-5 w-5" />
            </button>
          </Card>
        );
      })}
    </div>
  );
}

// ============ MY INTERVIEWS ============
function MyInterviews({ onNavigateNotifications }: { onNavigateNotifications: () => void }) {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<InterviewWithApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'upcoming' | 'previous'>('upcoming');

  const loadInterviews = useCallback(async () => {
    const { data } = await supabase
      .from('interviews')
      .select('*, applications!inner(*, jobs!inner(id, job_title, department, hospitals(id, hospital_name, name, city, state)))')
      .eq('applications.nurse_id', user!.id)
      .order('interview_date', { ascending: true });
    setInterviews(data as InterviewWithApplication[] || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadInterviews();
  }, [loadInterviews]);

  if (loading) return <Spinner className="py-20" />;

  const upcomingInterviews = interviews.filter((iv) => iv.status === 'scheduled');
  const previousInterviews = interviews.filter((iv) => iv.status === 'completed' || iv.status === 'cancelled' || iv.status === 'rescheduled');

  const typeIcon: Record<string, ReactNode> = {
    in_person: <MapIcon className="h-4 w-4" />,
    video: <Video className="h-4 w-4" />,
    phone: <Phone className="h-4 w-4" />,
  };

  const displayedInterviews = subTab === 'upcoming' ? upcomingInterviews : previousInterviews;

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setSubTab('upcoming')}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2',
              subTab === 'upcoming' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            <span>Upcoming Interviews</span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs', subTab === 'upcoming' ? 'bg-primary-700 text-white' : 'bg-slate-200 text-slate-700')}>
              {upcomingInterviews.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('previous')}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2',
              subTab === 'previous' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            <span>Previous Interviews</span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs', subTab === 'previous' ? 'bg-primary-700 text-white' : 'bg-slate-200 text-slate-700')}>
              {previousInterviews.length}
            </span>
          </button>
        </div>
      </div>

      {displayedInterviews.length === 0 ? (
        <EmptyState
          icon={<Video className="h-7 w-7" />}
          title={subTab === 'upcoming' ? 'No upcoming interviews' : 'No previous interviews'}
          description={subTab === 'upcoming'
            ? 'When a hospital schedules an interview with you, it will appear here.'
            : 'Completed and past interviews will appear in this section.'
          }
        />
      ) : (
        <div className="space-y-3">
          {displayedInterviews.map((iv) => {
            const hospitalName = iv.applications.jobs?.hospitals?.hospital_name || iv.applications.jobs?.hospitals?.name || 'Hospital';

            return (
              <Card key={iv.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{iv.applications.jobs?.job_title}</h3>
                      <Badge color={iv.status === 'scheduled' ? 'blue' : iv.status === 'completed' ? 'green' : iv.status === 'cancelled' ? 'red' : 'amber'}>
                        {iv.status}
                      </Badge>
                    </div>

                    {/* Prominent Hospital Name */}
                    <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                      <Building2 className="h-4 w-4 text-primary-600" />
                      <span>{hospitalName}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                      <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-slate-400" /> {formatDate(iv.interview_date)}</span>
                      <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-slate-400" /> {iv.interview_time}</span>
                      <span className="flex items-center gap-1.5 capitalize">{typeIcon[iv.interview_type]} {iv.interview_type.replace('_', ' ')}</span>
                      {iv.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-slate-400" /> {iv.location}</span>}
                    </div>

                    {iv.meeting_link && (
                      <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline">
                        <Video className="h-3.5 w-3.5" /> Join meeting link
                      </a>
                    )}
                    {iv.notes && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{iv.notes}</p>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Notifications Button below Interview section */}
      <div className="pt-4 border-t border-slate-200 flex justify-center">
        <Button variant="outline" onClick={onNavigateNotifications} className="gap-2">
          <Bell className="h-4 w-4 text-primary-600" /> View Interview Notifications & Alerts
        </Button>
      </div>
    </div>
  );
}

// ============ NURSE PROFILE ============
function NurseProfileTab({ onProfileUpdated }: { onProfileUpdated?: () => void }) {
  const { profile, user, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [nurseProfile, setNurseProfile] = useState<NurseProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Auto populate from registration / auth profile
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [city, setCity] = useState(profile?.city || '');
  const [state, setState] = useState(profile?.state || 'Haryana');
  const [bio, setBio] = useState(profile?.bio || '');

  const [qualification, setQualification] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [regAuthority, setRegAuthority] = useState('');
  const [totalExp, setTotalExp] = useState('');
  const [prevHospital, setPrevHospital] = useState('');
  const [departments, setDepartments] = useState('');
  const [preferredLocation, setPreferredLocation] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [shiftPref, setShiftPref] = useState<NurseProfile['shift_preference']>('flexible');
  const [availability, setAvailability] = useState<NurseProfile['availability']>('immediately');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync state if profile changes
  useEffect(() => {
    if (profile) {
      if (profile.full_name) setFullName(profile.full_name);
      if (profile.phone) setPhone(profile.phone);
      if (profile.city) setCity(profile.city);
      if (profile.state) setState(profile.state);
      if (profile.bio) setBio(profile.bio);
    }
  }, [profile]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('nurse_profiles')
        .select('*')
        .eq('nurse_id', user!.id)
        .maybeSingle();

      if (data) {
        const np = data as NurseProfile;
        setNurseProfile(np);
        setQualification(np.qualification || '');
        setRegNumber(np.nursing_registration_number || '');
        setRegAuthority(np.registration_authority || '');
        setTotalExp(np.total_experience?.toString() || '');
        setPrevHospital(np.previous_hospital || '');
        setDepartments(np.departments || '');
        setPreferredLocation(np.preferred_location || '');
        setExpectedSalary(np.expected_salary?.toString() || '');
        setShiftPref(np.shift_preference || 'flexible');
        setAvailability(np.availability || 'immediately');
      }
      setLoading(false);
    }
    load();
  }, [user]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    try {
      const { error: profileErr } = await supabase.from('profiles').update({
        full_name: fullName,
        phone: phone || null,
        city: city || null,
        state: state || null,
        bio: bio || null,
        updated_at: new Date().toISOString(),
      }).eq('id', user!.id);

      if (profileErr) {
        console.warn('Profile update warning:', profileErr);
      }
    } catch (err) {
      console.warn('Profile update catch:', err);
    }

    const npData = {
      nurse_id: user!.id,
      qualification: qualification || null,
      nursing_registration_number: regNumber || null,
      registration_authority: regAuthority || null,
      total_experience: totalExp ? parseInt(totalExp) : null,
      previous_hospital: prevHospital || null,
      departments: departments || null,
      preferred_location: preferredLocation || null,
      expected_salary: expectedSalary ? parseFloat(expectedSalary) : null,
      shift_preference: shiftPref,
      availability: availability,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data: existingNp } = await supabase
        .from('nurse_profiles')
        .select('id')
        .eq('nurse_id', user!.id)
        .maybeSingle();

      if (existingNp) {
        await supabase.from('nurse_profiles').update(npData).eq('nurse_id', user!.id);
      } else {
        await supabase.from('nurse_profiles').insert(npData);
      }
    } catch (err) {
      console.warn('Nurse profile update catch:', err);
    }

    await refreshProfile();
    if (onProfileUpdated) onProfileUpdated();
    setSaving(false);
    setSaved(true);
    showToast('success', 'Nurse profile saved successfully');
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) return <Spinner className="py-20" />;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Dedicated Passport Size Photo Card */}
      <NursePassportPhotoUpload
        profile={profile}
        onPhotoUpdated={refreshProfile}
      />

      <Card>
        <div className="mb-6 flex items-center gap-4">
          <NursePhotoAvatar
            photoUrl={profile?.profile_photo || (profile as any)?.avatar_url}
            name={profile?.full_name}
            size="xl"
            shape="rounded"
          />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{profile?.full_name}</h2>
            <p className="text-sm text-slate-500">{profile?.email}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge color={profile?.verification_status === 'verified' ? 'green' : profile?.verification_status === 'rejected' ? 'red' : 'amber'}>
                <Award className="h-3 w-3" /> {profile?.verification_status || 'pending'}
              </Badge>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700 uppercase tracking-wide">Basic Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
              <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Gurgaon, Chandigarh" />
              <Select label="State" value={state} onChange={(e) => setState(e.target.value)} required>
                {INDIAN_STATES_AND_UTS.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </Select>
              <div className="sm:col-span-2">
                <Textarea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell hospitals about your nursing experience and dedication..." rows={3} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700 uppercase tracking-wide">Professional Details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Qualification"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                required
              >
                <option value="">Select your qualification...</option>
                {NURSING_QUALIFICATIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </Select>
              <Input label="Registration number" value={regNumber} onChange={(e) => setRegNumber(e.target.value)} placeholder="RN-12345" />
              <Input label="Registration authority" value={regAuthority} onChange={(e) => setRegAuthority(e.target.value)} placeholder="INC, State Nursing Council..." />
              <Input label="Total experience (years)" type="number" min={0} value={totalExp} onChange={(e) => setTotalExp(e.target.value)} />
              <Input label="Previous hospital" value={prevHospital} onChange={(e) => setPrevHospital(e.target.value)} />
              <Input label="Departments / Skills" value={departments} onChange={(e) => setDepartments(e.target.value)} placeholder="ICU, ER, OT, Pediatrics..." />
              <Input label="Preferred location" value={preferredLocation} onChange={(e) => setPreferredLocation(e.target.value)} />
              <Input label="Expected salary (monthly ₹)" type="number" min={0} value={expectedSalary} onChange={(e) => setExpectedSalary(e.target.value)} placeholder="50000" />
              <Select label="Shift preference" value={shiftPref || ''} onChange={(e) => setShiftPref(e.target.value as NurseProfile['shift_preference'])}>
                <option value="flexible">Flexible</option>
                <option value="day">Day</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
              </Select>
              <Select label="Availability" value={availability || ''} onChange={(e) => setAvailability(e.target.value as NurseProfile['availability'])}>
                <option value="immediately">Immediately</option>
                <option value="2_weeks">2 weeks notice</option>
                <option value="1_month">1 month notice</option>
                <option value="not_available">Not available</option>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</Button>
            {saved && <span className="text-sm text-emerald-600 animate-fade-in font-medium">✓ Saved successfully</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}

// ============ MY DOCUMENTS ============
function MyDocuments({
  onDocsUpdated,
}: {
  onDocsUpdated?: () => void;
}) {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [docs, setDocs] = useState<NurseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const mandatoryDocTypes: { value: NurseDocument['document_type']; label: string; desc: string }[] = [
    { value: 'qualification', label: 'Qualification Certificate', desc: 'GNM, B.Sc Nursing, Post Basic, or M.Sc Degree/Diploma' },
    { value: 'registration', label: 'Nursing Registration Certificate', desc: 'Valid State Nursing Council or Indian Nursing Council (INC) registration' },
    { value: 'id_proof', label: 'Government ID Proof', desc: 'Aadhaar Card, PAN Card, or Passport' },
    { value: 'passport_photo', label: 'Passport-Size Photo', desc: 'Professional, clear frontal photograph in nurse attire or formal dress' },
  ];

  const additionalDocTypes: { value: NurseDocument['document_type']; label: string }[] = [
    { value: 'experience', label: 'Experience Certificate / Relieving Letter' },
    { value: 'resume', label: 'Detailed Resume / Curriculum Vitae' },
    { value: 'other', label: 'Additional Certifications (BLS, ACLS, etc.)' },
  ];

  async function loadDocs() {
    if (!user) return;
    const { data } = await supabase.from('nurse_documents').select('*').eq('nurse_id', user.id).order('created_at', { ascending: false });
    setDocs(data as NurseDocument[] || []);
    setLoading(false);
  }

  useEffect(() => { loadDocs(); }, [user]);

  async function uploadFile(file: File, docType: NurseDocument['document_type']) {
    if (!user) return;
    setUploadingType(docType);

    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${user.id}/${docType}_${Date.now()}.${ext}`;

    try {
      await supabase.storage
        .from('nurse-documents')
        .upload(fileName, file);
    } catch {}

    const dbDocType = (docType === 'passport_photo' ? 'other' : docType) as NurseDocument['document_type'];

    let { error: dbError } = await supabase.from('nurse_documents').insert({
      nurse_id: user.id,
      document_type: dbDocType,
      file_name: file.name,
      file_url: fileName,
      file_size: file.size,
      mime_type: file.type || 'image/jpeg',
      verification_status: 'pending',
    });

    if (dbError && dbError.message?.includes('document_type_check')) {
      const { error: retryErr } = await supabase.from('nurse_documents').insert({
        nurse_id: user.id,
        document_type: 'other',
        file_name: file.name,
        file_url: fileName,
        file_size: file.size,
        mime_type: file.type || 'image/jpeg',
        verification_status: 'pending',
      });
      dbError = retryErr;
    }

    // Mirror to localStorage so Hospital and Admin portals immediately see the documents across sessions
    try {
      const storageKey = `demo_nurse_docs_${user.id}`;
      const existing = localStorage.getItem(storageKey);
      const parsed: NurseDocument[] = existing ? JSON.parse(existing) : [];
      const newDoc: NurseDocument = {
        id: `doc_${Date.now()}`,
        nurse_id: user.id,
        document_type: docType,
        file_name: file.name,
        file_url: fileName,
        file_size: file.size,
        mime_type: file.type || 'image/jpeg',
        verification_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const filtered = parsed.filter((d) => d.document_type !== docType);
      filtered.push(newDoc);
      localStorage.setItem(storageKey, JSON.stringify(filtered));
    } catch {}

    // If passport photo, also sync to profile photo for seamless experience
    if (docType === 'passport_photo') {
      try {
        const { data: publicUrlData } = supabase.storage.from('nurse-documents').getPublicUrl(fileName);
        const urlToSave = publicUrlData?.publicUrl || fileName;
        await supabase.from('profiles').update({ profile_photo: urlToSave }).eq('id', user.id);
        await refreshProfile();
      } catch {}
    }

    setUploadingType(null);
    if (dbError && !dbError.message?.toLowerCase().includes('failed to fetch')) {
      showToast('error', 'Failed to save document record: ' + dbError.message);
      return;
    }

    showToast('success', `${docType.replace(/_/g, ' ')} uploaded successfully!`);
    await loadDocs();
    if (onDocsUpdated) onDocsUpdated();
  }

  async function deleteDoc(doc: NurseDocument) {
    if (!confirm(`Delete ${doc.file_name}?`)) return;
    try {
      await supabase.storage.from('nurse-documents').remove([doc.file_url]);
    } catch {}
    await supabase.from('nurse_documents').delete().eq('id', doc.id);
    const updated = docs.filter((d) => d.id !== doc.id);
    setDocs(updated);
    showToast('success', 'Document deleted');
    if (onDocsUpdated) onDocsUpdated();
  }

  async function downloadDoc(doc: NurseDocument) {
    const { data } = await supabase.storage.from('nurse-documents').createSignedUrl(doc.file_url, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    } else {
      showToast('info', 'Document file is safely stored for verification.');
    }
  }

  if (loading) return <Spinner className="py-20" />;

  const uploadedDocTypeSet = new Set(docs.map((d) => d.document_type));
  if (profile?.profile_photo || (profile as any)?.avatar_url) {
    uploadedDocTypeSet.add('passport_photo');
  }

  const mandatoryCount = mandatoryDocTypes.filter((dt) => uploadedDocTypeSet.has(dt.value)).length;
  const isAllMandatoryUploaded = mandatoryCount === 4;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Mandatory Verification Documents Card */}
      <Card className={cn('border-2', isAllMandatoryUploaded ? 'border-emerald-300 bg-emerald-50/15' : 'border-amber-300 bg-amber-50/15')}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className={cn('h-5 w-5', isAllMandatoryUploaded ? 'text-emerald-600' : 'text-amber-600')} />
              <h3 className="font-bold text-slate-900 text-base">Mandatory Verification Documents</h3>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              All 4 documents are required to reach 100% profile completion and unlock job applications.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', isAllMandatoryUploaded ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
              {mandatoryCount}/4 Documents Uploaded
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {mandatoryDocTypes.map((dt) => {
            const isUploaded = uploadedDocTypeSet.has(dt.value);
            const docMatch = docs.find((d) => d.document_type === dt.value);

            return (
              <div
                key={dt.value}
                className={cn(
                  'rounded-xl border p-4 transition-all flex flex-col justify-between',
                  isUploaded
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-amber-200 bg-white hover:border-primary-400'
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{dt.label}</h4>
                    <Badge color={isUploaded ? 'green' : 'red'}>
                      {isUploaded ? 'Uploaded ✓' : 'Required ❌'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{dt.desc}</p>
                  {docMatch && (
                    <p className="text-[11px] font-medium text-slate-700 mt-2 truncate">
                      File: {docMatch.file_name}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100 transition-colors">
                    <FileUp className="h-3.5 w-3.5" />
                    <span>{isUploaded ? 'Replace' : 'Upload File'}</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadFile(file, dt.value);
                      }}
                      disabled={uploadingType !== null}
                    />
                  </label>
                  {docMatch && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => downloadDoc(docMatch)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteDoc(docMatch)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {uploadingType && (
          <p className="mt-4 text-xs font-medium text-primary-600 animate-pulse flex items-center gap-2">
            <Spinner className="h-3.5 w-3.5" /> Uploading and saving {uploadingType.replace(/_/g, ' ')}...
          </p>
        )}
      </Card>

      {/* Additional Optional Documents Card */}
      <Card>
        <div className="mb-4">
          <h3 className="font-semibold text-slate-900 text-sm">Additional Documents & Certifications (Optional)</h3>
          <p className="text-xs text-slate-500 mt-1">
            Upload work experience certificates, relieving letters, and CPR/BLS credentials to increase your hiring appeal.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {additionalDocTypes.map((dt) => (
            <label
              key={dt.value}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-slate-300 p-3 transition-colors hover:border-primary-400 hover:bg-primary-50/30"
            >
              <FileUp className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-slate-700 block truncate">{dt.label}</span>
                <span className="text-[10px] text-slate-400">Click to upload</span>
              </div>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file, dt.value);
                }}
                disabled={uploadingType !== null}
              />
            </label>
          ))}
        </div>
      </Card>

      {/* Uploaded Documents History */}
      {docs.length > 0 && (
        <Card>
          <h3 className="font-semibold text-slate-900 text-sm mb-3">All Uploaded Files ({docs.length})</h3>
          <div className="space-y-2.5">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 bg-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                    <FileText className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{doc.file_name}</div>
                    <div className="text-xs text-slate-500 capitalize">{doc.document_type.replace(/_/g, ' ')} • {formatDate(doc.created_at)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={doc.verification_status === 'verified' ? 'green' : doc.verification_status === 'rejected' ? 'red' : 'green'}>
                    {doc.verification_status === 'verified' ? 'Verified ✓' : doc.verification_status === 'rejected' ? 'Rejected ❌' : 'Uploaded ✓'}
                  </Badge>
                  <button onClick={() => downloadDoc(doc)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Download">
                    <Download className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteDoc(doc)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ============ NOTIFICATIONS ============
function MyNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    setNotifications(data as Notification[] || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(notifications.map((n) => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user!.id).eq('is_read', false);
    setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
  }

  if (loading) return <Spinner className="py-20" />;

  if (notifications.length === 0) {
    return <EmptyState icon={<Bell className="h-7 w-7" />} title="No notifications" description="You'll see updates about your applications and interviews here." />;
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Button>
      </div>
      {notifications.map((n) => (
        <Card
          key={n.id}
          className={cn('flex items-start gap-3', !n.is_read && 'border-primary-200 bg-primary-50/30')}
          onClick={() => !n.is_read && markRead(n.id)}
        >
          <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', n.is_read ? 'bg-slate-100 text-slate-400' : 'bg-primary-100 text-primary-600')}>
            <Bell className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-slate-900">{n.title}</h3>
              {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary-500" />}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">{n.message}</p>
            <p className="mt-1 text-xs text-slate-400">{formatDate(n.created_at)}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

