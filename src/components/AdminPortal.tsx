import { useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  Users, Briefcase, FileText, Building2, TrendingUp,
  Clock, ShieldCheck, CheckCircle2, XCircle, Award, Stethoscope,
  Activity as ActivityIcon, Video, UserCheck, Bell, Eye, Download,
  IndianRupee, MapPin, Calendar, Check, AlertCircle, Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile, Hospital, Job, Application, Notification, HospitalDocument, NurseDocument } from '@/lib/supabase';
import { Card, Badge, Spinner, Button, useToast } from '@/components/ui';
import { formatCurrency, formatDate, getInitials, cn, formatSalaryDisplay, formatShiftDisplay, normalizeJob } from '@/lib/utils';
import { JobBenefitsBadgesRow } from '@/components/CompensationAndWorkDetails';
import { NursePhotoAvatar } from '@/components/NursePhotoAvatar';

type Tab = 'overview' | 'users' | 'jobs' | 'applications' | 'verifications' | 'activity';

type Stats = {
  totalUsers: number;
  totalNurses: number;
  verifiedNurses: number;
  unverifiedNurses: number;
  totalHospitals: number;
  verifiedHospitals: number;
  unverifiedHospitals: number;
  totalJobs: number;
  activeJobs: number;
  pendingJobs: number;
  totalApplications: number;
  pendingVerifications: number;
  pendingHospitalVerifications: number;
  interviewsScheduled: number;
  selectedCount: number;
  joinedCount: number;
};

export function AdminPortal({ tab }: { tab: Tab }) {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalNurses: 0,
    verifiedNurses: 0,
    unverifiedNurses: 0,
    totalHospitals: 0,
    verifiedHospitals: 0,
    unverifiedHospitals: 0,
    totalJobs: 0,
    activeJobs: 0,
    pendingJobs: 0,
    totalApplications: 0,
    pendingVerifications: 0,
    pendingHospitalVerifications: 0,
    interviewsScheduled: 0,
    selectedCount: 0,
    joinedCount: 0,
  });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [jobs, setJobs] = useState<(Job & { hospitals: Pick<Hospital, 'hospital_name' | 'name'> })[]>([]);
  const [applications, setApplications] = useState<(Application & { profiles: Pick<Profile, 'full_name'>; jobs: Pick<Job, 'job_title' | 'department'> & { hospitals: Pick<Hospital, 'hospital_name' | 'name'> } })[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [nurseProfiles, setNurseProfiles] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [profilesRes, jobsRes, appsRes, hospitalsRes, nurseProfilesRes, notifRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('jobs').select('*, hospitals(hospital_name, name)').order('created_at', { ascending: false }),
      supabase.from('applications').select('*, profiles(full_name), jobs(job_title, department, hospitals(hospital_name, name))').order('created_at', { ascending: false }),
      supabase.from('hospitals').select('*').order('created_at', { ascending: false }),
      supabase.from('nurse_profiles').select('*, profiles(full_name, email, city, state, verification_status)').order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20),
    ]);

    const profileList = profilesRes.data as Profile[] || [];
    const rawJobList = (jobsRes.data || []) as any[];
    const jobList = rawJobList.map((j) => {
      const norm = normalizeJob(j);
      return {
        ...norm,
        hospitals: j.hospitals || null,
      };
    }) as (Job & { hospitals: Pick<Hospital, 'hospital_name' | 'name'> })[];
    const appList = appsRes.data as any[] || [];
    const rawHospitalList = hospitalsRes.data as Hospital[] || [];
    const nurseProfileList = nurseProfilesRes.data as any[] || [];
    const notifList = notifRes.data as Notification[] || [];

    // Deduplicate hospitals by user_id (1 registered hospital user = 1 hospital entry)
    const hospitalMapByUserId = new Map<string, Hospital>();
    for (const h of rawHospitalList) {
      const key = h.user_id || h.id;
      if (!hospitalMapByUserId.has(key)) {
        hospitalMapByUserId.set(key, h);
      } else {
        const existing = hospitalMapByUserId.get(key)!;
        const existingScore = (existing.verification_status === 'verified' ? 10 : 0) + (existing.address ? 2 : 0) + (existing.number_of_beds ? 1 : 0);
        const currentScore = (h.verification_status === 'verified' ? 10 : 0) + (h.address ? 2 : 0) + (h.number_of_beds ? 1 : 0);
        if (currentScore > existingScore || (currentScore === existingScore && new Date(h.updated_at || h.created_at).getTime() > new Date(existing.updated_at || existing.created_at).getTime())) {
          hospitalMapByUserId.set(key, h);
        }
      }
    }

    // Ensure all profiles with role === 'hospital' have an entry in the deduplicated list
    const hospitalProfiles = profileList.filter((p) => p.role === 'hospital');
    for (const p of hospitalProfiles) {
      if (!hospitalMapByUserId.has(p.id)) {
        hospitalMapByUserId.set(p.id, {
          id: p.id,
          user_id: p.id,
          name: p.full_name,
          hospital_name: p.full_name,
          hospital_type: 'private',
          location: p.state || 'Haryana',
          address: null,
          city: p.city,
          state: p.state || 'Haryana',
          pincode: null,
          number_of_beds: null,
          departments: null,
          contact_person: p.full_name,
          phone: p.phone,
          contact_email: p.email,
          description: null,
          website: null,
          verification_status: p.verification_status || 'pending',
          created_at: p.created_at,
          updated_at: p.updated_at,
        });
      } else {
        // Sync verification_status if profile has newer status
        const currentHosp = hospitalMapByUserId.get(p.id)!;
        if (p.verification_status === 'verified' && currentHosp.verification_status !== 'verified') {
          currentHosp.verification_status = 'verified';
        }
      }
    }

    const hospitalList = Array.from(hospitalMapByUserId.values());

    setProfiles(profileList);
    setJobs(jobList);
    setApplications(appList);
    setHospitals(hospitalList);
    setNurseProfiles(nurseProfileList);
    setNotifications(notifList);

    const nurseUsers = profileList.filter((p) => p.role === 'nurse');
    const verifiedNurses = nurseUsers.filter((p) => p.verification_status === 'verified').length;
    const unverifiedNurses = nurseUsers.filter((p) => p.verification_status !== 'verified').length;

    const verifiedHospitals = hospitalList.filter((h) => h.verification_status === 'verified').length;
    const unverifiedHospitals = hospitalList.filter((h) => h.verification_status !== 'verified').length;

    const activeJobs = jobList.filter((j) => j.status === 'active');
    const pendingJobs = jobList.filter((j) => j.status === 'pending_approval');
    const pendingVerifications = nurseUsers.filter((p) => p.verification_status === 'pending');
    const pendingHospitalVerifications = hospitalList.filter((h) => h.verification_status === 'pending');

    setStats({
      totalUsers: profileList.length,
      totalNurses: nurseUsers.length,
      verifiedNurses,
      unverifiedNurses,
      totalHospitals: hospitalList.length,
      verifiedHospitals,
      unverifiedHospitals,
      totalJobs: jobList.length,
      activeJobs: activeJobs.length,
      pendingJobs: pendingJobs.length,
      totalApplications: appList.length,
      pendingVerifications: pendingVerifications.length,
      pendingHospitalVerifications: pendingHospitalVerifications.length,
      interviewsScheduled: appList.filter((a) => a.status === 'interview_scheduled').length,
      selectedCount: appList.filter((a) => a.status === 'selected').length,
      joinedCount: appList.filter((a) => a.status === 'joined').length,
    });
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <Spinner className="py-20" />;

  if (tab === 'overview') {
    return (
      <Overview
        stats={stats}
        recentApps={applications.slice(0, 5)}
        recentJobs={jobs.slice(0, 5)}
        recentActivity={notifications}
      />
    );
  }
  if (tab === 'users') return <UsersList profiles={profiles} hospitals={hospitals} nurseProfiles={nurseProfiles} />;
  if (tab === 'jobs') return <JobsApproval jobs={jobs} onChanged={loadData} />;
  if (tab === 'applications') return <ApplicationsList applications={applications} />;
  if (tab === 'activity') return <ActivityFeed notifications={notifications} />;
  return <Verifications profiles={profiles} hospitals={hospitals} nurseProfiles={nurseProfiles} onChanged={loadData} />;
}

