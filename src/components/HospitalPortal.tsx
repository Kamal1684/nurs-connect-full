import { useEffect, useState, useCallback, useMemo, type FormEvent } from 'react';
import {
  Briefcase, Calendar, Clock, IndianRupee, MapPin, Plus, Users,
  Building2, FileText, CheckCircle2, XCircle, Stethoscope, Trash2,
  Video, Phone, MapPin as MapIcon, Award, FileUp, Download,
  Bell, User as UserIcon, Eye, Check, Sparkles, ExternalLink,
  ShieldCheck, AlertCircle, AlertTriangle, ArrowRight, TrendingUp, Mail,
  Pencil, Home, Gift, Utensils, Moon, Sun, RotateCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type {
  Hospital, Job, Application, ApplicationWithNurse,
  HospitalDocument, Notification, NurseDocument, SalaryType, SalaryBasis
} from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  INDIAN_STATES_AND_UTS,
  NURSING_QUALIFICATIONS,
  HOSPITAL_TYPES,
  HEALTHCARE_DEPARTMENTS,
  NURSING_JOB_TITLES,
} from '@/lib/constants';
import { Card, Badge, Button, Input, Select, Spinner, EmptyState, Textarea, useToast, Modal } from '@/components/ui';
import {
  formatCurrency, formatDate, formatDateTime, cn, getInitials,
  formatSalaryDisplay, formatShiftDisplay, getJobBenefitBadges,
  normalizeJob, encodeJobDescription
} from '@/lib/utils';
import { calculateSmartMatch, type NurseMatchProfile } from '@/lib/matching';
import { SmartMatchBadge } from '@/components/SmartMatchBadge';
import { SmartMatchedNursesModal } from '@/components/SmartMatchedNursesModal';
import { JobBenefitsBadgesRow } from '@/components/CompensationAndWorkDetails';
import { NursePhotoAvatar } from '@/components/NursePhotoAvatar';
import { ApplicationStatusTracker } from '@/components/NursePortal';

type Tab = 'jobs' | 'applications' | 'interviews' | 'hired' | 'profile' | 'documents' | 'notifications';

interface HospitalMetrics {
  activeJobs: number;
  upcomingInterviews: number;
  receivedApplications: number;
  todayInterviews: number;
  todayApplications: number;
  hiredNurses: number;
}

export function HospitalPortal({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { user, profile } = useAuth();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [loadingHospital, setLoadingHospital] = useState(true);
  const [metrics, setMetrics] = useState<HospitalMetrics>({
    activeJobs: 0,
    upcomingInterviews: 0,
    receivedApplications: 0,
    todayInterviews: 0,
    todayApplications: 0,
    hiredNurses: 0,
  });

  const loadHospitalMetrics = useCallback(async (hospId: string) => {
    try {
      // 1. Get all jobs for this hospital
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, status')
        .eq('hospital_id', hospId);

      const jobList = (jobs || []) as { id: string; status: string }[];
      const activeJobsCount = jobList.filter((j) => j.status === 'active' || j.status === 'published').length;
      const jobIds = jobList.map((j) => j.id);

      if (jobIds.length === 0) {
        setMetrics({
          activeJobs: 0,
          upcomingInterviews: 0,
          receivedApplications: 0,
          todayInterviews: 0,
          todayApplications: 0,
          hiredNurses: 0,
        });
        return;
      }

      // 2. Get applications for these jobs
      const { data: apps } = await supabase
        .from('applications')
        .select('id, status, created_at')
        .in('job_id', jobIds);

      const appList = (apps || []) as { id: string; status: string; created_at: string }[];
      const totalApps = appList.length;
      const hiredCount = appList.filter((a) => a.status === 'selected' || a.status === 'joined').length;

      const today = new Date().toISOString().split('T')[0];
      const todayAppsCount = appList.filter((a) => a.created_at?.startsWith(today)).length;

      const appIds = appList.map((a) => a.id);

      // 3. Get upcoming & today interviews
      let upcomingIvs = 0;
      let todayIvs = 0;
      if (appIds.length > 0) {
        const { data: ivs } = await supabase
          .from('interviews')
          .select('id, status, interview_date')
          .in('application_id', appIds)
          .eq('status', 'scheduled');

        const ivList = (ivs || []) as { id: string; status: string; interview_date: string }[];
        upcomingIvs = ivList.length;
        todayIvs = ivList.filter((iv) => iv.interview_date === today).length;
      }

      setMetrics({
        activeJobs: activeJobsCount,
        upcomingInterviews: upcomingIvs,
        receivedApplications: totalApps,
        todayInterviews: todayIvs,
        todayApplications: todayAppsCount,
        hiredNurses: hiredCount,
      });
    } catch (err) {
      console.warn('Error loading hospital metrics:', err);
    }
  }, []);

  useEffect(() => {
    async function loadHospital() {
      if (!user) {
        setLoadingHospital(false);
        return;
      }

      try {
        const { data: existingHosps, error } = await supabase
          .from('hospitals')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (existingHosps && existingHosps.length > 0) {
          const hosp = existingHosps[0] as Hospital;
          setHospital(hosp);
          loadHospitalMetrics(hosp.id);
          setLoadingHospital(false);
          return;
        }

        // Auto initialize in Supabase from registration profile if none exists
        if (profile?.role === 'hospital') {
          const insertPayload = {
            user_id: user.id,
            name: profile.full_name || 'My Hospital',
            hospital_name: profile.full_name || 'My Hospital',
            hospital_type: 'private' as const,
            location: profile.state || 'Haryana',
            address: null,
            city: profile.city || null,
            state: profile.state || 'Haryana',
            pincode: null,
            number_of_beds: null,
            departments: null,
            contact_person: profile.full_name || null,
            phone: profile.phone || null,
            contact_email: profile.email || user.email || null,
            description: null,
            website: null,
            verification_status: profile.verification_status || 'pending',
          };

          const { data: created } = await supabase
            .from('hospitals')
            .insert(insertPayload)
            .select()
            .limit(1);

          if (created && created.length > 0) {
            const hosp = created[0] as Hospital;
            setHospital(hosp);
            loadHospitalMetrics(hosp.id);
          }
        }
      } catch (err) {
        console.warn('Error loading hospital:', err);
      } finally {
        setLoadingHospital(false);
      }
    }
    loadHospital();
  }, [user, profile, loadHospitalMetrics]);

  // Refresh metrics when switching tabs
  useEffect(() => {
    if (hospital?.id) {
      loadHospitalMetrics(hospital.id);
    }
  }, [tab, hospital?.id, loadHospitalMetrics]);

  if (loadingHospital) return <Spinner className="py-20" />;

  if (!hospital) {
    return <CreateHospitalForm onCreated={(h) => setHospital(h)} />;
  }

  const isVerified = hospital.verification_status === 'verified';

  return (
    <div className="space-y-6">
      {/* Top Hospital Verification Banner */}
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
              <span>Hospital Verification Status:</span>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
                isVerified ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
              )}>
                {isVerified ? 'Verified ✓' : 'Under Review'}
              </span>
            </div>
            <p className="text-xs opacity-80 mt-0.5">
              {isVerified
                ? 'Your hospital credentials and operating license have been verified by NurseConnect administration.'
                : 'Upload your hospital license in the Profile or Documents section to expedite verification.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('profile')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-800 border border-slate-200 px-3 py-1.5 text-xs font-medium transition-colors"
          >
            Manage Profile <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Clickable Hospital Dashboard Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Active Jobs Card */}
        <button
          onClick={() => setTab('jobs')}
          className={cn(
            'flex flex-col justify-between p-4 rounded-xl border text-left transition-all hover:shadow-md cursor-pointer group',
            metrics.activeJobs > 0
              ? 'bg-blue-50/70 border-blue-200 hover:border-blue-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Active Openings</span>
            <div className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              metrics.activeJobs > 0 ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'
            )}>
              <Briefcase className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-900">{metrics.activeJobs}</h3>
            <p className="text-xs text-blue-600 font-medium group-hover:underline flex items-center gap-1 mt-1">
              Manage / Post Jobs <ArrowRight className="h-3 w-3" />
            </p>
          </div>
        </button>

        {/* 2. Received Applications Card */}
        <button
          onClick={() => setTab('applications')}
          className={cn(
            'flex flex-col justify-between p-4 rounded-xl border text-left transition-all hover:shadow-md cursor-pointer group',
            metrics.receivedApplications > 0
              ? 'bg-indigo-50/70 border-indigo-200 hover:border-indigo-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Applications</span>
            <div className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              metrics.receivedApplications > 0 ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600'
            )}>
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-extrabold text-slate-900">{metrics.receivedApplications}</h3>
              {metrics.todayApplications > 0 && (
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                  +{metrics.todayApplications} today
                </span>
              )}
            </div>
            <p className="text-xs text-indigo-600 font-medium group-hover:underline flex items-center gap-1 mt-1">
              Review candidates <ArrowRight className="h-3 w-3" />
            </p>
          </div>
        </button>

        {/* 3. Upcoming Interviews Card */}
        <button
          onClick={() => setTab('interviews')}
          className={cn(
            'flex flex-col justify-between p-4 rounded-xl border text-left transition-all hover:shadow-md cursor-pointer group',
            metrics.upcomingInterviews > 0
              ? 'bg-amber-50/70 border-amber-200 hover:border-amber-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Interviews</span>
            <div className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              metrics.upcomingInterviews > 0 ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-600'
            )}>
              <Video className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-extrabold text-slate-900">{metrics.upcomingInterviews}</h3>
              {metrics.todayInterviews > 0 && (
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                  {metrics.todayInterviews} today
                </span>
              )}
            </div>
            <p className="text-xs text-amber-700 font-medium group-hover:underline flex items-center gap-1 mt-1">
              View schedules <ArrowRight className="h-3 w-3" />
            </p>
          </div>
        </button>

        {/* 4. Hired Nurses Card */}
        <button
          onClick={() => setTab('hired')}
          className={cn(
            'flex flex-col justify-between p-4 rounded-xl border text-left transition-all hover:shadow-md cursor-pointer group',
            metrics.hiredNurses > 0
              ? 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Hired Nurses</span>
            <div className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              metrics.hiredNurses > 0 ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-600'
            )}>
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-900">{metrics.hiredNurses}</h3>
            <p className="text-xs text-emerald-700 font-medium group-hover:underline flex items-center gap-1 mt-1">
              View staff list <ArrowRight className="h-3 w-3" />
            </p>
          </div>
        </button>
      </div>

      {/* Main Tab Content */}
      {tab === 'jobs' && (
        <ManageJobs
          hospital={hospital}
          onNavigateApplications={() => setTab('applications')}
          onNavigateDocuments={() => setTab('documents')}
          onNavigateProfile={() => setTab('profile')}
        />
      )}
      {tab === 'applications' && <ReviewApplications hospital={hospital} />}
      {tab === 'interviews' && <ManageInterviews hospital={hospital} />}
      {tab === 'hired' && <HiredNurses hospital={hospital} onNavigateApplications={() => setTab('applications')} />}
      {tab === 'profile' && <HospitalProfile hospital={hospital} onUpdate={setHospital} onNavigateDocuments={() => setTab('documents')} />}
      {tab === 'documents' && <HospitalDocuments hospital={hospital} />}
      {tab === 'notifications' && <HospitalNotifications />}
    </div>
  );
}

