import React, { useState, Component, lazy, Suspense, type ReactNode, type ErrorInfo } from 'react';
import {
  Briefcase, FileText, User as UserIcon, Building2, LayoutDashboard,
  Users, ClipboardList, Bookmark, Video, Bell, ShieldCheck, Activity, Award,
} from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { HomePage } from '@/components/HomePage';
import { Spinner, ToastProvider } from '@/components/ui';
import { LogoIcon } from '@/components/Logo';

const AuthPage = lazy(() => import('@/components/AuthPage').then((m) => ({ default: m.AuthPage })));
const DashboardShell = lazy(() => import('@/components/DashboardShell').then((m) => ({ default: m.DashboardShell })));
const NursePortal = lazy(() => import('@/components/NursePortal').then((m) => ({ default: m.NursePortal })));
const HospitalPortal = lazy(() => import('@/components/HospitalPortal').then((m) => ({ default: m.HospitalPortal })));
const AdminPortal = lazy(() => import('@/components/AdminPortal').then((m) => ({ default: m.AdminPortal })));

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  declare state: ErrorBoundaryState;
  declare setState: (state: Partial<ErrorBoundaryState> | ((prevState: ErrorBoundaryState) => Partial<ErrorBoundaryState>)) => void;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application runtime error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="max-w-2xl w-full text-left bg-white rounded-2xl p-6 shadow-xl border border-slate-200">
            <h2 className="text-lg font-bold text-red-600 flex items-center gap-2">
              <span>⚠️ Application Encountered an Error</span>
            </h2>
            <p className="mt-2 text-sm text-slate-700 font-medium">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            {this.state.error?.stack && (
              <details className="mt-4 p-3 bg-slate-100 rounded-lg text-xs font-mono text-slate-800 overflow-x-auto">
                <summary className="cursor-pointer font-bold text-slate-700">Error Stack Trace</summary>
                <pre className="mt-2 whitespace-pre-wrap">{this.state.error.stack}</pre>
                {this.state.errorInfo?.componentStack && (
                  <div className="mt-3 border-t border-slate-200 pt-2">
                    <span className="font-bold text-slate-700 block mb-1">Component Stack:</span>
                    <pre className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                  </div>
                )}
              </details>
            )}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
              >
                Refresh page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 transition-colors"
              >
                Try to Recover
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type NurseTab = 'browse' | 'applications' | 'saved' | 'interviews' | 'profile' | 'documents' | 'notifications';
type HospitalTab = 'jobs' | 'applications' | 'interviews' | 'hired' | 'profile' | 'documents' | 'notifications';
type AdminTab = 'overview' | 'users' | 'jobs' | 'applications' | 'verifications' | 'activity';