function getHospitalDisplayName(hospitals: any): string {
  if (!hospitals) return 'Hospital';
  if (Array.isArray(hospitals)) {
    if (hospitals.length === 0) return 'Hospital';
    return hospitals[0]?.hospital_name || hospitals[0]?.name || 'Hospital';
  }
  if (typeof hospitals === 'object') {
    return hospitals.hospital_name || hospitals.name || 'Hospital';
  }
  return String(hospitals);
}

function StatCard({ icon, label, value, color, subtitle }: { icon: ReactNode; label: string; value: string | number; color: string; subtitle?: string }) {
  return (
    <Card className="flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', color)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-sm font-medium text-slate-600 truncate">{label}</div>
        {subtitle && <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>}
      </div>
    </Card>
  );
}

function Overview({ stats, recentApps, recentJobs, recentActivity }: {
  stats: Stats;
  recentApps: (Application & { profiles: Pick<Profile, 'full_name'>; jobs: Pick<Job, 'job_title' | 'department'> & { hospitals: Pick<Hospital, 'hospital_name' | 'name'> } })[];
  recentJobs: (Job & { hospitals: Pick<Hospital, 'hospital_name' | 'name'> })[];
  recentActivity?: Notification[];
}) {
  return (
    <div className="space-y-6">
      {/* Top Core Metrics */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Platform Key Metrics</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Users className="h-6 w-6 text-white" />} label="Total Users" value={stats.totalUsers} color="bg-primary-600" subtitle="Platform accounts" />
          <StatCard icon={<Briefcase className="h-6 w-6 text-white" />} label="Active Jobs" value={stats.activeJobs} color="bg-emerald-600" subtitle={`${stats.totalJobs} total posted`} />
          <StatCard icon={<FileText className="h-6 w-6 text-white" />} label="Applications" value={stats.totalApplications} color="bg-indigo-600" subtitle="Candidates applied" />
          <StatCard icon={<ShieldCheck className="h-6 w-6 text-white" />} label="Pending Verifications" value={stats.pendingVerifications + stats.pendingHospitalVerifications} color="bg-amber-600" subtitle={`${stats.pendingVerifications} nurses, ${stats.pendingHospitalVerifications} hospitals`} />
        </div>
      </div>

      {/* User Verification Breakdown: Nurses and Hospitals */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Nurse Statistics */}
        <Card className="border-l-4 border-l-primary-500">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary-600" />
              <h3 className="font-bold text-slate-900">Nurse Network Metrics</h3>
            </div>
            <Badge color="blue">{stats.totalNurses} Total</Badge>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 p-3.5 text-center">
              <div className="text-xl font-bold text-slate-900">{stats.totalNurses}</div>
              <div className="text-xs font-semibold text-slate-600 mt-1">Total Registered</div>
            </div>
            <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3.5 text-center">
              <div className="text-xl font-bold text-emerald-700">{stats.verifiedNurses}</div>
              <div className="text-xs font-semibold text-emerald-800 mt-1 flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Verified
              </div>
            </div>
            <div className="rounded-xl bg-amber-50/70 border border-amber-100 p-3.5 text-center">
              <div className="text-xl font-bold text-amber-700">{stats.unverifiedNurses}</div>
              <div className="text-xs font-semibold text-amber-800 mt-1 flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" /> Unverified
              </div>
            </div>
          </div>
        </Card>

        {/* Hospital Statistics */}
        <Card className="border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900">Hospital Facility Metrics</h3>
            </div>
            <Badge color="green">{stats.totalHospitals} Total</Badge>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 p-3.5 text-center">
              <div className="text-xl font-bold text-slate-900">{stats.totalHospitals}</div>
              <div className="text-xs font-semibold text-slate-600 mt-1">Total Registered</div>
            </div>
            <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3.5 text-center">
              <div className="text-xl font-bold text-emerald-700">{stats.verifiedHospitals}</div>
              <div className="text-xs font-semibold text-emerald-800 mt-1 flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Verified
              </div>
            </div>
            <div className="rounded-xl bg-amber-50/70 border border-amber-100 p-3.5 text-center">
              <div className="text-xl font-bold text-amber-700">{stats.unverifiedHospitals}</div>
              <div className="text-xs font-semibold text-amber-800 mt-1 flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" /> Unverified
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recruitment Pipeline Status */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Recruitment & Hiring Pipeline</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="flex items-center gap-3">
            <Video className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <div className="text-xl font-bold text-slate-900">{stats.interviewsScheduled}</div>
              <div className="text-xs font-medium text-slate-500">Interviews Scheduled</div>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-teal-500 shrink-0" />
            <div>
              <div className="text-xl font-bold text-slate-900">{stats.selectedCount}</div>
              <div className="text-xs font-medium text-slate-500">Candidates Selected</div>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <Award className="h-5 w-5 text-emerald-500 shrink-0" />
            <div>
              <div className="text-xl font-bold text-slate-900">{stats.joinedCount}</div>
              <div className="text-xs font-medium text-slate-500">Nurses Successfully Joined</div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <TrendingUp className="h-4 w-4 text-primary-500" /> Recent Applications
          </h3>
          {recentApps.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No applications yet</p>
          ) : (
            <div className="space-y-3">
              {recentApps.map((app) => (
                <div key={app.id} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{app.profiles?.full_name}</div>
                    <div className="text-xs text-slate-500">{app.jobs?.job_title} — {getHospitalDisplayName(app.jobs?.hospitals)}</div>
                  </div>
                  <Badge color={app.status === 'applied' ? 'blue' : app.status === 'shortlisted' ? 'teal' : app.status === 'selected' || app.status === 'joined' ? 'green' : app.status === 'rejected' ? 'red' : 'amber'}>
                    {app.status?.replace(/_/g, ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <Briefcase className="h-4 w-4 text-primary-500" /> Recent Jobs
          </h3>
          {recentJobs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No jobs posted yet</p>
          ) : (
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{job.job_title}</div>
                    <div className="text-xs text-slate-500">{getHospitalDisplayName(job.hospitals)} — {job.department}</div>
                  </div>
                  <Badge color={job.status === 'active' ? 'green' : job.status === 'pending_approval' ? 'amber' : job.status === 'rejected' ? 'red' : 'slate'}>
                    {job.status?.replace(/_/g, ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {recentActivity && recentActivity.length > 0 && (
        <Card>
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <ActivityIcon className="h-4 w-4 text-teal-500" /> Platform Notifications & Activity
          </h3>
          <div className="space-y-3">
            {recentActivity.slice(0, 5).map((notif) => (
              <div key={notif.id} className="flex items-start gap-3 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-800">{notif.title}</div>
                  <div className="text-xs text-slate-500">{notif.message}</div>
                </div>
                <span className="text-xs text-slate-400">{formatDate(notif.created_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ActivityFeed({ notifications }: { notifications: Notification[] }) {
  return (
    <Card>
      <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
        <ActivityIcon className="h-4 w-4 text-primary-500" /> Platform Activity Logs
      </h3>
      {notifications.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">No activity logged yet</p>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div key={notif.id} className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <Bell className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-800">{notif.title}</div>
                <div className="text-xs text-slate-500">{notif.message}</div>
              </div>
              <span className="text-xs text-slate-400">{formatDate(notif.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function UsersList({ profiles, hospitals, nurseProfiles }: { profiles: Profile[]; hospitals: Hospital[]; nurseProfiles: any[] }) {
  const [view, setView] = useState<'all' | 'nurses' | 'hospitals'>('all');
  const [selectedHospitalForDocs, setSelectedHospitalForDocs] = useState<Hospital | null>(null);
  const [selectedNurseForDocs, setSelectedNurseForDocs] = useState<{ id: string; name: string } | null>(null);

  const roleConfig: Record<string, { color: 'blue' | 'green' | 'teal'; label: string }> = {
    nurse: { color: 'blue', label: 'Nurse' },
    hospital: { color: 'green', label: 'Hospital' },
    admin: { color: 'teal', label: 'Admin' },
  };

  const verifyConfig: Record<string, { color: 'amber' | 'green' | 'red'; label: string }> = {
    pending: { color: 'amber', label: 'Pending' },
    verified: { color: 'green', label: 'Verified' },
    rejected: { color: 'red', label: 'Rejected' },
  };

  const nurseProfileMap = new Map(nurseProfiles.map((np) => [np.nurse_id, np]));
  const hospitalMap = new Map(hospitals.map((h) => [h.user_id, h]));

  const filtered = profiles.filter((p) => {
    if (view === 'nurses') return p.role === 'nurse';
    if (view === 'hospitals') return p.role === 'hospital';
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant={view === 'all' ? 'primary' : 'ghost'} onClick={() => setView('all')}>All ({profiles.length})</Button>
        <Button size="sm" variant={view === 'nurses' ? 'primary' : 'ghost'} onClick={() => setView('nurses')}>Nurses ({profiles.filter((p) => p.role === 'nurse').length})</Button>
        <Button size="sm" variant={view === 'hospitals' ? 'primary' : 'ghost'} onClick={() => setView('hospitals')}>Hospitals ({profiles.filter((p) => p.role === 'hospital').length})</Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Verification</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const rc = roleConfig[p.role] || roleConfig.nurse;
                const vc = verifyConfig[p.verification_status] || verifyConfig.pending;
                const np = nurseProfileMap.get(p.id);
                const hosp = hospitalMap.get(p.id);
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {getInitials(p.full_name)}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-slate-800">{p.full_name}</span>
                          {p.role === 'nurse' && np?.qualification && (
                            <div className="text-xs text-slate-400">{np.qualification}</div>
                          )}
                          {p.role === 'hospital' && hosp && (
                            <div className="text-xs text-slate-400">{hosp.hospital_name || hosp.name} • {hosp.hospital_type}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">{p.email}</td>
                    <td className="px-5 py-3"><Badge color={rc.color}>{rc.label}</Badge></td>
                    <td className="px-5 py-3"><Badge color={p.status === 'active' ? 'green' : 'red'}>{p.status}</Badge></td>
                    <td className="px-5 py-3"><Badge color={vc.color}>{vc.label}</Badge></td>
                    <td className="px-5 py-3 text-sm text-slate-500">{formatDate(p.created_at)}</td>
                    <td className="px-5 py-3 text-right">
                      {p.role === 'hospital' && hosp && (
                        <Button size="sm" variant="secondary" onClick={() => setSelectedHospitalForDocs(hosp)}>
                          <Eye className="h-3.5 w-3.5" /> Docs
                        </Button>
                      )}
                      {p.role === 'nurse' && (
                        <Button size="sm" variant="secondary" onClick={() => setSelectedNurseForDocs({ id: p.id, name: p.full_name })}>
                          <Eye className="h-3.5 w-3.5" /> Docs
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedHospitalForDocs && (
        <AdminHospitalDocsModal hospital={selectedHospitalForDocs} onClose={() => setSelectedHospitalForDocs(null)} />
      )}
      {selectedNurseForDocs && (
        <AdminNurseDocsModal nurseId={selectedNurseForDocs.id} nurseName={selectedNurseForDocs.name} onClose={() => setSelectedNurseForDocs(null)} />
      )}
    </div>
  );
}

function JobsApproval({ jobs, onChanged }: { jobs: (Job & { hospitals: Pick<Hospital, 'hospital_name' | 'name'> })[]; onChanged: () => void }) {
  const { showToast } = useToast();
  const [localJobs, setLocalJobs] = useState(jobs);
  const [updating, setUpdating] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<(Job & { hospitals: Pick<Hospital, 'hospital_name' | 'name'> }) | null>(null);

  useEffect(() => {
    setLocalJobs(jobs);
  }, [jobs]);

  async function updateJobStatus(jobId: string, status: 'active' | 'rejected') {
    setUpdating(jobId);
    const { error } = await supabase.from('jobs').update({ status }).eq('id', jobId);
    setUpdating(null);
    if (error) { showToast('error', 'Failed to update job status: ' + error.message); return; }
    setLocalJobs(localJobs.map((j) => j.id === jobId ? { ...j, status } : j));
    if (selectedJob && selectedJob.id === jobId) {
      setSelectedJob({ ...selectedJob, status });
    }
    showToast('success', status === 'active' ? 'Job approved and is now live' : 'Job rejected');
    onChanged();
  }

  const pending = localJobs.filter((j) => j.status === 'pending_approval');
  
  const filteredOthers = localJobs.filter((j) => {
    if (filterStatus === 'pending') return j.status === 'pending_approval';
    if (filterStatus !== 'all' && j.status !== filterStatus) return false;
    
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const title = (j.job_title || '').toLowerCase();
      const dept = (j.department || '').toLowerCase();
      const hosp = getHospitalDisplayName(j.hospitals).toLowerCase();
      const loc = (j.location || '').toLowerCase();
      return title.includes(q) || dept.includes(q) || hosp.includes(q) || loc.includes(q);
    }
    return true;
  });

  const statusConfig: Record<string, { color: 'green' | 'blue' | 'amber' | 'red' | 'slate'; label: string }> = {
    active: { color: 'green', label: 'Active' },
    pending_approval: { color: 'amber', label: 'Pending Approval' },
    draft: { color: 'slate', label: 'Draft' },
    closed: { color: 'slate', label: 'Closed' },
    rejected: { color: 'red', label: 'Rejected' },
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by job title, department, hospital, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-4 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 shadow-2xs"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 shadow-2xs"
          >
            <option value="all">All Statuses ({localJobs.length})</option>
            <option value="pending_approval">Pending Approval ({pending.length})</option>
            <option value="active">Active</option>
            <option value="rejected">Rejected</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {pending.length > 0 && filterStatus === 'all' && !searchTerm.trim() && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wide">
              <Clock className="h-4 w-4 text-amber-500" /> Pending Hospital Jobs ({pending.length})
            </h3>
            <span className="text-xs text-slate-500">Review salary & shift transparency before publishing</span>
          </div>

          <div className="space-y-3">
            {pending.map((job) => {
              const salaryFormatted = formatSalaryDisplay(job);
              const shiftFormatted = formatShiftDisplay(job);

              return (
                <Card key={job.id} className="border-amber-200 bg-amber-50/15 p-4 sm:p-5">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-base">{String(job.job_title || 'Untitled Job')}</h4>
                        <Badge color="amber">Pending Approval</Badge>
                        <Badge color="slate">{Number(job.vacancies) || 1} {Number(job.vacancies) === 1 ? 'opening' : 'openings'}</Badge>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
                        <span className="flex items-center gap-1 font-semibold text-primary-800">
                          <Building2 className="h-3.5 w-3.5 text-primary-600" />
                          {getHospitalDisplayName(job.hospitals)}
                        </span>
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Stethoscope className="h-3.5 w-3.5 text-teal-600" />
                          {String(job.department || 'General')}
                        </span>
                        {job.location && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {String(job.location)}
                          </span>
                        )}
                        {job.experience_required != null && (
                          <span className="flex items-center gap-1 text-slate-600">
                            <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                            {String(job.experience_required)}+ yrs exp
                          </span>
                        )}
                      </div>

                      {/* Transparent Compensation & Work Strip */}
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1.5 text-xs">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <div className="flex items-center gap-1 font-bold text-emerald-700">
                            <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Salary: {salaryFormatted.formattedFull}</span>
                          </div>
                          {shiftFormatted.hasDetails && (
                            <div className="flex items-center gap-1 text-slate-700">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              <span>Shift: {shiftFormatted.shift || shiftFormatted.summaryText}</span>
                            </div>
                          )}
                        </div>

                        {/* Benefits Badges */}
                        <div className="pt-1">
                          <JobBenefitsBadgesRow job={job} size="sm" />
                        </div>
                      </div>

                      {job.job_description && (
                        <p className="text-xs text-slate-500 line-clamp-2 italic bg-slate-50 p-2 rounded border border-slate-100">
                          "{String(job.job_description)}"
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center md:flex-col gap-2 pt-2 md:pt-0">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedJob(job)}
                        className="w-full sm:w-auto"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> View Details
                      </Button>
                      <Button
                        size="sm"
                        disabled={updating === job.id}
                        onClick={() => updateJobStatus(job.id, 'active')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={updating === job.id}
                        onClick={() => updateJobStatus(job.id, 'rejected')}
                        className="w-full sm:w-auto"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700 uppercase tracking-wide">
          All Jobs ({filteredOthers.length})
        </h3>
        {filteredOthers.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No jobs match the current criteria</p>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-3">Job Title</th>
                    <th className="px-5 py-3">Hospital</th>
                    <th className="px-5 py-3">Department</th>
                    <th className="px-5 py-3">Compensation & Shifts</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Posted</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOthers.map((job) => {
                    const sc = statusConfig[job.status] || statusConfig.draft;
                    const salaryFormatted = formatSalaryDisplay(job);
                    return (
                      <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-slate-800">
                          <div>{String(job.job_title || 'Untitled Job')}</div>
                          <div className="text-xs text-slate-400">{job.location ? String(job.location) : 'Location flexible'}</div>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600 font-medium">
                          {getHospitalDisplayName(job.hospitals)}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-500">{String(job.department || 'General')}</td>
                        <td className="px-5 py-3 text-xs text-slate-600">
                          <div className="font-semibold text-emerald-700">{salaryFormatted.formattedFull}</div>
                          <div className="text-[11px] text-slate-400">{typeof job.shift === 'string' ? job.shift : 'General shift'}</div>
                        </td>
                        <td className="px-5 py-3"><Badge color={sc.color}>{sc.label}</Badge></td>
                        <td className="px-5 py-3 text-xs text-slate-500">{formatDate(job.created_at)}</td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedJob(job)}
                            className="text-xs"
                          >
                            <Eye className="h-3 w-3 mr-1" /> View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Selected Job Inspection Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900">{String(selectedJob.job_title || 'Job Details')}</h3>
                  <Badge color={statusConfig[selectedJob.status]?.color || 'slate'}>
                    {statusConfig[selectedJob.status]?.label || selectedJob.status}
                  </Badge>
                </div>
                <p className="text-sm font-medium text-primary-700 mt-1">
                  {getHospitalDisplayName(selectedJob.hospitals)} • {String(selectedJob.department || 'General')}
                </p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-400 block">Location</span>
                <span className="font-semibold text-slate-800">{String(selectedJob.location || 'Not specified')}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-400 block">Vacancies</span>
                <span className="font-semibold text-slate-800">{Number(selectedJob.vacancies) || 1}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-400 block">Experience</span>
                <span className="font-semibold text-slate-800">{selectedJob.experience_required != null ? `${selectedJob.experience_required}+ yrs` : 'Any'}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-400 block">Job Type</span>
                <span className="font-semibold text-slate-800 capitalize">{String(selectedJob.job_type || 'Full-time')}</span>
              </div>
            </div>

            {/* Compensation & Work Strip */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <IndianRupee className="h-4 w-4 text-emerald-600" /> Compensation & Benefits
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Offered Salary:</span>
                  <span className="text-base font-extrabold text-emerald-700">
                    {formatSalaryDisplay(selectedJob).formattedFull}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Shift Schedule:</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {formatShiftDisplay(selectedJob).shift || formatShiftDisplay(selectedJob).summaryText || 'Rotational'}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-slate-500 text-xs block mb-1.5">Benefits Included:</span>
                <JobBenefitsBadgesRow job={selectedJob} size="md" />
              </div>
            </div>

            {selectedJob.job_description && (
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Description & Requirements</h4>
                <div className="rounded-xl bg-slate-50 p-3.5 text-xs text-slate-700 leading-relaxed whitespace-pre-line border border-slate-100">
                  {String(selectedJob.job_description)}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-400">
                Posted on {formatDate(selectedJob.created_at)}
              </span>
              <div className="flex items-center gap-2">
                {selectedJob.status === 'pending_approval' && (
                  <>
                    <Button
                      variant="danger"
                      disabled={updating === selectedJob.id}
                      onClick={() => updateJobStatus(selectedJob.id, 'rejected')}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                    <Button
                      disabled={updating === selectedJob.id}
                      onClick={() => updateJobStatus(selectedJob.id, 'active')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Approve Job
                    </Button>
                  </>
                )}
                <Button variant="secondary" onClick={() => setSelectedJob(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApplicationsList({ applications }: { applications: any[] }) {
  const statusColor: Record<string, 'amber' | 'blue' | 'green' | 'red' | 'slate' | 'teal'> = {
    applied: 'blue', under_review: 'amber', shortlisted: 'teal',
    interview_scheduled: 'blue', selected: 'green', joined: 'green', rejected: 'red',
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="px-5 py-3">Nurse</th>
              <th className="px-5 py-3">Job</th>
              <th className="px-5 py-3">Hospital</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Applied</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {applications.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">No applications yet</td></tr>
            ) : applications.map((app) => (
              <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-slate-800">{app.profiles?.full_name || 'Unknown'}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{app.jobs?.job_title || 'N/A'}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{getHospitalDisplayName(app.jobs?.hospitals)}</td>
                <td className="px-5 py-3"><Badge color={statusColor[app.status] || 'slate'}>{app.status?.replace(/_/g, ' ')}</Badge></td>
                <td className="px-5 py-3 text-sm text-slate-500">{formatDate(app.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Verifications({ profiles, hospitals, nurseProfiles, onChanged }: {
  profiles: Profile[];
  hospitals: Hospital[];
  nurseProfiles: any[];
  onChanged: () => void;
}) {
  const [activeType, setActiveType] = useState<'nurses' | 'hospitals'>('nurses');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'verified' | 'all'>('pending');
  const [updating, setUpdating] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedHospitalForDocs, setSelectedHospitalForDocs] = useState<Hospital | null>(null);
  const [selectedNurseForDocs, setSelectedNurseForDocs] = useState<{ id: string; name: string } | null>(null);

  const nurseUsers = profiles.filter((p) => p.role === 'nurse');
  const pendingNurses = nurseUsers.filter((p) => p.verification_status === 'pending');
  const verifiedNurses = nurseUsers.filter((p) => p.verification_status === 'verified');

  const pendingHospitals = hospitals.filter((h) => h.verification_status === 'pending');
  const verifiedHospitals = hospitals.filter((h) => h.verification_status === 'verified');

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  async function verifyProfile(profileId: string, nurseName: string, status: 'verified' | 'rejected') {
    setUpdating(profileId);
    const { error } = await supabase
      .from('profiles')
      .update({ verification_status: status, status: 'active' })
      .eq('id', profileId);

    if (error) {
      setUpdating(null);
      showToast('error', `Failed to update ${nurseName}: ${error.message}`);
      return;
    }

    await supabase
      .from('nurse_profiles')
      .update({ verification_status: status })
      .eq('nurse_id', profileId);

    setUpdating(null);
    showToast('success', `${nurseName} has been ${status === 'verified' ? 'verified' : 'rejected'}.`);
    onChanged();
  }

  async function verifyHospital(hospital: Hospital, status: 'verified' | 'rejected') {
    const hospitalId = hospital.id;
    const targetUserId = hospital.user_id || hospital.id;
    const hospitalName = hospital.hospital_name || hospital.name;

    setUpdating(hospitalId);

    try {
      // 1. Update hospitals table for all records matching this hospital id or user_id
      const { error: hospError } = await supabase
        .from('hospitals')
        .update({ verification_status: status, updated_at: new Date().toISOString() })
        .or(`id.eq.${hospitalId},user_id.eq.${targetUserId}`);

      if (hospError) {
        await supabase
          .from('hospitals')
          .update({ verification_status: status })
          .eq('id', hospitalId);
      }

      // 2. Also update profiles table so profile and hospital verification status stay in exact sync
      if (targetUserId) {
        await supabase
          .from('profiles')
          .update({ verification_status: status, status: 'active', updated_at: new Date().toISOString() })
          .eq('id', targetUserId);
      }

      showToast('success', `${hospitalName} has been ${status === 'verified' ? 'verified' : 'rejected'}.`);
    } catch (err: any) {
      showToast('error', `Failed to update ${hospitalName}: ${err?.message || 'Unknown error'}`);
    } finally {
      setUpdating(null);
      onChanged();
    }
  }

  const displayedNurses = nurseUsers.filter((n) => {
    if (filterStatus === 'pending') return n.verification_status === 'pending';
    if (filterStatus === 'verified') return n.verification_status === 'verified';
    return true;
  });

  const displayedHospitals = hospitals.filter((h) => {
    if (filterStatus === 'pending') return h.verification_status === 'pending';
    if (filterStatus === 'verified') return h.verification_status === 'verified';
    return true;
  });

  return (
    <div className="space-y-6">
      {toast && (
        <div className={cn(
          'fixed top-6 right-6 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg animate-slide-in',
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      )}

      {/* Main Section Navigation Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setActiveType('nurses')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all',
              activeType === 'nurses'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Stethoscope className="h-4 w-4" />
            <span>Nurse Verifications</span>
            <span className={cn(
              'ml-1 rounded-full px-2 py-0.5 text-xs font-bold',
              pendingNurses.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'
            )}>
              {pendingNurses.length} pending
            </span>
          </button>

          <button
            onClick={() => setActiveType('hospitals')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all',
              activeType === 'hospitals'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Building2 className="h-4 w-4" />
            <span>Hospital Verifications</span>
            <span className={cn(
              'ml-1 rounded-full px-2 py-0.5 text-xs font-bold',
              pendingHospitals.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'
            )}>
              {pendingHospitals.length} pending
            </span>
          </button>
        </div>

        {/* Sub filter buttons */}
        <div className="flex gap-1.5 items-center">
          <Button
            size="sm"
            variant={filterStatus === 'pending' ? 'primary' : 'ghost'}
            onClick={() => setFilterStatus('pending')}
          >
            Pending Only
          </Button>
          <Button
            size="sm"
            variant={filterStatus === 'verified' ? 'primary' : 'ghost'}
            onClick={() => setFilterStatus('verified')}
          >
            Verified Only
          </Button>
          <Button
            size="sm"
            variant={filterStatus === 'all' ? 'primary' : 'ghost'}
            onClick={() => setFilterStatus('all')}
          >
            All Records
          </Button>
        </div>
      </div>

      {/* Nurses View */}
      {activeType === 'nurses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary-600" />
              Nurse Verification Queue ({displayedNurses.length})
            </h3>
            <span className="text-xs text-slate-500">
              {verifiedNurses.length} verified • {pendingNurses.length} pending action
            </span>
          </div>

          {displayedNurses.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-slate-800">No Nurses in this Queue</h3>
              <p className="max-w-sm text-sm text-slate-500">
                {filterStatus === 'pending'
                  ? 'All registered nurses are currently verified or reviewed!'
                  : 'No nurse records match the selected filter.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {displayedNurses.map((nurse) => (
                <Card key={nurse.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <NursePhotoAvatar
                      photoUrl={nurse.profile_photo || (nurse as any).avatar_url}
                      name={nurse.full_name}
                      size="md"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{nurse.full_name}</span>
                        <Badge color={nurse.verification_status === 'verified' ? 'green' : nurse.verification_status === 'rejected' ? 'red' : 'amber'}>
                          {nurse.verification_status === 'verified' ? 'Verified' : nurse.verification_status === 'rejected' ? 'Rejected' : 'Unverified / Pending'}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {nurse.email} {nurse.phone && `• ${nurse.phone}`} • {nurse.city || 'City N/A'}, {nurse.state || 'State N/A'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button size="sm" variant="secondary" onClick={() => setSelectedNurseForDocs({ id: nurse.id, name: nurse.full_name })}>
                      <Eye className="h-3.5 w-3.5" /> View Docs
                    </Button>
                    {nurse.verification_status !== 'rejected' && (
                      <Button size="sm" variant="danger" disabled={updating === nurse.id} onClick={() => verifyProfile(nurse.id, nurse.full_name, 'rejected')}>
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    )}
                    {nurse.verification_status !== 'verified' && (
                      <Button size="sm" disabled={updating === nurse.id} onClick={() => verifyProfile(nurse.id, nurse.full_name, 'verified')}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Verify Nurse
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hospitals View */}
      {activeType === 'hospitals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" />
              Hospital Verification Queue ({displayedHospitals.length})
            </h3>
            <span className="text-xs text-slate-500">
              {verifiedHospitals.length} verified • {pendingHospitals.length} pending action
            </span>
          </div>

          {displayedHospitals.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-slate-800">No Hospitals in this Queue</h3>
              <p className="max-w-sm text-sm text-slate-500">
                {filterStatus === 'pending'
                  ? 'All registered hospitals are currently verified or reviewed!'
                  : 'No hospital records match the selected filter.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {displayedHospitals.map((hospital) => (
                <Card key={hospital.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{hospital.hospital_name || hospital.name}</span>
                        <Badge color={hospital.verification_status === 'verified' ? 'green' : hospital.verification_status === 'rejected' ? 'red' : 'amber'}>
                          {hospital.verification_status === 'verified' ? 'Verified' : hospital.verification_status === 'rejected' ? 'Rejected' : 'Unverified / Pending'}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {hospital.city || 'City N/A'}, {hospital.state || 'State N/A'} • {hospital.hospital_type || 'Hospital'} {hospital.phone && `• ${hospital.phone}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button size="sm" variant="secondary" onClick={() => setSelectedHospitalForDocs(hospital)}>
                      <Eye className="h-3.5 w-3.5" /> View Docs
                    </Button>
                    {hospital.verification_status !== 'rejected' && (
                      <Button size="sm" variant="danger" disabled={updating === hospital.id} onClick={() => verifyHospital(hospital, 'rejected')}>
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    )}
                    {hospital.verification_status !== 'verified' && (
                      <Button size="sm" disabled={updating === hospital.id} onClick={() => verifyHospital(hospital, 'verified')}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Verify Hospital
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedHospitalForDocs && (
        <AdminHospitalDocsModal hospital={selectedHospitalForDocs} onClose={() => setSelectedHospitalForDocs(null)} />
      )}
      {selectedNurseForDocs && (
        <AdminNurseDocsModal nurseId={selectedNurseForDocs.id} nurseName={selectedNurseForDocs.name} onClose={() => setSelectedNurseForDocs(null)} />
      )}
    </div>
  );
}

function AdminHospitalDocsModal({ hospital, onClose }: { hospital: Hospital; onClose: () => void }) {
  const [docs, setDocs] = useState<HospitalDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDocs() {
      setLoading(true);
      const queryIds = Array.from(new Set([hospital.id, hospital.user_id].filter(Boolean)));

      const { data } = await supabase
        .from('hospital_documents')
        .select('*')
        .in('hospital_id', queryIds)
        .order('created_at', { ascending: false });
      
      let list = (data as HospitalDocument[]) || [];
      
      // Merge with localStorage if offline/demo
      for (const id of queryIds) {
        const storedA = localStorage.getItem(`nurseconnect_hosp_docs_${id}`);
        const storedB = localStorage.getItem(`demo_hospital_docs_${id}`);
        [storedA, storedB].forEach((st) => {
          if (st) {
            try {
              const parsed = JSON.parse(st);
              if (Array.isArray(parsed)) {
                for (const d of parsed) {
                  if (!list.some((existing) => existing.id === d.id)) {
                    list.push(d);
                  }
                }
              }
            } catch {}
          }
        });
      }
      setDocs(list);
      setLoading(false);
    }
    fetchDocs();
  }, [hospital.id, hospital.user_id]);

  function viewDoc(doc: HospitalDocument) {
    if (doc.file_url) {
      const { data } = supabase.storage.from('hospital-documents').getPublicUrl(doc.file_url);
      window.open(data?.publicUrl || doc.file_url, '_blank');
    }
  }

  function downloadDoc(doc: HospitalDocument) {
    if (doc.file_url) {
      const { data } = supabase.storage.from('hospital-documents').getPublicUrl(doc.file_url);
      const link = document.createElement('a');
      link.href = data?.publicUrl || doc.file_url;
      link.download = doc.document_name || doc.file_name || 'hospital-document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{hospital.hospital_name || hospital.name} - Documents</h3>
            <p className="text-xs text-slate-500">{hospital.city}, {hospital.state} • {hospital.hospital_type}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4">
          {loading ? (
            <Spinner className="py-8" />
          ) : docs.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No documents uploaded for this hospital yet.
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">{doc.document_name || doc.file_name}</span>
                      <Badge color={doc.document_type === 'license' ? 'blue' : 'slate'}>
                        {doc.document_type}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Uploaded {formatDate(doc.uploaded_at || doc.created_at)}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
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
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function AdminNurseDocsModal({ nurseId, nurseName, onClose }: { nurseId: string; nurseName: string; onClose: () => void }) {
  const [docs, setDocs] = useState<NurseDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDocs() {
      setLoading(true);
      const { data } = await supabase
        .from('nurse_documents')
        .select('*')
        .eq('nurse_id', nurseId)
        .order('created_at', { ascending: false });

      const list = (data as NurseDocument[]) || [];
      if (list.length === 0) {
        try {
          const stored = localStorage.getItem(`demo_nurse_docs_${nurseId}`);
          if (stored) {
            setDocs(JSON.parse(stored));
            setLoading(false);
            return;
          }
        } catch {
          // ignore
        }
      }
      setDocs(list);
      setLoading(false);
    }
    fetchDocs();
  }, [nurseId]);

  async function viewDoc(doc: NurseDocument) {
    if (doc.file_url?.startsWith('data:') || doc.file_url?.startsWith('http')) {
      window.open(doc.file_url, '_blank');
      return;
    }
    try {
      const { data } = await supabase.storage.from('nurse-documents').createSignedUrl(doc.file_url, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        const { data: pubData } = supabase.storage.from('nurse-documents').getPublicUrl(doc.file_url);
        window.open(pubData?.publicUrl || doc.file_url, '_blank');
      }
    } catch {
      const { data: pubData } = supabase.storage.from('nurse-documents').getPublicUrl(doc.file_url);
      window.open(pubData?.publicUrl || doc.file_url, '_blank');
    }
  }

  async function downloadDoc(doc: NurseDocument) {
    if (doc.file_url?.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = doc.file_url;
      link.download = doc.document_name || doc.file_name || 'nurse-document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    try {
      const { data } = await supabase.storage.from('nurse-documents').createSignedUrl(doc.file_url, 3600);
      const url = data?.signedUrl || supabase.storage.from('nurse-documents').getPublicUrl(doc.file_url).data?.publicUrl || doc.file_url;
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.document_name || doc.file_name || 'nurse-document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      const { data: pubData } = supabase.storage.from('nurse-documents').getPublicUrl(doc.file_url);
      const link = document.createElement('a');
      link.href = pubData?.publicUrl || doc.file_url;
      link.download = doc.document_name || doc.file_name || 'nurse-document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{nurseName} - Documents</h3>
            <p className="text-xs text-slate-500">Nurse verification documents</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4">
          {loading ? (
            <Spinner className="py-8" />
          ) : docs.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No documents uploaded for this nurse yet.
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((doc) => {
                const docTypeLabels: Record<string, string> = {
                  qualification: 'Qualification Certificate',
                  registration: 'Nursing Registration Certificate',
                  id_proof: 'Government ID Proof',
                  passport_photo: 'Passport-Size Photo',
                  experience: 'Experience Certificate',
                  resume: 'Resume / CV',
                  other: 'Additional Certification',
                };
                const displayType = docTypeLabels[doc.document_type] || doc.document_type.replace(/_/g, ' ');

                return (
                  <div key={doc.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">{doc.file_name || doc.document_name}</span>
                        <Badge color={doc.verification_status === 'verified' ? 'green' : doc.verification_status === 'rejected' ? 'red' : 'green'}>
                          {doc.verification_status === 'verified' ? 'Verified ✓' : doc.verification_status === 'rejected' ? 'Rejected ❌' : 'Uploaded ✓'}
                        </Badge>
                        <Badge color="slate">
                          {displayType}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Uploaded {formatDate(doc.uploaded_at || doc.created_at)}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="secondary" onClick={() => viewDoc(doc)}>
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => downloadDoc(doc)}>
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