// ============ CREATE HOSPITAL FORM ============
function CreateHospitalForm({ onCreated }: { onCreated: (h: Hospital) => void }) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [hospitalName, setHospitalName] = useState(profile?.full_name || '');
  const [hospitalType, setHospitalType] = useState<string>(HOSPITAL_TYPES[0]);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState(profile?.city || '');
  const [state, setState] = useState(profile?.state || 'Haryana');
  const [pincode, setPincode] = useState('');
  const [beds, setBeds] = useState('');
  const [department, setDepartment] = useState<string>(HEALTHCARE_DEPARTMENTS[0]);
  const [contactPerson, setContactPerson] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [contactEmail, setContactEmail] = useState(profile?.email || user?.email || '');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    const newHospitalData: Hospital = {
      id: `hosp_${Date.now()}`,
      user_id: user!.id,
      name: hospitalName,
      hospital_name: hospitalName,
      hospital_type: hospitalType as any,
      location: `${city}, ${state}`,
      address: address || null,
      city: city || null,
      state: state || null,
      pincode: pincode || null,
      number_of_beds: beds ? parseInt(beds) : null,
      departments: department || null,
      contact_person: contactPerson || null,
      phone: phone || null,
      contact_email: contactEmail || null,
      description: description || null,
      website: null,
      verification_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem(`nurseconnect_hospital_${user!.id}`, JSON.stringify(newHospitalData));

    try {
      const { data: existing } = await supabase
        .from('hospitals')
        .select('id')
        .eq('user_id', user!.id)
        .limit(1);

      let savedHosp: Hospital | null = null;
      if (existing && existing.length > 0) {
        const { data } = await supabase
          .from('hospitals')
          .update({
            name: hospitalName,
            hospital_name: hospitalName,
            hospital_type: hospitalType as any,
            location: `${city}, ${state}`,
            address, city, state, pincode,
            number_of_beds: beds ? parseInt(beds) : null,
            departments: department || null,
            contact_person: contactPerson || null,
            phone: phone || null,
            contact_email: contactEmail || null,
            description: description || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing[0].id)
          .select()
          .single();
        savedHosp = data as Hospital;
      } else {
        const { data } = await supabase.from('hospitals').insert({
          user_id: user!.id,
          name: hospitalName,
          hospital_name: hospitalName,
          hospital_type: hospitalType as any,
          location: `${city}, ${state}`,
          address, city, state, pincode,
          number_of_beds: beds ? parseInt(beds) : null,
          departments: department || null,
          contact_person: contactPerson || null,
          phone: phone || null,
          contact_email: contactEmail || null,
          description: description || null,
        }).select().single();
        savedHosp = data as Hospital;
      }

      if (savedHosp) {
        localStorage.setItem(`nurseconnect_hospital_${user!.id}`, JSON.stringify(savedHosp));
        setSaving(false);
        showToast('success', 'Hospital profile created successfully');
        onCreated(savedHosp);
        return;
      }
    } catch {
      // Fall through to local
    }

    setSaving(false);
    showToast('success', 'Hospital profile created successfully');
    onCreated(newHospitalData);
  }

  return (
    <div className="max-w-2xl">
      <Card>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
            <Building2 className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Set Up Your Hospital Profile</h2>
            <p className="text-sm text-slate-500">Details from your registration have been pre-filled.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Hospital name" value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} placeholder="St. Mary's Medical Center" required />
          <Select label="Hospital type" value={hospitalType} onChange={(e) => setHospitalType(e.target.value)} required>
            {HOSPITAL_TYPES.map((ht) => (
              <option key={ht} value={ht}>{ht}</option>
            ))}
          </Select>
          <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Medical Drive" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} required />
            <Select label="State" value={state} onChange={(e) => setState(e.target.value)} required>
              {INDIAN_STATES_AND_UTS.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </Select>
            <Input label="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Number of beds" type="number" min={0} value={beds} onChange={(e) => setBeds(e.target.value)} />
            <Select label="Primary Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
              {HEALTHCARE_DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Contact person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Input label="Contact email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your hospital..." rows={3} />
          <Button type="submit" disabled={saving} size="lg">{saving ? 'Creating...' : 'Create Hospital Profile'}</Button>
        </form>
      </Card>
    </div>
  );
}

// ============ MANAGE JOBS ============
function ManageJobs({
  hospital,
  onNavigateApplications,
  onNavigateDocuments,
  onNavigateProfile,
}: {
  hospital: Hospital;
  onNavigateApplications: () => void;
  onNavigateDocuments?: () => void;
  onNavigateProfile?: () => void;
}) {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showLicenseWarningModal, setShowLicenseWarningModal] = useState(false);
  const [hasLicense, setHasLicense] = useState(true);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [appCounts, setAppCounts] = useState<Record<string, number>>({});
  const [matchedJobModal, setMatchedJobModal] = useState<Job | null>(null);

  const loadJobsAndLicense = useCallback(async () => {
    const [{ data: jobData }, { data: docData }] = await Promise.all([
      supabase
        .from('jobs')
        .select('*')
        .eq('hospital_id', hospital.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('hospital_documents')
        .select('*')
        .eq('hospital_id', hospital.id),
    ]);

    const jobList = (jobData || []).map((j) => normalizeJob(j)) as Job[];
    setJobs(jobList);

    const docs = (docData || []) as any[];
    const licenseUploaded = docs.some(
      (d) => d.document_type === 'license' || d.document_type === 'registration' || d.document_type === 'hospital_license'
    );
    // Hospital must either have an uploaded license doc or be verified
    const isLicenseValid = licenseUploaded || hospital.verification_status === 'verified';
    setHasLicense(isLicenseValid);

    setLoading(false);

    if (jobList.length > 0) {
      const { data: apps } = await supabase
        .from('applications')
        .select('job_id')
        .in('job_id', jobList.map((j) => j.id));
      const counts: Record<string, number> = {};
      (apps || []).forEach((a: { job_id: string }) => {
        if (a.job_id) counts[a.job_id] = (counts[a.job_id] || 0) + 1;
      });
      setAppCounts(counts);
    }
  }, [hospital.id, hospital.verification_status]);

  useEffect(() => { loadJobsAndLicense(); }, [loadJobsAndLicense]);

  function handleOpenPostJob() {
    if (!hasLicense) {
      setShowLicenseWarningModal(true);
      return;
    }
    setEditingJob(null);
    setShowForm(true);
  }

  if (loading) return <Spinner className="py-20" />;

  const statusConfig: Record<string, { color: 'green' | 'blue' | 'amber' | 'red' | 'slate'; label: string }> = {
    active: { color: 'green', label: 'Active' },
    pending_approval: { color: 'amber', label: 'Pending Approval' },
    draft: { color: 'slate', label: 'Draft' },
    closed: { color: 'slate', label: 'Closed' },
    rejected: { color: 'red', label: 'Rejected' },
  };

  return (
    <div className="space-y-5">
      {/* License Requirement Alert Banner */}
      {!hasLicense && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-950">Hospital Operating License Required</h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Regulatory compliance requires an official hospital operating license / registration certificate before posting new nursing vacancies.
              </p>
            </div>
          </div>
          {onNavigateDocuments && (
            <Button size="sm" onClick={onNavigateDocuments} className="shrink-0 font-semibold bg-amber-700 hover:bg-amber-800 text-white">
              <FileUp className="h-3.5 w-3.5 mr-1" /> Upload License Document
            </Button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} posted</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onNavigateApplications}>
            <Users className="h-4 w-4" /> Review Applications
          </Button>
          <Button onClick={handleOpenPostJob}>
            <Plus className="h-4 w-4" /> Post New Job
          </Button>
        </div>
      </div>

      {/* License Warning Modal */}
      {showLicenseWarningModal && (
        <Modal onClose={() => setShowLicenseWarningModal(false)} title="Operating License Required">
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-4 text-amber-900 border border-amber-200">
              <AlertCircle className="h-6 w-6 text-amber-600 shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-amber-950">Hospital License Mandatory Before Job Posting</h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  To protect nursing candidates and uphold statutory healthcare standards, hospitals must upload a valid Clinical Establishment License or State Health Registration document prior to creating job vacancies.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 space-y-1.5">
              <p className="font-semibold text-slate-900">Accepted License Documents:</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>State Nursing Council / Directorate of Health Services Registration</li>
                <li>Clinical Establishments Act Registration Certificate</li>
                <li>NABH / NABL Accreditation Certificate</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setShowLicenseWarningModal(false)}>Cancel</Button>
              {onNavigateDocuments && (
                <Button
                  onClick={() => {
                    setShowLicenseWarningModal(false);
                    onNavigateDocuments();
                  }}
                >
                  <FileUp className="h-4 w-4 mr-1.5" /> Upload Hospital License
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {jobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-7 w-7" />}
          title="No jobs posted yet"
          description="Post your first job to start receiving applications from nurses."
          action={<Button onClick={() => { setEditingJob(null); setShowForm(true); }}><Plus className="h-4 w-4" /> Post New Job</Button>}
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const sc = statusConfig[job.status] || statusConfig.draft;
            const salaryFormatted = formatSalaryDisplay(job);
            const shiftFormatted = formatShiftDisplay(job);

            return (
              <Card key={job.id} className="hover:border-slate-300 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900 text-base">{job.job_title}</h3>
                      <Badge color={sc.color}>{sc.label}</Badge>
                      <Badge color="slate">{job.vacancies} {job.vacancies === 1 ? 'opening' : 'openings'}</Badge>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-600">
                      <span className="flex items-center gap-1 font-medium text-slate-800">
                        <Stethoscope className="h-3.5 w-3.5 text-teal-600" /> {job.department}
                      </span>
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" /> {job.location}
                        </span>
                      )}
                      {job.experience_required != null && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3.5 w-3.5 text-slate-400" /> {job.experience_required}+ yrs
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-bold text-emerald-700">
                        <IndianRupee className="h-3.5 w-3.5 text-emerald-600" /> {salaryFormatted.formattedFull}
                      </span>
                      {shiftFormatted.hasDetails && (
                        <span className="flex items-center gap-1 text-slate-600">
                          <Clock className="h-3.5 w-3.5 text-slate-400" /> {shiftFormatted.shift || shiftFormatted.summaryText}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs font-medium">
                        <Calendar className="h-3 w-3 text-amber-600" /> Last date: {job.last_date_to_apply ? formatDate(job.last_date_to_apply) : 'Open'}
                      </span>
                    </div>

                    {/* Benefit badges */}
                    <div className="mt-2.5">
                      <JobBenefitsBadgesRow job={job} size="sm" />
                    </div>

                    {job.required_skills && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-500">Skills:</span>
                        {job.required_skills.split(',').map((s, idx) => (
                          <Badge key={idx} color="teal">{s.trim()}</Badge>
                        ))}
                      </div>
                    )}

                    {job.job_description && <p className="mt-2 text-sm text-slate-500 line-clamp-2">{job.job_description}</p>}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setMatchedJobModal(job)}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold text-white bg-[#082F63] hover:bg-[#06244f] transition-all shadow-xs"
                        title="View algorithmically matched nurses for this vacancy"
                      >
                        <span className="text-amber-300">⚡</span> Smart Match
                      </button>
                      <button
                        onClick={onNavigateApplications}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors"
                      >
                        <Users className="h-4 w-4" />
                        {appCounts[job.id] || 0} {(appCounts[job.id] || 0) === 1 ? 'app' : 'apps'}
                      </button>
                    </div>
                    <JobActions
                      job={job}
                      onChanged={loadJobsAndLicense}
                      onEdit={() => {
                        setEditingJob(job);
                        setShowForm(true);
                      }}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showForm && (
        <JobFormModal
          hospitalId={hospital.id}
          hospitalName={hospital.hospital_name || hospital.name}
          hospitalLocation={hospital.location}
          initialJob={editingJob}
          onClose={() => { setShowForm(false); setEditingJob(null); }}
          onCreated={() => { setShowForm(false); setEditingJob(null); loadJobsAndLicense(); }}
        />
      )}

      {matchedJobModal && (
        <SmartMatchedNursesModal
          job={matchedJobModal}
          hospital={hospital}
          onClose={() => setMatchedJobModal(null)}
        />
      )}
    </div>
  );
}

function JobActions({ job, onChanged, onEdit }: { job: Job; onChanged: () => void; onEdit?: () => void }) {
  const { showToast } = useToast();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm('Delete this job? This will also delete all applications.')) return;
    setDeleting(true);
    const { error } = await supabase.from('jobs').delete().eq('id', job.id);
    setDeleting(false);
    if (error) { showToast('error', 'Failed to delete job: ' + error.message); return; }
    showToast('success', 'Job deleted');
    onChanged();
  }

  async function toggleStatus() {
    const newStatus = job.status === 'active' ? 'closed' : 'active';
    const { error } = await supabase.from('jobs').update({ status: newStatus }).eq('id', job.id);
    if (error) { showToast('error', 'Failed to update job status'); return; }
    showToast('success', newStatus === 'active' ? 'Job reopened' : 'Job closed');
    onChanged();
  }

  return (
    <div className="flex items-center gap-1">
      {onEdit && (
        <button
          onClick={onEdit}
          className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          title="Edit job details"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
      <button onClick={toggleStatus} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title={job.status === 'active' ? 'Close job' : 'Reopen job'}>
        {job.status === 'active' ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
      </button>
      <button onClick={handleDelete} disabled={deleting} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete job">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function JobFormModal({
  hospitalId,
  hospitalName,
  hospitalLocation,
  initialJob,
  onClose,
  onCreated,
}: {
  hospitalId: string;
  hospitalName: string;
  hospitalLocation: string;
  initialJob?: Job | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const isEditing = Boolean(initialJob);

  // Role info
  const [selectedTitle, setSelectedTitle] = useState<string>(() => {
    if (initialJob?.job_title) {
      return (NURSING_JOB_TITLES as readonly string[]).includes(initialJob.job_title)
        ? initialJob.job_title
        : 'Other / Custom Title';
    }
    return NURSING_JOB_TITLES[0];
  });
  const [customTitle, setCustomTitle] = useState(() => {
    if (initialJob?.job_title && !(NURSING_JOB_TITLES as readonly string[]).includes(initialJob.job_title)) {
      return initialJob.job_title;
    }
    return '';
  });

  const [selectedDept, setSelectedDept] = useState<string>(() => {
    if (initialJob?.department) {
      return (HEALTHCARE_DEPARTMENTS as readonly string[]).includes(initialJob.department)
        ? initialJob.department
        : 'Other Specialized Department';
    }
    return HEALTHCARE_DEPARTMENTS[0];
  });
  const [customDept, setCustomDept] = useState(() => {
    if (initialJob?.department && !(HEALTHCARE_DEPARTMENTS as readonly string[]).includes(initialJob.department)) {
      return initialJob.department;
    }
    return '';
  });

  const [qualificationReq, setQualificationReq] = useState<string>(
    initialJob?.qualification_required || NURSING_QUALIFICATIONS[2]
  );
  const [experienceReq, setExperienceReq] = useState(
    initialJob?.experience_required != null ? String(initialJob.experience_required) : '1'
  );
  const [location, setLocation] = useState(initialJob?.location || hospitalLocation || '');
  const [vacancies, setVacancies] = useState(initialJob?.vacancies ? String(initialJob.vacancies) : '1');
  const [lastDateToApply, setLastDateToApply] = useState(() => {
    if (initialJob?.last_date_to_apply) {
      return initialJob.last_date_to_apply.split('T')[0];
    }
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  // Salary Transparency fields
  const [salaryType, setSalaryType] = useState<SalaryType>(initialJob?.salary_type || 'monthly');
  const [salaryMin, setSalaryMin] = useState(initialJob?.salary_min != null ? String(initialJob.salary_min) : '35000');
  const [salaryMax, setSalaryMax] = useState(initialJob?.salary_max != null ? String(initialJob.salary_max) : '55000');
  const [salaryBasis, setSalaryBasis] = useState<SalaryBasis>(initialJob?.salary_basis || 'ctc');

  // Shift Transparency fields
  const [shift, setShift] = useState(initialJob?.shift || 'Rotational');

  // Benefits Transparency fields
  const [accommodation, setAccommodation] = useState(Boolean(initialJob?.accommodation_available));
  const [meals, setMeals] = useState(Boolean(initialJob?.meals_provided));
  const [overtime, setOvertime] = useState(Boolean(initialJob?.overtime_available));
  const [joiningBonus, setJoiningBonus] = useState(Boolean(initialJob?.joining_bonus_available));
  const [joiningBonusAmount, setJoiningBonusAmount] = useState(
    initialJob?.joining_bonus_amount != null ? String(initialJob.joining_bonus_amount) : '15000'
  );

  // Description & Skills
  const [description, setDescription] = useState(initialJob?.job_description || '');
  const [requiredSkills, setRequiredSkills] = useState(
    initialJob?.required_skills || ''
  );

  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const finalJobTitle = selectedTitle === 'Other / Custom Title' ? customTitle.trim() : selectedTitle;
  const finalDepartment = selectedDept === 'Other Specialized Department' ? customDept.trim() : selectedDept;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!finalJobTitle) {
      showToast('error', 'Please enter or select a job title.');
      return;
    }
    if (!finalDepartment) {
      showToast('error', 'Please enter or select a department.');
      return;
    }
    if (!lastDateToApply) {
      showToast('error', 'Please set the last date to apply.');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    if (lastDateToApply < today) {
      showToast('error', 'Last date to apply cannot be in the past.');
      return;
    }

    // Salary validations
    const numMin = salaryMin ? parseFloat(salaryMin) : null;
    const numMax = salaryMax ? parseFloat(salaryMax) : null;

    if (numMin !== null && numMin < 0) {
      showToast('error', 'Minimum salary cannot be negative.');
      return;
    }
    if (numMax !== null && numMax < 0) {
      showToast('error', 'Maximum salary cannot be negative.');
      return;
    }
    if (numMin !== null && numMax !== null && numMin > numMax) {
      showToast('error', 'Minimum salary cannot be greater than maximum salary.');
      return;
    }

    const numBonusAmount = joiningBonus && joiningBonusAmount ? parseFloat(joiningBonusAmount) : null;
    if (joiningBonus && (numBonusAmount === null || numBonusAmount <= 0)) {
      showToast('error', 'Please provide a valid joining bonus amount (greater than ₹0).');
      return;
    }

    setSaving(true);

    const encodedDescription = encodeJobDescription(description, {
      last_date_to_apply: lastDateToApply || null,
      salary_type: salaryType,
      salary_basis: salaryBasis,
      shift: shift || null,
      meals_provided: meals,
      overtime_available: overtime,
      joining_bonus_available: joiningBonus,
      joining_bonus_amount: joiningBonus ? numBonusAmount : null,
    });

    const corePayload: Record<string, unknown> = {
      hospital_id: hospitalId,
      job_title: finalJobTitle,
      department: finalDepartment,
      qualification_required: qualificationReq || null,
      experience_required: experienceReq ? parseInt(experienceReq, 10) : null,
      salary_min: numMin,
      salary_max: numMax,
      location: location || null,
      vacancies: parseInt(vacancies, 10) || 1,
      accommodation_available: accommodation,
      job_description: encodedDescription || null,
      required_skills: requiredSkills || null,
    };

    const fullPayload: Record<string, unknown> = {
      ...corePayload,
      salary_type: salaryType,
      salary_basis: salaryBasis,
      shift: shift || null,
      meals_provided: meals,
      overtime_available: overtime,
      joining_bonus_available: joiningBonus,
      joining_bonus_amount: joiningBonus ? numBonusAmount : null,
      last_date_to_apply: lastDateToApply || null,
    };

    if (isEditing && initialJob) {
      const updatePayload = {
        ...fullPayload,
        status: initialJob.status === 'active' ? 'pending_approval' : initialJob.status,
        updated_at: new Date().toISOString(),
      };

      let { error: err } = await supabase.from('jobs').update(updatePayload).eq('id', initialJob.id);

      if (err && (err.code === 'PGRST204' || err.message?.includes('schema cache') || err.message?.includes('column'))) {
        const fallbackUpdate = {
          ...corePayload,
          status: initialJob.status === 'active' ? 'pending_approval' : initialJob.status,
          updated_at: new Date().toISOString(),
        };
        const { error: retryErr } = await supabase.from('jobs').update(fallbackUpdate).eq('id', initialJob.id);
        err = retryErr;
      }

      setSaving(false);

      if (err) {
        showToast('error', 'Failed to update job: ' + err.message);
        return;
      }

      showToast('success', 'Job updated successfully! Submitted for Admin review.');
      onCreated();
    } else {
      const insertPayload = {
        ...fullPayload,
        status: 'pending_approval',
      };

      let { error: err } = await supabase.from('jobs').insert(insertPayload);

      // Fallback to core payload with embedded metadata if DB column is missing in schema cache
      if (err && (err.code === 'PGRST204' || err.message?.includes('schema cache') || err.message?.includes('column'))) {
        const fallbackPayload: Record<string, unknown> = {
          ...corePayload,
          status: 'pending_approval',
        };
        const { error: retryErr } = await supabase.from('jobs').insert(fallbackPayload);
        err = retryErr;
      }

      setSaving(false);
      if (err) {
        showToast('error', 'Failed to post job: ' + err.message);
        return;
      }
      showToast('success', 'Job submitted for Admin approval. It will go live once verified by NurseConnect Admin.');
      onCreated();
    }
  }

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-scale-in border border-slate-200">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEditing ? 'Edit Nursing Job Posting' : 'Post a New Nursing Job'}
            </h2>
            <p className="text-xs text-slate-500">{hospitalName} · Full Transparency Standard</p>
          </div>
          <Badge color={isEditing ? 'amber' : 'blue'}>
            {isEditing ? 'Editing Job' : 'Standard Job Listing'}
          </Badge>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* SECTION 1: ROLE DETAILS */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-100 flex items-center gap-1.5">
              <Stethoscope className="h-3.5 w-3.5 text-teal-600" />
              1. Basic Role & Department
            </h3>

            {/* Job Title Dropdown with Custom option */}
            <div className="space-y-1.5">
              <Select
                label="Job Title"
                value={selectedTitle}
                onChange={(e) => setSelectedTitle(e.target.value)}
                required
              >
                {NURSING_JOB_TITLES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value="Other / Custom Title">Other / Custom Title</option>
              </Select>
              {selectedTitle === 'Other / Custom Title' && (
                <Input
                  label="Custom Job Title"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Critical Care Transport Specialist Nurse"
                  required
                />
              )}
            </div>

            {/* Department Dropdown with Custom option */}
            <div className="space-y-1.5">
              <Select
                label="Healthcare Department"
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                required
              >
                {HEALTHCARE_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
                <option value="Other Specialized Department">Other Specialized Department</option>
              </Select>
              {selectedDept === 'Other Specialized Department' && (
                <Input
                  label="Custom Department Name"
                  value={customDept}
                  onChange={(e) => setCustomDept(e.target.value)}
                  placeholder="e.g. Bone Marrow Transplant & Hematology"
                  required
                />
              )}
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Select
                label="Required Qualification"
                value={qualificationReq}
                onChange={(e) => setQualificationReq(e.target.value)}
                required
              >
                <option value="Any Recognized Nursing Degree">Any Recognized Nursing Degree</option>
                {NURSING_QUALIFICATIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </Select>
              <Input
                label="Min Experience (years)"
                type="number"
                min={0}
                value={experienceReq}
                onChange={(e) => setExperienceReq(e.target.value)}
              />
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Input
                label="Job Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Gurgaon, Haryana"
              />
              <Input
                label="Open Vacancies"
                type="number"
                min={1}
                value={vacancies}
                onChange={(e) => setVacancies(e.target.value)}
                required
              />
            </div>
          </div>

          {/* SECTION 2: COMPENSATION & WORK TRANSPARENCY */}
          <div className="space-y-3.5 rounded-xl border border-emerald-200 bg-emerald-50/25 p-4">
            <div className="flex items-center justify-between pb-1 border-b border-emerald-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <IndianRupee className="h-3.5 w-3.5 text-emerald-700" />
                2. Compensation & Work Details (Full Transparency)
              </h3>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                Nurse-First Transparency
              </span>
            </div>

            {/* Salary Grid */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 block">Salary & Compensation Breakdown</span>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <Select
                    label="Salary Period"
                    value={salaryType}
                    onChange={(e) => setSalaryType(e.target.value as SalaryType)}
                  >
                    <option value="monthly">Monthly (₹/mo)</option>
                    <option value="annual">Annual (₹/yr)</option>
                  </Select>
                </div>
                <div>
                  <Input
                    label={`Min Salary (${salaryType === 'annual' ? '₹/yr' : '₹/mo'})`}
                    type="number"
                    min={0}
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value)}
                    placeholder={salaryType === 'annual' ? '420000' : '35000'}
                  />
                </div>
                <div>
                  <Input
                    label={`Max Salary (${salaryType === 'annual' ? '₹/yr' : '₹/mo'})`}
                    type="number"
                    min={0}
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(e.target.value)}
                    placeholder={salaryType === 'annual' ? '660000' : '55000'}
                  />
                </div>
                <div>
                  <Select
                    label="Salary Basis"
                    value={salaryBasis}
                    onChange={(e) => setSalaryBasis(e.target.value as SalaryBasis)}
                  >
                    <option value="ctc">CTC (Cost to Co.)</option>
                    <option value="gross">Gross Salary</option>
                    <option value="take_home">Take-Home (In-Hand)</option>
                  </Select>
                </div>
              </div>
            </div>

            {/* Shift & Work Schedule */}
            <div className="space-y-2 pt-2 border-t border-emerald-100/70">
              <span className="text-xs font-bold text-slate-800 block">Shift & Work Schedule</span>
              <div className="grid gap-3 sm:grid-cols-1">
                <Select
                  label="Shift Type"
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                >
                  <option value="Rotational">Rotational Shift (Standard)</option>
                  <option value="Day">Day Shift</option>
                  <option value="Night">Night Shift</option>
                  <option value="General">General (Morning/Evening)</option>
                  <option value="Flexible">Flexible / On-call</option>
                </Select>
              </div>
            </div>

            {/* Benefits Checkboxes & Joining Bonus */}
            <div className="space-y-2 pt-2 border-t border-emerald-100/70">
              <span className="text-xs font-bold text-slate-800 block">Nurse Benefits & Perks</span>
              <div className="grid sm:grid-cols-2 gap-2.5">
                <label className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-white p-2.5 cursor-pointer hover:bg-emerald-50/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={accommodation}
                    onChange={(e) => setAccommodation(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block flex items-center gap-1">
                      <Home className="h-3.5 w-3.5 text-emerald-600" /> Accommodation Provided
                    </span>
                    <span className="text-[10px] text-slate-500">Hostel/housing for outstation nurses</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-white p-2.5 cursor-pointer hover:bg-emerald-50/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={meals}
                    onChange={(e) => setMeals(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block flex items-center gap-1">
                      <Utensils className="h-3.5 w-3.5 text-amber-600" /> Duty Meals Provided
                    </span>
                    <span className="text-[10px] text-slate-500">Subsidized or free cafeteria meals</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-white p-2.5 cursor-pointer hover:bg-emerald-50/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={overtime}
                    onChange={(e) => setOvertime(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-blue-600" /> Overtime Pay Available
                    </span>
                    <span className="text-[10px] text-slate-500">Extra compensation for extra duty hours</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-white p-2.5 cursor-pointer hover:bg-emerald-50/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={joiningBonus}
                    onChange={(e) => setJoiningBonus(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block flex items-center gap-1">
                      <Gift className="h-3.5 w-3.5 text-purple-600" /> Joining Bonus
                    </span>
                    <span className="text-[10px] text-slate-500">One-time joining / sign-on incentive</span>
                  </div>
                </label>
              </div>

              {/* Bonus Amount input when Joining Bonus is checked */}
              {joiningBonus && (
                <div className="pt-2">
                  <Input
                    label="Joining Bonus Amount (₹)"
                    type="number"
                    min={1}
                    value={joiningBonusAmount}
                    onChange={(e) => setJoiningBonusAmount(e.target.value)}
                    placeholder="15000"
                    required
                  />
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: APPLICATION TIMELINE & CLINICAL CRITERIA */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-100 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary-600" />
              3. Application Timeline & Details
            </h3>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Input
                label="Last Date to Apply"
                type="date"
                min={todayStr}
                value={lastDateToApply}
                onChange={(e) => setLastDateToApply(e.target.value)}
                required
              />
              <Input
                label="Required Skills (comma separated)"
                value={requiredSkills}
                onChange={(e) => setRequiredSkills(e.target.value)}
                placeholder="ICU, Ventilator, Critical Care, ACLS"
              />
            </div>

            <Textarea
              label="Job Description & Responsibilities"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe key clinical responsibilities, patient ratios, ward rotation, and department expectations..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? 'Submitting...'
                : isEditing
                ? 'Save & Submit for Approval'
                : 'Post & Submit for Approval'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ REVIEW APPLICATIONS ============
function ReviewApplications({ hospital }: { hospital: Hospital }) {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationWithNurse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingApps, setLoadingApps] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [schedulingApp, setSchedulingApp] = useState<ApplicationWithNurse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [viewingNurseDocs, setViewingNurseDocs] = useState<{ nurseId: string; nurseName: string } | null>(null);

  const isVerified = hospital.verification_status === 'verified';

  useEffect(() => {
    async function loadJobs() {
      const { data } = await supabase
        .from('jobs')
        .select('*')
        .eq('hospital_id', hospital.id)
        .order('created_at', { ascending: false });
      const jobList = (data || []).map((j) => normalizeJob(j)) as Job[];
      setJobs(jobList);
      if (jobList.length > 0) setSelectedJobId(jobList[0].id);
      setLoading(false);
    }
    loadJobs();
  }, [hospital.id]);

  const loadApps = useCallback(async () => {
    if (!selectedJobId) return;
    setLoadingApps(true);
    const { data } = await supabase
      .from('applications')
      .select('*, profiles(id, full_name, profile_photo, email, phone, specialty, city, state, verification_status), nurse_profiles(qualification, total_experience, departments, verification_status, expected_salary), interviews(*)')
      .eq('job_id', selectedJobId)
      .order('created_at', { ascending: false });
    setApplications(data as ApplicationWithNurse[] || []);
    setLoadingApps(false);
  }, [selectedJobId]);

  useEffect(() => { loadApps(); }, [loadApps]);

  async function updateAppStatus(appId: string, nurseId: string, jobTitle: string, status: Application['status']) {
    if (!isVerified) {
      showToast('error', 'Action blocked: Your hospital must be verified by Admin before shortlisting, interviewing, or hiring candidates.');
      return;
    }
    setBusy(appId);
    const { error } = await supabase.from('applications').update({ status }).eq('id', appId);

    if (error) {
      setBusy(null);
      const msg = error.message.includes('completed interview')
        ? 'Cannot select without a completed interview. Schedule and complete an interview first.'
        : error.message;
      showToast('error', msg);
      return;
    }

    setApplications(applications.map((a) => a.id === appId ? { ...a, status } : a));

    const statusLabels: Record<string, string> = {
      under_review: 'Under Review', shortlisted: 'Shortlisted', selected: 'Selected',
      rejected: 'Rejected', joined: 'Joined', interview_scheduled: 'Interview Scheduled',
    };
    await supabase.rpc('create_notification', {
      p_user_id: nurseId,
      p_title: `Application ${statusLabels[status] || status}`,
      p_message: `Your application for ${jobTitle} at ${hospital.hospital_name || hospital.name} has been ${statusLabels[status] || status}.`,
      p_type: 'application',
    });
    setBusy(null);
    showToast('success', `Candidate application marked as ${statusLabels[status] || status}.`);
  }

  async function scheduleInterview(app: ApplicationWithNurse, data: { date: string; time: string; type: 'in_person' | 'video' | 'phone'; link?: string; loc?: string; notes?: string }) {
    if (!isVerified) {
      showToast('error', 'Action blocked: Your hospital must be verified by Admin before scheduling interviews.');
      return;
    }
    setBusy(app.id);
    const { error: ivError } = await supabase.from('interviews').insert({
      application_id: app.id,
      interview_date: data.date,
      interview_time: data.time,
      interview_type: data.type,
      meeting_link: data.link || null,
      location: data.loc || null,
      notes: data.notes || null,
      status: 'scheduled',
    });

    if (ivError) {
      setBusy(null);
      showToast('error', `Failed to schedule interview: ${ivError.message}`);
      return;
    }

    const { error: appError } = await supabase
      .from('applications')
      .update({ status: 'interview_scheduled' })
      .eq('id', app.id);

    if (appError) {
      setBusy(null);
      showToast('error', `Failed to update application: ${appError.message}`);
      return;
    }

    const jobTitle = jobs.find((j) => j.id === selectedJobId)?.job_title || '';
    await supabase.rpc('create_notification', {
      p_user_id: app.nurse_id,
      p_title: 'Interview Scheduled',
      p_message: `Your interview with ${hospital.hospital_name || hospital.name} for ${jobTitle} is scheduled for ${data.date} at ${data.time}.`,
      p_type: 'interview',
    });

    setBusy(null);
    setShowInterviewModal(false);
    setSchedulingApp(null);
    showToast('success', 'Interview scheduled successfully.');
    loadApps();
  }

  async function markInterviewCompleted(app: ApplicationWithNurse) {
    const completedInterview = app.interviews?.find((iv) => iv.status === 'scheduled');
    setBusy(app.id);

    if (completedInterview) {
      await supabase
        .from('interviews')
        .update({ status: 'completed' })
        .eq('id', completedInterview.id);
    }

    const { error } = await supabase
      .from('applications')
      .update({ status: 'interview_completed' })
      .eq('id', app.id);

    if (error) {
      setBusy(null);
      showToast('error', `Failed to mark interview complete: ${error.message}`);
      return;
    }

    const jobTitle = jobs.find((j) => j.id === selectedJobId)?.job_title || '';
    await supabase.rpc('create_notification', {
      p_user_id: app.nurse_id,
      p_title: 'Interview Completed',
      p_message: `Your interview with ${hospital.hospital_name || hospital.name} for ${jobTitle} has been marked completed. Selection decision pending.`,
      p_type: 'interview',
    });

    setBusy(null);
    showToast('success', 'Interview marked as completed. You can now Select or Reject the candidate.');
    loadApps();
  }

  if (loading) return <Spinner className="py-20" />;

  if (jobs.length === 0) {
    return <EmptyState icon={<FileText className="h-7 w-7" />} title="No jobs to review" description="Post jobs first, then you'll see applications here." />;
  }

  const statusConfig: Record<string, { color: 'amber' | 'blue' | 'green' | 'red' | 'slate' | 'teal'; label: string }> = {
    applied: { color: 'blue', label: 'Applied' },
    under_review: { color: 'amber', label: 'Under Review' },
    shortlisted: { color: 'teal', label: 'Shortlisted' },
    interview_scheduled: { color: 'blue', label: 'Interview Stage' },
    selected: { color: 'green', label: 'Selected ✓' },
    joined: { color: 'green', label: 'Joined ✓' },
    rejected: { color: 'red', label: 'Rejected' },
  };

  const selectedJob = jobs.find((j) => j.id === selectedJobId);
  const jobTitle = selectedJob?.job_title || '';
  const selectedCandidatesCount = applications.filter((a) => a.status === 'selected' || a.status === 'joined').length;

  return (
    <div className="space-y-5">
      {/* Verification Warning Alert for Unverified Hospitals */}
      {!isVerified && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-xs">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-amber-900 text-sm">Hospital Verification Required</h4>
            <p className="text-amber-800">
              Your hospital account is currently <strong>Under Review / Unverified</strong>. Candidate contact details (phone, email) are masked, document downloads are restricted, and candidate pipeline actions (shortlist, interview, hire) are locked until your hospital license is approved by NurseConnect Admin.
            </p>
          </div>
        </div>
      )}

      {/* Pipeline Navigation Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 p-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Hiring Pipeline: <span className="text-primary-700">{hospital.hospital_name || hospital.name}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Stage Order: 1. View Candidate → 2. Shortlist → 3. Schedule Interview → 4. Interview Completed → 5. Select → 6. Joined
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-600">Selections:</span>
          <Badge color={selectedCandidatesCount > 0 ? 'green' : 'slate'}>
            {selectedCandidatesCount > 0 ? `✓ ${selectedCandidatesCount} Selected / Joined` : '0 Selected'}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {jobs.map((job) => (
          <button
            key={job.id}
            onClick={() => setSelectedJobId(job.id)}
            className={cn(
              'rounded-lg border px-3.5 py-2 text-sm font-medium transition-all',
              selectedJobId === job.id ? 'border-primary-300 bg-primary-50 text-primary-700 font-semibold' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            )}
          >
            {job.job_title}
          </button>
        ))}
      </div>

      {loadingApps ? (
        <Spinner className="py-12" />
      ) : applications.length === 0 ? (
        <EmptyState icon={<Users className="h-7 w-7" />} title="No applications yet" description="When nurses apply for this job, they'll appear here for review." />
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const sc = statusConfig[app.status] || statusConfig.applied;
            const p = app.profiles;
            const np = app.nurse_profiles;
            const scheduledInterview = app.interviews?.find((iv) => iv.status === 'scheduled');
            const completedInterview = app.interviews?.find((iv) => iv.status === 'completed');
            const interviewReady = !!completedInterview;

            // Compute Smart Match for this candidate against the job
            const nurseTarget: NurseMatchProfile = {
              id: p?.id,
              nurse_id: p?.id,
              full_name: p?.full_name,
              qualification: np?.qualification || (p?.specialty ? 'BSc Nursing' : null),
              specialty: p?.specialty || np?.departments,
              departments: np?.departments || p?.specialty,
              total_experience: np?.total_experience,
              years_experience: p?.years_experience,
              preferred_location: p?.city,
              city: p?.city,
              state: p?.state,
              expected_salary: np?.expected_salary,
            };

            const matchBreakdown = selectedJob
              ? calculateSmartMatch(nurseTarget, {
                  ...selectedJob,
                  hospitals: hospital,
                })
              : null;

            return (
              <Card key={app.id} className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <NursePhotoAvatar
                          photoUrl={p?.profile_photo || (p as any)?.avatar_url}
                          name={p?.full_name}
                          size="md"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-semibold text-slate-900">{p?.full_name}</h3>
                            <Badge color={sc.color}>{sc.label}</Badge>
                            {matchBreakdown && (
                              <SmartMatchBadge
                                match={matchBreakdown}
                                candidateName={p?.full_name || 'Candidate'}
                                jobTitle={jobTitle}
                                size="sm"
                              />
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                            {np?.qualification && <span className="font-semibold text-slate-800">{np.qualification}</span>}
                            {np?.total_experience != null && <span>{np.total_experience} yrs exp</span>}
                            {np?.departments && <span>{np.departments}</span>}
                            {isVerified ? (
                              <>
                                {p?.phone && <span className="text-slate-700 font-medium">📞 {p.phone}</span>}
                                {p?.email && <span className="text-slate-700 font-medium">✉️ {p.email}</span>}
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-500 bg-amber-50/70 border border-amber-200/50 px-2 py-0.5 rounded text-[11px] font-medium">
                                🔒 Contact info locked (Verification required)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {app.cover_message && <p className="mt-2 text-sm text-slate-400">"{app.cover_message}"</p>}
                      <div className="mt-2 flex items-center gap-3">
                        <p className="text-xs text-slate-400">Applied {formatDateTime(app.created_at)}</p>
                        {/* View Nurse Documents Button */}
                        <button
                          onClick={() => setViewingNurseDocs({ nurseId: app.nurse_id, nurseName: p?.full_name || 'Candidate' })}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-800 hover:underline cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5" /> View Nurse Documents
                        </button>
                      </div>

                      {/* Interview details when scheduled or completed */}
                      {(scheduledInterview || completedInterview) && (() => {
                        const iv = completedInterview || scheduledInterview!;
                        return (
                          <div className={cn(
                            'mt-3 rounded-lg border p-3 text-sm',
                            completedInterview ? 'border-emerald-200 bg-emerald-50/50' : 'border-blue-200 bg-blue-50/50'
                          )}>
                            <div className="flex items-center gap-2 font-medium text-slate-700">
                              {completedInterview ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Calendar className="h-4 w-4 text-blue-600" />}
                              Interview {iv.status === 'completed' ? 'Completed' : 'Scheduled'}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {formatDate(iv.interview_date)}</span>
                              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {iv.interview_time}</span>
                              <span className="flex items-center gap-1.5 capitalize">
                                {iv.interview_type === 'in_person' ? <MapIcon className="h-3.5 w-3.5" /> : iv.interview_type === 'video' ? <Video className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                                {iv.interview_type.replace('_', ' ')}
                              </span>
                            </div>
                            {isVerified && iv.meeting_link && <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-primary-600 hover:underline"><Video className="h-3 w-3" /> Join meeting</a>}
                            {iv.notes && <p className="mt-1.5 text-xs text-slate-500">{iv.notes}</p>}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="shrink-0 pt-2 sm:pt-0">
                      {!isVerified ? (
                        <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span>Verification Required</span>
                        </div>
                      ) : app.status === 'applied' || app.status === 'pending' ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="danger" disabled={busy === app.id} onClick={() => updateAppStatus(app.id, app.nurse_id, jobTitle, 'rejected')}>
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                          <Button size="sm" disabled={busy === app.id} onClick={() => updateAppStatus(app.id, app.nurse_id, jobTitle, 'shortlisted')}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Shortlist
                          </Button>
                        </div>
                      ) : app.status === 'shortlisted' ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="danger" disabled={busy === app.id} onClick={() => updateAppStatus(app.id, app.nurse_id, jobTitle, 'rejected')}>
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                          <Button size="sm" disabled={busy === app.id} onClick={() => { setSchedulingApp(app); setShowInterviewModal(true); }}>
                            <Calendar className="h-3.5 w-3.5" /> Schedule Interview
                          </Button>
                        </div>
                      ) : app.status === 'interview_scheduled' && !interviewReady ? (
                        <Button size="sm" disabled={busy === app.id} onClick={() => markInterviewCompleted(app)}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Mark Interview Completed
                        </Button>
                      ) : app.status === 'interview_scheduled' && interviewReady ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="danger" disabled={busy === app.id} onClick={() => updateAppStatus(app.id, app.nurse_id, jobTitle, 'rejected')}>
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                          <Button size="sm" disabled={busy === app.id} onClick={() => updateAppStatus(app.id, app.nurse_id, jobTitle, 'selected')}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Select Candidate
                          </Button>
                        </div>
                      ) : app.status === 'selected' ? (
                        <Button size="sm" variant="secondary" disabled={busy === app.id} onClick={() => updateAppStatus(app.id, app.nurse_id, jobTitle, 'joined')}>
                          <Check className="h-3.5 w-3.5" /> Mark Joined
                        </Button>
                      ) : app.status === 'joined' ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                          <Sparkles className="h-3.5 w-3.5" /> Joined Staff
                        </div>
                      ) : (
                        <Badge color={sc.color}>{sc.label}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Application Status Workflow Tracker (Identical to Nurse Portal) */}
                  <ApplicationStatusTracker
                    status={app.status}
                    hasCompletedInterview={interviewReady}
                  />
              </Card>
            );
          })}
        </div>
      )}

      {showInterviewModal && schedulingApp && (
        <ScheduleInterviewModal
          nurseName={schedulingApp.profiles?.full_name || 'Candidate'}
          jobTitle={jobTitle}
          hospitalName={hospital.hospital_name || hospital.name}
          onClose={() => { setShowInterviewModal(false); setSchedulingApp(null); }}
          onSchedule={(data) => scheduleInterview(schedulingApp, data)}
          saving={busy === schedulingApp.id}
        />
      )}

      {viewingNurseDocs && (
        <NurseDocumentsModal
          nurseId={viewingNurseDocs.nurseId}
          nurseName={viewingNurseDocs.nurseName}
          isHospitalVerified={isVerified}
          onClose={() => setViewingNurseDocs(null)}
        />
      )}
    </div>
  );
}

// ============ NURSE DOCUMENTS MODAL (FOR HOSPITALS) ============
function NurseDocumentsModal({ nurseId, nurseName, isHospitalVerified, onClose }: { nurseId: string; nurseName: string; isHospitalVerified: boolean; onClose: () => void }) {
  const { showToast } = useToast();
  const [docs, setDocs] = useState<NurseDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!isHospitalVerified) {
        setLoading(false);
        return;
      }
      // Check local storage fallback first
      const localDocs = localStorage.getItem(`nurseconnect_nurse_docs_${nurseId}`);
      let parsedLocal: NurseDocument[] = [];
      if (localDocs) {
        try { parsedLocal = JSON.parse(localDocs); } catch {}
      }

      try {
        const { data } = await supabase
          .from('nurse_documents')
          .select('*')
          .eq('nurse_id', nurseId)
          .order('created_at', { ascending: false });
        
        const list = data as NurseDocument[] || [];
        // Merge with local if any unique
        const merged = [...list];
        for (const ld of parsedLocal) {
          if (!merged.some(m => m.id === ld.id)) merged.push(ld);
        }
        setDocs(merged);
      } catch {
        setDocs(parsedLocal);
      }
      setLoading(false);
    }
    load();
  }, [nurseId, isHospitalVerified]);

  async function handleView(doc: NurseDocument) {
    if (!isHospitalVerified) {
      showToast('error', 'Hospital verification required to view candidate documents.');
      return;
    }
    if (doc.file_url?.startsWith('data:') || doc.file_url?.startsWith('http')) {
      window.open(doc.file_url, '_blank');
      return;
    }
    try {
      const { data } = await supabase.storage.from('nurse-documents').createSignedUrl(doc.file_url, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        showToast('info', `Opening candidate credential: ${doc.file_name}`);
      }
    } catch {
      showToast('info', `Viewing candidate credential: ${doc.file_name}`);
    }
  }

  async function handleDownload(doc: NurseDocument) {
    if (!isHospitalVerified) {
      showToast('error', 'Hospital verification required to download candidate documents.');
      return;
    }
    if (doc.file_url?.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = doc.file_url;
      a.download = doc.file_name || 'nurse_document';
      a.click();
      return;
    }
    if (doc.file_url?.startsWith('http')) {
      window.open(doc.file_url, '_blank');
      return;
    }
    try {
      const { data } = await supabase.storage.from('nurse-documents').createSignedUrl(doc.file_url, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        showToast('info', `Downloading candidate document: ${doc.file_name}`);
      }
    } catch {
      showToast('error', 'Failed to generate download link');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Nurse Credentials & Documents</h2>
            <p className="text-xs text-slate-500">Applicant: <span className="font-semibold text-slate-700">{nurseName}</span></p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {!isHospitalVerified ? (
          <div className="py-8 px-2 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Document Verification Access Restricted</h3>
            <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
              Access to sensitive candidate credentials (nursing registration certificates, degree certifications, identity cards) is restricted exclusively to verified healthcare institutions.
            </p>
            <div className="pt-2">
              <Button onClick={onClose} variant="secondary" size="sm">Close</Button>
            </div>
          </div>
        ) : loading ? (
          <Spinner className="py-12" />
        ) : docs.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            <FileText className="h-8 w-8 mx-auto mb-2 text-slate-400" />
            No documents uploaded yet by this nurse.
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{doc.file_name}</p>
                    <p className="text-xs text-slate-500 capitalize">{doc.document_type.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={doc.verification_status === 'verified' ? 'green' : doc.verification_status === 'rejected' ? 'red' : 'green'}>
                    {doc.verification_status === 'verified' ? 'Verified ✓' : doc.verification_status === 'rejected' ? 'Rejected ❌' : 'Uploaded ✓'}
                  </Badge>
                  <Button size="sm" variant="secondary" onClick={() => handleView(doc)} title="View Document">
                    <Eye className="h-3.5 w-3.5" /> View
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)} title="Download Document">
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

// ============ SCHEDULE INTERVIEW MODAL ============
function ScheduleInterviewModal({ nurseName, jobTitle, hospitalName, onClose, onSchedule, saving }: {
  nurseName: string;
  jobTitle: string;
  hospitalName: string;
  onClose: () => void;
  onSchedule: (data: { date: string; time: string; type: 'in_person' | 'video' | 'phone'; link?: string; loc?: string; notes?: string }) => void;
  saving: boolean;
}) {
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [time, setTime] = useState('10:00');
  const [type, setType] = useState<'in_person' | 'video' | 'phone'>('video');
  const [link, setLink] = useState('');
  const [loc, setLoc] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const quickTimeSlots = [
    { label: '09:00 AM', value: '09:00' },
    { label: '10:00 AM', value: '10:00' },
    { label: '11:30 AM', value: '11:30' },
    { label: '02:00 PM', value: '14:00' },
    { label: '03:30 PM', value: '15:30' },
    { label: '04:30 PM', value: '16:30' },
    { label: '05:30 PM', value: '17:30' },
  ];

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!date || !time) { setError('Please select a valid date and interview time.'); return; }
    if (type === 'video' && !link) { setError('Please provide a meeting link for video interviews.'); return; }
    if (type === 'in_person' && !loc) { setError('Please provide a location for in-person interviews.'); return; }
    setError(null);
    onSchedule({ date, time, type, link: link || undefined, loc: loc || undefined, notes: notes || undefined });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Schedule Interview</h2>
            <p className="text-xs text-slate-500">{nurseName} — <span className="font-semibold text-slate-700">{jobTitle}</span></p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Interview Date"
              type="date"
              min={todayStr}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <div>
              <Input
                label="Interview Time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Quick Time Slots for Mobile / Touch Convenience with Clear Set / Selected Confirmation */}
          <div className="space-y-2 rounded-xl bg-slate-50 border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">Quick Time Slots</label>
              {time && (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
                  <Check className="h-3 w-3" /> Time Set: {time}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickTimeSlots.map((slot) => (
                <button
                  type="button"
                  key={slot.value}
                  onClick={() => setTime(slot.value)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border flex items-center gap-1',
                    time === slot.value
                      ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  )}
                >
                  {time === slot.value && <Check className="h-3 w-3" />}
                  {slot.label}
                </button>
              ))}
            </div>
          </div>

          <Select label="Interview format" value={type} onChange={(e) => setType(e.target.value as 'in_person' | 'video' | 'phone')}>
            <option value="video">Google Meet / Video Call</option>
            <option value="in_person">In-Person Hospital Round</option>
            <option value="phone">Telephonic Screening</option>
          </Select>

          {type === 'video' && (
            <Input
              label="Meeting Link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://meet.google.com/abc-defg-hij"
              required
            />
          )}

          {type === 'in_person' && (
            <Input
              label="Hospital Location / Room"
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
              placeholder="HR Department, 2nd Floor, Main Block"
              required
            />
          )}

          <Textarea
            label="Instructions for Candidate (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Please bring original nursing registration certificates and government ID..."
            rows={3}
          />

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Confirm & Schedule Interview'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ MANAGE INTERVIEWS ============
function ManageInterviews({ hospital }: { hospital: Hospital }) {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: jobs } = await supabase.from('jobs').select('id').eq('hospital_id', hospital.id);
      const jobIds = (jobs || []).map((j: { id: string }) => j.id);
      if (jobIds.length === 0) { setLoading(false); return; }

      const { data: apps } = await supabase
        .from('applications')
        .select('*, jobs!inner(id, job_title, department, hospitals!inner(id, hospital_name, name)), profiles(full_name)')
        .in('job_id', jobIds)
        .in('status', ['shortlisted', 'interview_scheduled']);

      const appIds = (apps || []).map((a: { id: string }) => a.id);
      let ivData: any[] = [];
      if (appIds.length > 0) {
        const { data: ivs } = await supabase
          .from('interviews')
          .select('*, applications!inner(id, nurse_id, jobs!inner(job_title, hospitals!inner(hospital_name, name)), profiles(full_name))')
          .in('application_id', appIds)
          .order('interview_date', { ascending: true });
        ivData = ivs || [];
      }

      setInterviews(ivData);
      setLoading(false);
    }
    load();
  }, [hospital.id]);

  if (loading) return <Spinner className="py-20" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{interviews.length} {interviews.length === 1 ? 'interview' : 'interviews'} scheduled</p>
      </div>

      {interviews.length === 0 ? (
        <EmptyState
          icon={<Video className="h-7 w-7" />}
          title="No interviews scheduled"
          description="Shortlist candidates from the Applications tab, then schedule interviews here."
        />
      ) : (
        <div className="space-y-3">
          {interviews.map((iv) => (
            <Card key={iv.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{iv.applications?.profiles?.full_name}</h3>
                    <Badge color={iv.status === 'scheduled' ? 'blue' : iv.status === 'completed' ? 'green' : iv.status === 'cancelled' ? 'red' : 'amber'}>
                      {iv.status}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-primary-700">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{hospital.hospital_name || hospital.name}</span>
                    <span className="text-slate-400 font-normal">• {iv.applications?.jobs?.job_title}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                    <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-slate-400" /> {formatDate(iv.interview_date)}</span>
                    <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-slate-400" /> {iv.interview_time}</span>
                    <span className="flex items-center gap-1.5 capitalize">
                      {iv.interview_type === 'in_person' ? <MapIcon className="h-4 w-4" /> : iv.interview_type === 'video' ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                      {iv.interview_type.replace('_', ' ')}
                    </span>
                  </div>
                  {iv.meeting_link && <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline"><Video className="h-3.5 w-3.5" /> Join meeting</a>}
                  {iv.notes && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{iv.notes}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ HIRED NURSES COMPONENT ============
function HiredNurses({ hospital, onNavigateApplications }: { hospital: Hospital; onNavigateApplications: () => void }) {
  const { showToast } = useToast();
  const [hiredApps, setHiredApps] = useState<ApplicationWithNurse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'selected' | 'joined'>('all');
  const [markingJoinedId, setMarkingJoinedId] = useState<string | null>(null);
  const [viewingDocsNurse, setViewingDocsNurse] = useState<{ id: string; name: string } | null>(null);

  const loadHired = useCallback(async () => {
    setLoading(true);
    // 1. Get all jobs belonging to this hospital
    const { data: jobs } = await supabase.from('jobs').select('id').eq('hospital_id', hospital.id);
    const jobIds = (jobs || []).map((j: { id: string }) => j.id);

    if (jobIds.length === 0) {
      setHiredApps([]);
      setLoading(false);
      return;
    }

    // 2. Query applications with status IN ('selected', 'joined')
    const { data } = await supabase
      .from('applications')
      .select('*, profiles(id, full_name, profile_photo, email, phone, specialty, city, state, verification_status), nurse_profiles(qualification, total_experience, departments, verification_status, expected_salary), jobs(id, job_title, department, location, salary_min, salary_max), interviews(*)')
      .in('job_id', jobIds)
      .in('status', ['selected', 'joined'])
      .order('updated_at', { ascending: false });

    setHiredApps((data as ApplicationWithNurse[]) || []);
    setLoading(false);
  }, [hospital.id]);

  useEffect(() => {
    loadHired();
  }, [loadHired]);

  async function handleMarkJoined(app: ApplicationWithNurse) {
    setMarkingJoinedId(app.id);
    const { error } = await supabase
      .from('applications')
      .update({ status: 'joined', updated_at: new Date().toISOString() })
      .eq('id', app.id);

    if (error) {
      setMarkingJoinedId(null);
      showToast('error', `Failed to update status: ${error.message}`);
      return;
    }

    await supabase.rpc('create_notification', {
      p_user_id: app.nurse_id,
      p_title: 'Welcome to Hospital Staff!',
      p_message: `Congratulations! ${hospital.hospital_name || hospital.name} has recorded your onboarding as officially joined.`,
      p_type: 'application',
    });

    setHiredApps((prev) => prev.map((a) => a.id === app.id ? { ...a, status: 'joined' } : a));
    setMarkingJoinedId(null);
    showToast('success', `${app.profiles?.full_name || 'Nurse'} successfully marked as Joined Staff.`);
  }

  const filteredNurses = useMemo(() => {
    return hiredApps.filter((app) => {
      if (statusFilter !== 'all' && app.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = app.profiles?.full_name?.toLowerCase() || '';
        const email = app.profiles?.email?.toLowerCase() || '';
        const role = app.jobs?.job_title?.toLowerCase() || '';
        const dept = app.jobs?.department?.toLowerCase() || '';
        const qual = app.nurse_profiles?.qualification?.toLowerCase() || '';
        return name.includes(q) || email.includes(q) || role.includes(q) || dept.includes(q) || qual.includes(q);
      }
      return true;
    });
  }, [hiredApps, statusFilter, search]);

  const joinedCount = hiredApps.filter((a) => a.status === 'joined').length;
  const pendingJoiningCount = hiredApps.filter((a) => a.status === 'selected').length;

  if (loading) return <Spinner className="py-20" />;

  return (
    <div className="space-y-6">
      {/* Header & Quick Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-l-4 border-l-emerald-500 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Hired Staff</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{hiredApps.length}</h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Award className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-teal-500 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Joined Staff</p>
              <h3 className="text-2xl font-extrabold text-teal-800 mt-1">{joinedCount}</h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Onboarding</p>
              <h3 className="text-2xl font-extrabold text-blue-800 mt-1">{pendingJoiningCount}</h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search hired nurses by name, role, qualification..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              All ({hiredApps.length})
            </button>
            <button
              onClick={() => setStatusFilter('joined')}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                statusFilter === 'joined' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Joined ({joinedCount})
            </button>
            <button
              onClick={() => setStatusFilter('selected')}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                statusFilter === 'selected' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Selected ({pendingJoiningCount})
            </button>
          </div>
        </div>
      </div>

      {/* Hired Nurses List */}
      {filteredNurses.length === 0 ? (
        <EmptyState
          icon={<Award className="h-8 w-8" />}
          title={hiredApps.length === 0 ? "No hired nurses yet" : "No results found"}
          description={hiredApps.length === 0
            ? "When you select and hire nurses from the Review Applications or Interviews tab, they will appear here in your hospital staff directory."
            : "No candidates match your current search or filter criteria."}
          action={hiredApps.length === 0 ? (
            <Button variant="primary" onClick={onNavigateApplications}>
              <Users className="h-4 w-4" /> Review Candidates
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredNurses.map((app) => {
            const nurse = app.profiles;
            const np = app.nurse_profiles;
            const isJoined = app.status === 'joined';

            return (
              <Card key={app.id} className="flex flex-col justify-between border hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <NursePhotoAvatar
                        photoUrl={nurse?.profile_photo || (nurse as any)?.avatar_url}
                        name={nurse?.full_name}
                        size="lg"
                        shape="rounded"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-base">{nurse?.full_name || 'Nurse Candidate'}</h4>
                          <Badge color={nurse?.verification_status === 'verified' ? 'green' : 'amber'}>
                            {nurse?.verification_status === 'verified' ? 'Verified' : 'Pending Verification'}
                          </Badge>
                        </div>
                        <p className="text-xs font-semibold text-primary-700 mt-0.5">
                          {app.jobs?.job_title || 'Nursing Officer'} • <span className="text-slate-500 font-normal">{app.jobs?.department || 'Department'}</span>
                        </p>
                      </div>
                    </div>

                    <Badge color={isJoined ? 'green' : 'blue'}>
                      {isJoined ? 'Joined Staff' : 'Selected / Offer'}
                    </Badge>
                  </div>

                  {/* Details Grid */}
                  <div className="py-3 space-y-2 text-xs text-slate-600">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-slate-50 p-2">
                        <span className="text-slate-400 block">Qualification:</span>
                        <span className="font-semibold text-slate-800">{np?.qualification || 'B.Sc. Nursing'}</span>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <span className="text-slate-400 block">Clinical Experience:</span>
                        <span className="font-semibold text-slate-800">{np?.total_experience != null ? `${np.total_experience} Years` : 'Fresh Graduate'}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-slate-500">
                      {hospital.verification_status === 'verified' ? (
                        <>
                          {nurse?.phone && (
                            <a href={`tel:${nurse.phone}`} className="inline-flex items-center gap-1 text-primary-600 hover:underline">
                              <Phone className="h-3.5 w-3.5" /> {nurse.phone}
                            </a>
                          )}
                          {nurse?.email && (
                            <a href={`mailto:${nurse.email}`} className="inline-flex items-center gap-1 text-primary-600 hover:underline">
                              <Mail className="h-3.5 w-3.5" /> {nurse.email}
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500 bg-amber-50/70 border border-amber-200/50 px-2 py-0.5 rounded text-[11px] font-medium">
                          🔒 Contact info locked (Verification required)
                        </span>
                      )}
                      {(nurse?.city || nurse?.state) && (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <MapPin className="h-3.5 w-3.5" /> {nurse.city || ''}, {nurse.state || ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 mt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setViewingDocsNurse({ id: app.nurse_id, name: nurse?.full_name || 'Nurse' })}
                  >
                    <FileText className="h-3.5 w-3.5" /> View Credentials
                  </Button>

                  {!isJoined ? (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={markingJoinedId === app.id}
                      onClick={() => handleMarkJoined(app)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {markingJoinedId === app.id ? 'Updating...' : 'Mark as Joined'}
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                      <Sparkles className="h-3.5 w-3.5" /> Active Staff Member
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {viewingDocsNurse && (
        <NurseDocumentsModal
          nurseId={viewingDocsNurse.id}
          nurseName={viewingDocsNurse.name}
          isHospitalVerified={hospital.verification_status === 'verified'}
          onClose={() => setViewingDocsNurse(null)}
        />
      )}
    </div>
  );
}

// ============ HOSPITAL PROFILE ============
function HospitalProfile({
  hospital,
  onUpdate,
  onNavigateDocuments,
}: {
  hospital: Hospital;
  onUpdate: (h: Hospital) => void;
  onNavigateDocuments?: () => void;
}) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [hospitalName, setHospitalName] = useState(hospital.hospital_name || hospital.name || profile?.full_name || '');
  const [selectedHospitalType, setSelectedHospitalType] = useState<string>(hospital.hospital_type || HOSPITAL_TYPES[0]);
  const [customHospitalType, setCustomHospitalType] = useState('');
  const [address, setAddress] = useState(hospital.address || '');
  const [city, setCity] = useState(hospital.city || profile?.city || '');
  const [state, setState] = useState(hospital.state || profile?.state || 'Haryana');
  const [pincode, setPincode] = useState(hospital.pincode || '');
  const [beds, setBeds] = useState(hospital.number_of_beds?.toString() || '');
  const [selectedDept, setSelectedDept] = useState<string>(HEALTHCARE_DEPARTMENTS[0]);
  const [departments, setDepartments] = useState(hospital.departments || '');
  const [contactPerson, setContactPerson] = useState(hospital.contact_person || profile?.full_name || '');
  const [phone, setPhone] = useState(hospital.phone || profile?.phone || '');
  const [contactEmail, setContactEmail] = useState(hospital.contact_email || profile?.email || user?.email || '');
  const [description, setDescription] = useState(hospital.description || '');
  
  const [docs, setDocs] = useState<HospitalDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load documents to check mandatory license
  const loadDocs = useCallback(async () => {
    const localDocs = localStorage.getItem(`nurseconnect_hosp_docs_${hospital.id}`);
    let parsedLocal: HospitalDocument[] = [];
    if (localDocs) {
      try { parsedLocal = JSON.parse(localDocs); } catch {}
    }

    try {
      const { data } = await supabase
        .from('hospital_documents')
        .select('*')
        .eq('hospital_id', hospital.id)
        .order('created_at', { ascending: false });
      
      const list = (data as HospitalDocument[]) || [];
      const merged = [...list];
      for (const ld of parsedLocal) {
        if (!merged.some((m) => m.id === ld.id)) merged.push(ld);
      }
      setDocs(merged);
    } catch {
      setDocs(parsedLocal);
    }
    setLoadingDocs(false);
  }, [hospital.id]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const licenseDoc = docs.find((d) => d.document_type === 'license');
  const hasLicense = Boolean(licenseDoc);

  async function handleLicenseUpload(file: File) {
    setUploadingLicense(true);
    const ext = file.name.split('.').pop() || 'pdf';
    const fileName = `${hospital.id}/license_${Date.now()}.${ext}`;

    // Try converting to data URL for guaranteed local persistence
    let dataUrl = '';
    try {
      dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    } catch {}

    const newDoc: HospitalDocument = {
      id: `doc_lic_${Date.now()}`,
      hospital_id: hospital.id,
      document_type: 'license',
      file_name: file.name,
      file_url: dataUrl || fileName,
      file_size: file.size,
      mime_type: file.type,
      verification_status: 'pending',
      rejection_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save to local storage
    const currentLocal = localStorage.getItem(`nurseconnect_hosp_docs_${hospital.id}`);
    let existingList: HospitalDocument[] = currentLocal ? JSON.parse(currentLocal) : [];
    existingList = [newDoc, ...existingList.filter((d) => d.document_type !== 'license')];
    localStorage.setItem(`nurseconnect_hosp_docs_${hospital.id}`, JSON.stringify(existingList));

    try {
      await supabase.storage.from('hospital-documents').upload(fileName, file);
      await supabase.from('hospital_documents').insert({
        hospital_id: hospital.id,
        document_type: 'license',
        file_name: file.name,
        file_url: dataUrl || fileName,
        file_size: file.size,
        mime_type: file.type,
      });
    } catch {
      // Offline fallback
    }

    setDocs((prev) => [newDoc, ...prev.filter((d) => d.document_type !== 'license')]);
    setUploadingLicense(false);
    showToast('success', 'Hospital License uploaded successfully! Profile saving is now enabled.');
  }

  async function viewDoc(doc: HospitalDocument) {
    if (doc.file_url?.startsWith('data:') || doc.file_url?.startsWith('http')) {
      window.open(doc.file_url, '_blank');
      return;
    }
    try {
      const { data } = await supabase.storage.from('hospital-documents').createSignedUrl(doc.file_url, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        showToast('info', `Opening license: ${doc.file_name}`);
      }
    } catch {
      showToast('info', `Viewing document: ${doc.file_name}`);
    }
  }

  async function downloadDoc(doc: HospitalDocument) {
    if (doc.file_url?.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = doc.file_url;
      a.download = doc.file_name;
      a.click();
      return;
    }
    if (doc.file_url?.startsWith('http')) {
      window.open(doc.file_url, '_blank');
      return;
    }
    try {
      const { data } = await supabase.storage.from('hospital-documents').createSignedUrl(doc.file_url, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch {
      showToast('error', 'Could not download file');
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!hasLicense) {
      showToast('error', 'Hospital License upload is mandatory before saving profile.');
      return;
    }

    const effectiveHospitalType = selectedHospitalType === 'Other / Custom Type' ? (customHospitalType || 'General Hospital') : selectedHospitalType;

    setSaving(true);
    setSaved(false);

    const updatedData: Hospital = {
      ...hospital,
      hospital_name: hospitalName,
      name: hospitalName,
      hospital_type: effectiveHospitalType,
      address: address || null,
      city: city || null,
      state: state || null,
      pincode: pincode || null,
      number_of_beds: beds ? parseInt(beds) : null,
      departments: departments || null,
      contact_person: contactPerson || null,
      phone: phone || null,
      contact_email: contactEmail || null,
      description: description || null,
      location: `${city}, ${state}`,
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem(`nurseconnect_hospital_${user!.id}`, JSON.stringify(updatedData));

    try {
      const { data } = await supabase
        .from('hospitals')
        .update({
          hospital_name: hospitalName,
          name: hospitalName,
          hospital_type: effectiveHospitalType,
          address,
          city,
          state,
          pincode,
          number_of_beds: beds ? parseInt(beds) : null,
          departments: departments || null,
          contact_person: contactPerson || null,
          phone: phone || null,
          contact_email: contactEmail || null,
          description: description || null,
          location: `${city}, ${state}`,
        })
        .eq('id', hospital.id)
        .select()
        .single();

      if (data) {
        localStorage.setItem(`nurseconnect_hospital_${user!.id}`, JSON.stringify(data));
        onUpdate(data as Hospital);
      }
    } catch {
      // Fallback
    }

    setSaving(false);
    setSaved(true);
    onUpdate(updatedData);
    showToast('success', 'Hospital profile saved successfully');
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 shadow-sm">
              <Building2 className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{hospital.hospital_name || hospital.name}</h2>
              <p className="text-sm text-slate-500">{city || hospital.city}, {state || hospital.state}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge color={hospital.verification_status === 'verified' ? 'green' : hospital.verification_status === 'rejected' ? 'red' : 'amber'}>
                  <Award className="h-3 w-3" /> {hospital.verification_status}
                </Badge>
                {hasLicense && (
                  <Badge color="green">
                    <ShieldCheck className="h-3 w-3" /> License Uploaded
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowDocsModal(true)}
              className="whitespace-nowrap"
            >
              <FileText className="h-4 w-4" /> View Documents ({docs.length})
            </Button>
          </div>
        </div>

        {/* MANDATORY LICENSE SECTION */}
        <div className="mb-6 rounded-2xl border p-4.5 transition-all bg-slate-50 border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                hasLicense ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              )}>
                {hasLicense ? <ShieldCheck className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Hospital Medical License</h3>
                  <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 uppercase tracking-wide">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  An uploaded hospital operating license is required to activate and save your profile.
                </p>
              </div>
            </div>
          </div>

          {loadingDocs ? (
            <Spinner className="py-4" />
          ) : hasLicense && licenseDoc ? (
            <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-950 truncate">{licenseDoc.file_name}</p>
                  <p className="text-xs text-emerald-700">Uploaded on {formatDate(licenseDoc.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="secondary" onClick={() => viewDoc(licenseDoc)}>
                  <Eye className="h-3.5 w-3.5" /> View
                </Button>
                <Button size="sm" variant="ghost" onClick={() => downloadDoc(licenseDoc)}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 underline px-2 py-1">
                    Replace
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleLicenseUpload(f);
                    }}
                    disabled={uploadingLicense}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="mt-3.5 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-4 text-center">
              <p className="text-xs font-semibold text-amber-900 mb-2">
                ⚠️ No license uploaded yet. Please upload your hospital license to enable profile saving.
              </p>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-700 transition-colors">
                <FileUp className="h-4 w-4" />
                {uploadingLicense ? 'Uploading License...' : 'Upload Hospital License (PDF / Image)'}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLicenseUpload(f);
                  }}
                  disabled={uploadingLicense}
                />
              </label>
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Hospital name"
            value={hospitalName}
            onChange={(e) => setHospitalName(e.target.value)}
            placeholder="Apollo Medical Center"
            required
          />

          <div className="space-y-2">
            <Select
              label="Hospital Type"
              value={selectedHospitalType}
              onChange={(e) => setSelectedHospitalType(e.target.value)}
              required
            >
              {HOSPITAL_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
              <option value="Other / Custom Type">Other / Custom Type</option>
            </Select>
            {selectedHospitalType === 'Other / Custom Type' && (
              <Input
                label="Custom Hospital Type"
                value={customHospitalType}
                onChange={(e) => setCustomHospitalType(e.target.value)}
                placeholder="e.g. Specialty Fertility Clinic"
                required
              />
            )}
          </div>

          <Input
            label="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Plot 12, Healthcare Blvd"
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Gurugram"
              required
            />
            <Select
              label="State / UT"
              value={state}
              onChange={(e) => setState(e.target.value)}
              required
            >
              {INDIAN_STATES_AND_UTS.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </Select>
            <Input
              label="Pincode"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="122001"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Number of beds"
              type="number"
              min={0}
              value={beds}
              onChange={(e) => setBeds(e.target.value)}
              placeholder="150"
            />
            <Input
              label="Departments"
              value={departments}
              onChange={(e) => setDepartments(e.target.value)}
              placeholder="ICU, Cardiology, Pediatrics..."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Contact person"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Dr. Rajesh Kumar"
            />
            <Input
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>

          <Input
            label="Contact email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="hr@hospital.com"
          />

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide a brief overview of your facility..."
            rows={3}
          />

          <div className="pt-2 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button
                type="submit"
                size="lg"
                disabled={saving || !hasLicense}
                className={cn(!hasLicense && 'opacity-60 cursor-not-allowed')}
              >
                {saving ? 'Saving Profile...' : 'Save Profile'}
              </Button>
              {saved && (
                <span className="text-sm font-semibold text-emerald-600 animate-fade-in flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Profile saved successfully!
                </span>
              )}
              {!hasLicense && (
                <span className="text-xs text-amber-700 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Upload hospital license above to enable profile saving.
                </span>
              )}
            </div>
          </div>
        </form>
      </Card>

      {/* VIEW DOCUMENTS MODAL */}
      {showDocsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowDocsModal(false)} />
          <div className="relative z-10 max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Hospital Facility Documents</h2>
                <p className="text-xs text-slate-500">{hospital.hospital_name || hospital.name}</p>
              </div>
              <button onClick={() => setShowDocsModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {docs.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                <FileText className="h-10 w-10 mx-auto mb-2 text-slate-400" />
                <p className="font-semibold text-slate-700">No documents uploaded</p>
                <p className="text-xs text-slate-500 mt-1">Upload your hospital license and registration certificates.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{doc.file_name}</p>
                        <p className="text-xs text-slate-500 capitalize">{doc.document_type.replace('_', ' ')} • {formatDate(doc.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color={doc.verification_status === 'verified' ? 'green' : 'amber'}>
                        {doc.verification_status}
                      </Badge>
                      <Button size="sm" variant="secondary" onClick={() => viewDoc(doc)}>
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => downloadDoc(doc)}>
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              {onNavigateDocuments && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowDocsModal(false);
                    onNavigateDocuments();
                  }}
                >
                  <FileUp className="h-4 w-4" /> Manage / Upload More
                </Button>
              )}
              <Button variant="ghost" onClick={() => setShowDocsModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ HOSPITAL DOCUMENTS ============
function HospitalDocuments({ hospital }: { hospital: Hospital }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [docs, setDocs] = useState<HospitalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const docTypes: { value: HospitalDocument['document_type']; label: string; mandatory?: boolean }[] = [
    { value: 'license', label: 'Medical License (Mandatory)', mandatory: true },
    { value: 'registration', label: 'Hospital Registration Certificate' },
    { value: 'tax', label: 'GST / Tax Document' },
    { value: 'other', label: 'Other Accreditation Certificate' },
  ];

  const loadDocs = useCallback(async () => {
    const localDocs = localStorage.getItem(`nurseconnect_hosp_docs_${hospital.id}`);
    let parsedLocal: HospitalDocument[] = [];
    if (localDocs) {
      try { parsedLocal = JSON.parse(localDocs); } catch {}
    }

    try {
      const { data } = await supabase
        .from('hospital_documents')
        .select('*')
        .eq('hospital_id', hospital.id)
        .order('created_at', { ascending: false });
      
      const list = (data as HospitalDocument[]) || [];
      const merged = [...list];
      for (const ld of parsedLocal) {
        if (!merged.some((m) => m.id === ld.id)) merged.push(ld);
      }
      setDocs(merged);
    } catch {
      setDocs(parsedLocal);
    }
    setLoading(false);
  }, [hospital.id]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  async function uploadFile(file: File, docType: HospitalDocument['document_type']) {
    setUploading(true);
    const ext = file.name.split('.').pop() || 'pdf';
    const fileName = `${hospital.id}/${docType}_${Date.now()}.${ext}`;

    let dataUrl = '';
    try {
      dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    } catch {}

    const newDoc: HospitalDocument = {
      id: `hosp_doc_${Date.now()}`,
      hospital_id: hospital.id,
      document_type: docType,
      file_name: file.name,
      file_url: dataUrl || fileName,
      file_size: file.size,
      mime_type: file.type,
      verification_status: 'pending',
      rejection_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const currentLocal = localStorage.getItem(`nurseconnect_hosp_docs_${hospital.id}`);
    let existingList: HospitalDocument[] = currentLocal ? JSON.parse(currentLocal) : [];
    existingList = [newDoc, ...existingList.filter((d) => d.id !== newDoc.id)];
    localStorage.setItem(`nurseconnect_hosp_docs_${hospital.id}`, JSON.stringify(existingList));

    try {
      await supabase.storage.from('hospital-documents').upload(fileName, file);
      await supabase.from('hospital_documents').insert({
        hospital_id: hospital.id,
        document_type: docType,
        file_name: file.name,
        file_url: dataUrl || fileName,
        file_size: file.size,
        mime_type: file.type,
      });
    } catch {
      // Offline fallback
    }

    setDocs((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
    setUploading(false);
    showToast('success', `${docType === 'license' ? 'Medical License' : 'Document'} uploaded and saved successfully`);
  }

  async function deleteDoc(doc: HospitalDocument) {
    if (!confirm('Delete this document?')) return;
    try {
      await supabase.storage.from('hospital-documents').remove([doc.file_url]);
      await supabase.from('hospital_documents').delete().eq('id', doc.id);
    } catch {}

    const updated = docs.filter((d) => d.id !== doc.id);
    setDocs(updated);
    localStorage.setItem(`nurseconnect_hosp_docs_${hospital.id}`, JSON.stringify(updated));
    showToast('success', 'Document deleted');
  }

  async function viewDoc(doc: HospitalDocument) {
    if (doc.file_url?.startsWith('data:') || doc.file_url?.startsWith('http')) {
      window.open(doc.file_url, '_blank');
      return;
    }
    try {
      const { data } = await supabase.storage.from('hospital-documents').createSignedUrl(doc.file_url, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        showToast('info', `Viewing ${doc.file_name}`);
      }
    } catch {
      showToast('info', `Viewing ${doc.file_name}`);
    }
  }

  async function downloadDoc(doc: HospitalDocument) {
    if (doc.file_url?.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = doc.file_url;
      a.download = doc.file_name;
      a.click();
      return;
    }
    if (doc.file_url?.startsWith('http')) {
      window.open(doc.file_url, '_blank');
      return;
    }
    try {
      const { data, error } = await supabase.storage.from('hospital-documents').createSignedUrl(doc.file_url, 3600);
      if (error || !data?.signedUrl) {
        showToast('error', 'Failed to generate download link');
        return;
      }
      window.open(data.signedUrl, '_blank');
    } catch {
      showToast('error', 'Download error');
    }
  }

  if (loading) return <Spinner className="py-20" />;

  return (
    <div className="max-w-3xl space-y-5">
      <Card>
        <div className="mb-4">
          <h3 className="font-bold text-slate-900 text-base">Upload Facility Documents</h3>
          <p className="text-xs text-slate-500">
            Medical License is required for hospital verification. Other certificates expedite the verification process.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {docTypes.map((dt) => (
            <label
              key={dt.value}
              className={cn(
                'flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all',
                dt.mandatory
                  ? 'border-primary-200 bg-primary-50/40 hover:border-primary-400 hover:bg-primary-50/70'
                  : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50'
              )}
            >
              <div className="flex items-center gap-3">
                <FileUp className={cn('h-5 w-5', dt.mandatory ? 'text-primary-600' : 'text-slate-400')} />
                <div>
                  <span className="text-sm font-semibold text-slate-800 block">{dt.label}</span>
                  <span className="text-xs text-slate-400">PDF, JPG, or PNG</span>
                </div>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f, dt.value);
                }}
                disabled={uploading}
              />
            </label>
          ))}
        </div>
        {uploading && <p className="mt-3 text-sm text-primary-600 animate-pulse">Uploading and saving document...</p>}
      </Card>

      {docs.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-7 w-7" />}
          title="No documents uploaded"
          description="Upload your hospital license and registration certificates for admin verification."
        />
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <Card key={doc.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{doc.file_name}</div>
                  <div className="text-xs text-slate-500 capitalize">
                    {doc.document_type.replace('_', ' ')} • {formatDate(doc.created_at)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge color={doc.verification_status === 'verified' ? 'green' : doc.verification_status === 'rejected' ? 'red' : 'amber'}>
                  {doc.verification_status}
                </Badge>
                <Button size="sm" variant="secondary" onClick={() => viewDoc(doc)} title="View Document">
                  <Eye className="h-3.5 w-3.5" /> View
                </Button>
                <Button size="sm" variant="ghost" onClick={() => downloadDoc(doc)} title="Download Document">
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
                <button
                  onClick={() => deleteDoc(doc)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Delete Document"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ HOSPITAL NOTIFICATIONS ============
function HospitalNotifications() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
    setNotifications(data as Notification[] || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function markAllRead() {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user!.id).eq('is_read', false);
    if (error) { showToast('error', 'Failed to mark notifications as read'); return; }
    setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
  }

  if (loading) return <Spinner className="py-20" />;

  if (notifications.length === 0) {
    return <EmptyState icon={<Bell className="h-7 w-7" />} title="No notifications" description="You'll see updates about job approvals and applications here." />;
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Button></div>
      {notifications.map((n) => (
        <Card key={n.id} className={cn('flex items-start gap-3', !n.is_read && 'border-primary-200 bg-primary-50/30')}>
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