function AppContent() {
  const { user, profile, loading, signOut, isPasswordRecovery } = useAuth();
  const [authView, setAuthView] = useState<{
    isOpen: boolean;
    mode: 'login' | 'signup' | 'forgot' | 'reset';
    role: 'nurse' | 'hospital';
  }>({
    isOpen: false,
    mode: 'login',
    role: 'nurse',
  });

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 gap-3">
        <LogoIcon size="md" className="animate-pulse" />
        <Spinner className="h-5 w-5 text-[#082F63]" />
      </div>
    );
  }

  if (!user || !profile) {
    if (isPasswordRecovery) {
      return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50"><Spinner className="h-10 w-10" /></div>}>
          <AuthPage initialMode="reset" />
        </Suspense>
      );
    }

    if (authView.isOpen) {
      return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50"><Spinner className="h-10 w-10" /></div>}>
          <AuthPage
            initialMode={authView.mode}
            initialRole={authView.role}
            onBackToHome={() => setAuthView((prev) => ({ ...prev, isOpen: false }))}
          />
        </Suspense>
      );
    }

    return (
      <HomePage
        onOpenAuth={(mode = 'login', role = 'nurse') =>
          setAuthView({ isOpen: true, mode, role })
        }
      />
    );
  }

  if (isPasswordRecovery) {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50"><Spinner className="h-10 w-10" /></div>}>
        <AuthPage initialMode="reset" />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50"><Spinner className="h-10 w-10" /></div>}>
      {profile.role === 'nurse' && <NurseDashboard />}
      {profile.role === 'hospital' && <HospitalDashboard />}
      {profile.role === 'admin' && <AdminDashboard />}
      {profile.role !== 'nurse' && profile.role !== 'hospital' && profile.role !== 'admin' && (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-semibold text-slate-900">Account not recognized</h2>
            <p className="mt-2 text-sm text-slate-500">
              Your account role is not set up correctly. Please contact support.
            </p>
            <button
              onClick={() => signOut()}
              className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </Suspense>
  );
}

function NurseDashboard() {
  const [tab, setTab] = useState<NurseTab>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('nurse_tab') as NurseTab;
      if (urlTab && ['browse', 'applications', 'saved', 'interviews', 'profile', 'documents', 'notifications'].includes(urlTab)) {
        return urlTab;
      }
    } catch {}
    return 'browse';
  });

  const handleTabChange = (newTab: NurseTab) => {
    setTab(newTab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('nurse_tab', newTab);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  const navItems = [
    { label: 'Browse Jobs', icon: <Briefcase className="h-4.5 w-4.5" />, active: tab === 'browse', onClick: () => handleTabChange('browse') },
    { label: 'My Applications', icon: <FileText className="h-4.5 w-4.5" />, active: tab === 'applications', onClick: () => handleTabChange('applications') },
    { label: 'Saved Jobs', icon: <Bookmark className="h-4.5 w-4.5" />, active: tab === 'saved', onClick: () => handleTabChange('saved') },
    { label: 'Interviews', icon: <Video className="h-4.5 w-4.5" />, active: tab === 'interviews', onClick: () => handleTabChange('interviews') },
    { label: 'My Profile', icon: <UserIcon className="h-4.5 w-4.5" />, active: tab === 'profile', onClick: () => handleTabChange('profile') },
    { label: 'Documents', icon: <FileText className="h-4.5 w-4.5" />, active: tab === 'documents', onClick: () => handleTabChange('documents') },
    { label: 'Notifications', icon: <Bell className="h-4.5 w-4.5" />, active: tab === 'notifications', onClick: () => handleTabChange('notifications') },
  ];

  const titles: Record<NurseTab, { title: string; subtitle: string }> = {
    browse: { title: 'Browse Jobs', subtitle: 'Find and apply to open nursing positions' },
    applications: { title: 'My Applications', subtitle: 'Track the status of your job applications' },
    saved: { title: 'Saved Jobs', subtitle: 'Jobs you have bookmarked for later' },
    interviews: { title: 'My Interviews', subtitle: 'Upcoming and past interview schedules' },
    profile: { title: 'My Profile', subtitle: 'Update your professional information and credentials' },
    documents: { title: 'My Documents', subtitle: 'Upload and manage your certificates and credentials' },
    notifications: { title: 'Notifications', subtitle: 'Updates about your applications and interviews' },
  };

  return (
    <DashboardShell navItems={navItems} title={titles[tab].title} subtitle={titles[tab].subtitle}>
      <NursePortal tab={tab} setTab={handleTabChange} />
    </DashboardShell>
  );
}

function HospitalDashboard() {
  const [tab, setTab] = useState<HospitalTab>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('hosp_tab') as HospitalTab;
      if (urlTab && ['jobs', 'applications', 'interviews', 'hired', 'profile', 'documents', 'notifications'].includes(urlTab)) {
        return urlTab;
      }
    } catch {}
    return 'jobs';
  });

  const handleTabChange = (newTab: HospitalTab) => {
    setTab(newTab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('hosp_tab', newTab);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  const navItems = [
    { label: 'Manage Jobs', icon: <Briefcase className="h-4.5 w-4.5" />, active: tab === 'jobs', onClick: () => handleTabChange('jobs') },
    { label: 'Applications', icon: <ClipboardList className="h-4.5 w-4.5" />, active: tab === 'applications', onClick: () => handleTabChange('applications') },
    { label: 'Interviews', icon: <Video className="h-4.5 w-4.5" />, active: tab === 'interviews', onClick: () => handleTabChange('interviews') },
    { label: 'Hired Nurses', icon: <Award className="h-4.5 w-4.5" />, active: tab === 'hired', onClick: () => handleTabChange('hired') },
    { label: 'Hospital Profile', icon: <Building2 className="h-4.5 w-4.5" />, active: tab === 'profile', onClick: () => handleTabChange('profile') },
    { label: 'Documents', icon: <FileText className="h-4.5 w-4.5" />, active: tab === 'documents', onClick: () => handleTabChange('documents') },
    { label: 'Notifications', icon: <Bell className="h-4.5 w-4.5" />, active: tab === 'notifications', onClick: () => handleTabChange('notifications') },
  ];

  const titles: Record<HospitalTab, { title: string; subtitle: string }> = {
    jobs: { title: 'Manage Jobs', subtitle: 'Post new positions and manage your existing job listings' },
    applications: { title: 'Review Applications', subtitle: 'Shortlist or decline nurses applying for your jobs' },
    interviews: { title: 'Interviews', subtitle: 'Schedule and track interviews with candidates' },
    hired: { title: 'Hired Nurses', subtitle: 'View and manage selected and onboarded nursing staff' },
    profile: { title: 'Hospital Profile', subtitle: 'Update your hospital information visible to nurses' },
    documents: { title: 'Documents', subtitle: 'Upload verification documents for your hospital' },
    notifications: { title: 'Notifications', subtitle: 'Updates about job approvals and applications' },
  };

  return (
    <DashboardShell navItems={navItems} title={titles[tab].title} subtitle={titles[tab].subtitle}>
      <HospitalPortal tab={tab} setTab={handleTabChange} />
    </DashboardShell>
  );
}

function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('admin_tab') as AdminTab;
      if (urlTab && ['overview', 'users', 'jobs', 'applications', 'verifications', 'activity'].includes(urlTab)) {
        return urlTab;
      }
    } catch {}
    return 'overview';
  });

  const handleTabChange = (newTab: AdminTab) => {
    setTab(newTab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('admin_tab', newTab);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  const navItems = [
    { label: 'Overview', icon: <LayoutDashboard className="h-4.5 w-4.5" />, active: tab === 'overview', onClick: () => handleTabChange('overview') },
    { label: 'Users', icon: <Users className="h-4.5 w-4.5" />, active: tab === 'users', onClick: () => handleTabChange('users') },
    { label: 'Jobs', icon: <Briefcase className="h-4.5 w-4.5" />, active: tab === 'jobs', onClick: () => handleTabChange('jobs') },
    { label: 'Applications', icon: <FileText className="h-4.5 w-4.5" />, active: tab === 'applications', onClick: () => handleTabChange('applications') },
    { label: 'Verifications', icon: <ShieldCheck className="h-4.5 w-4.5" />, active: tab === 'verifications', onClick: () => handleTabChange('verifications') },
    { label: 'Activity', icon: <Activity className="h-4.5 w-4.5" />, active: tab === 'activity', onClick: () => handleTabChange('activity') },
  ];

  const titles: Record<AdminTab, { title: string; subtitle: string }> = {
    overview: { title: 'Admin Dashboard', subtitle: 'Platform-wide overview and key metrics' },
    users: { title: 'User Management', subtitle: 'View all registered nurses and hospitals' },
    jobs: { title: 'Job Approvals', subtitle: 'Approve or reject pending job postings' },
    applications: { title: 'All Applications', subtitle: 'Track all nurse applications platform-wide' },
    verifications: { title: 'Verifications', subtitle: 'Verify nurse and hospital accounts' },
    activity: { title: 'Recent Activity', subtitle: 'Latest actions across the platform' },
  };

  return (
    <DashboardShell navItems={navItems} title={titles[tab].title} subtitle={titles[tab].subtitle}>
      <AdminPortal tab={tab} />
    </DashboardShell>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
