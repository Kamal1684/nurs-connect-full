import { useState, useEffect, useMemo, type FormEvent } from 'react';
import {
  Search, MapPin, Briefcase, Building2,
  ArrowRight, Menu, X, Clock, IndianRupee, Stethoscope,
  Users, CheckCircle2, Calendar,
  Activity, HeartPulse, Award, Baby, Syringe,
  Shield, ArrowUpRight
} from 'lucide-react';
import { supabase, type JobWithHospital } from '@/lib/supabase';
import { Button } from '@/components/ui';
import { LogoIcon } from '@/components/Logo';
import { formatSalaryDisplay, formatShiftDisplay } from '@/lib/utils';
import {
  CompensationAndWorkDetailsSection,
  BeforeYouApplyBanner,
  JobBenefitsBadgesRow,
} from '@/components/CompensationAndWorkDetails';
import {
  VerifiedHospitalBadge,
  HospitalCredibilityCard,
  TrustSummaryBlock,
} from '@/components/HospitalTrustLayer';

interface HomePageProps {
  onOpenAuth: (mode?: 'login' | 'signup', initialRole?: 'nurse' | 'hospital') => void;
}

interface RoleItem {
  name: string;
  label: string;
  dept: string;
  icon: typeof Stethoscope;
}

const POPULAR_ROLES: RoleItem[] = [
  { name: 'Staff Nurse', label: 'Staff Nurse', dept: 'IPD / OPD', icon: Stethoscope },
  { name: 'ICU', label: 'ICU Specialist', dept: 'Critical Care', icon: Activity },
  { name: 'OT', label: 'OT Nurse', dept: 'Theatre', icon: HeartPulse },
  { name: 'NICU', label: 'NICU / PICU', dept: 'Neonatal', icon: Baby },
  { name: 'Emergency', label: 'Emergency Care', dept: 'Trauma', icon: Shield },
  { name: 'Pediatric', label: 'Pediatric', dept: 'Child Health', icon: Award },
  { name: 'Dialysis', label: 'Dialysis Nurse', dept: 'Renal', icon: Syringe },
  { name: 'Home Care', label: 'Home Care', dept: 'Geriatric', icon: Users },
];

export function HomePage({ onOpenAuth }: HomePageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Search state
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');

  // Real Jobs from Supabase
  const [jobs, setJobs] = useState<JobWithHospital[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [selectedJobForModal, setSelectedJobForModal] = useState<JobWithHospital | null>(null);
  const [viewAllJobs, setViewAllJobs] = useState(false);

  // Track navbar scroll state (with state bailout to prevent re-render loops on scroll)
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const next = window.scrollY > 16;
          setIsScrolled((prev) => (prev !== next ? next : prev));
          ticking = false;
        });
        ticking = true;
      }
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load real published & active jobs dynamically from Supabase (efficient limit, no duplicate queries)
  useEffect(() => {
    let isMounted = true;
    async function fetchJobs() {
      setLoadingJobs(true);
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('*, hospitals(id, hospital_name, name, city, state, verification_status, address)')
          .in('status', ['active', 'published', 'Active', 'Published', 'open', 'Open'])
          .order('created_at', { ascending: false })
          .limit(24);

        if (!isMounted) return;

        if (!error && data) {
          setJobs(data as JobWithHospital[]);
        } else if (error) {
          // Resilient fallback query ONLY if relation join encountered an error
          const { data: rawJobs, error: rawError } = await supabase
            .from('jobs')
            .select('*')
            .in('status', ['active', 'published', 'Active', 'Published', 'open', 'Open'])
            .order('created_at', { ascending: false })
            .limit(24);

          if (!isMounted) return;

          if (!rawError && rawJobs && rawJobs.length > 0) {
            const hospIds = Array.from(new Set(rawJobs.map((j) => j.hospital_id).filter(Boolean)));
            let hospMap = new Map();
            if (hospIds.length > 0) {
              const { data: rawHosps } = await supabase
                .from('hospitals')
                .select('id, hospital_name, name, city, state, verification_status, address')
                .in('id', hospIds);

              if (rawHosps) {
                hospMap = new Map(rawHosps.map((h) => [h.id, h]));
              }
            }

            const combined = rawJobs.map((j) => ({
              ...j,
              hospitals: hospMap.get(j.hospital_id) || null,
            }));
            setJobs(combined as JobWithHospital[]);
          } else {
            setJobs([]);
          }
        } else {
          setJobs([]);
        }
      } catch (err) {
        console.warn('Error fetching jobs for homepage:', err);
        if (isMounted) setJobs([]);
      } finally {
        if (isMounted) setLoadingJobs(false);
      }
    }

    fetchJobs();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter jobs based on search inputs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (keyword.trim()) {
        const q = keyword.toLowerCase().trim();
        const matchesKeyword =
          job.job_title?.toLowerCase().includes(q) ||
          job.department?.toLowerCase().includes(q) ||
          job.hospitals?.hospital_name?.toLowerCase().includes(q) ||
          job.hospitals?.name?.toLowerCase().includes(q) ||
          job.required_skills?.toLowerCase().includes(q);
        if (!matchesKeyword) return false;
      }

      if (location.trim()) {
        const loc = location.toLowerCase().trim();
        const matchesLocation =
          job.location?.toLowerCase().includes(loc) ||
          job.hospitals?.city?.toLowerCase().includes(loc) ||
          job.hospitals?.state?.toLowerCase().includes(loc);
        if (!matchesLocation) return false;
      }

      return true;
    });
  }, [jobs, keyword, location]);

  const displayedJobs = viewAllJobs ? filteredJobs : filteredJobs.slice(0, 3);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const target = document.getElementById('editorial-jobs');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleRoleSelect = (roleName: string) => {
    if (keyword.toLowerCase() === roleName.toLowerCase()) {
      setKeyword('');
    } else {
      setKeyword(roleName);
      const target = document.getElementById('editorial-jobs');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  function formatDeadlineDate(job: JobWithHospital) {
    if (job.last_date_to_apply) {
      try {
        const d = new Date(job.last_date_to_apply);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      } catch {
        return job.last_date_to_apply;
      }
    }
    if (job.created_at) {
      const created = new Date(job.created_at);
      created.setDate(created.getDate() + 30);
      return created.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return 'Immediate';
  }

  return (
    <div className="min-h-screen bg-[#F4F8FC] text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-[#082F63] antialiased">
      
      {/* =========================================================================
          1. MINIMAL NAVIGATION
          ========================================================================= */}
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-300 ${
          isScrolled
            ? 'bg-white/95 backdrop-blur-md border-b border-blue-100/80 shadow-xs py-2.5'
            : 'bg-transparent py-3 sm:py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Logo on Left */}
          <a
            href="#"
            className="flex items-center gap-2.5 group focus:outline-hidden"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <LogoIcon size="sm" className="h-7 w-7 transition-transform duration-300 group-hover:scale-105" />
            <span className="text-base sm:text-lg font-bold tracking-tight text-[#082F63]">
              NurseConnect
            </span>
          </a>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-slate-600">
            <button
              onClick={() => scrollToSection('editorial-jobs')}
              className="hover:text-[#082F63] transition-colors cursor-pointer"
            >
              Find Jobs
            </button>
            <button
              onClick={() => scrollToSection('pathways')}
              className="hover:text-[#082F63] transition-colors cursor-pointer"
            >
              For Hospitals
            </button>
            <button
              onClick={() => scrollToSection('pathways')}
              className="hover:text-[#082F63] transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('why-nurseconnect')}
              className="hover:text-[#082F63] transition-colors cursor-pointer"
            >
              Why NurseConnect
            </button>
          </nav>

          {/* Right Action Links */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => onOpenAuth('login')}
              className="text-xs font-semibold text-slate-700 hover:text-[#082F63] transition-colors cursor-pointer px-2.5 py-1.5"
            >
              Login
            </button>
            <Button
              size="sm"
              onClick={() => onOpenAuth('signup', 'nurse')}
              className="rounded-full px-4 py-1.5 text-xs font-semibold bg-[#082F63] hover:bg-[#0c4389] text-white shadow-xs transition-all cursor-pointer"
            >
              Get Started
            </Button>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex sm:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
              className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-b border-slate-200 bg-white px-5 py-4 space-y-3 shadow-lg">
            <nav className="flex flex-col space-y-2 text-xs font-medium text-slate-700">
              <button
                onClick={() => scrollToSection('editorial-jobs')}
                className="text-left py-1.5 hover:text-[#082F63] transition-colors"
              >
                Find Jobs
              </button>
              <button
                onClick={() => scrollToSection('pathways')}
                className="text-left py-1.5 hover:text-[#082F63] transition-colors"
              >
                For Hospitals
              </button>
              <button
                onClick={() => scrollToSection('pathways')}
                className="text-left py-1.5 hover:text-[#082F63] transition-colors"
              >
                How It Works
              </button>
              <button
                onClick={() => scrollToSection('why-nurseconnect')}
                className="text-left py-1.5 hover:text-[#082F63] transition-colors"
              >
                Why NurseConnect
              </button>
            </nav>
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth('login');
                }}
                className="flex-1 text-center py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors"
              >
                Login
              </button>
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth('signup', 'nurse');
                }}
                className="flex-1 justify-center bg-[#082F63] hover:bg-[#0c4389] text-white rounded-full py-2 text-xs font-semibold"
              >
                Get Started
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* =========================================================================
          1. HERO — LIGHT BLUE BACKGROUND (#F4F8FC → #EAF2FA) + LARGE DOMINANT NURSE PHOTO
          ========================================================================= */}
      <section className="relative pt-2 sm:pt-4 pb-8 sm:pb-12 overflow-hidden bg-gradient-to-b from-[#F4F8FC] to-[#EAF2FA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            
            {/* Left Content Column (7 cols) */}
            <div className="lg:col-span-7 space-y-4 sm:space-y-5">
              
              {/* Category Super-title */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/85 backdrop-blur-xs border border-blue-200/70 text-[#082F63] text-[11px] font-semibold tracking-wide shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Verified Nurses · Trusted Hospitals</span>
              </div>

              {/* Editorial Headline */}
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-4xl md:text-[44px] lg:text-[48px] font-extrabold text-slate-900 tracking-tight leading-[1.12]">
                  Find the Right Nursing Job.{' '}
                  <span className="text-[#082F63] block font-serif italic font-normal pt-1">
                    Build Your Future.
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 max-w-lg font-normal leading-relaxed">
                  Connecting verified nurses with accredited healthcare institutions across India. Direct applications, transparent salaries, and zero agency fees.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  onClick={() => scrollToSection('editorial-jobs')}
                  className="bg-[#082F63] hover:bg-[#0c4389] text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-xs flex items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02]"
                >
                  Find Nursing Jobs <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <button
                  onClick={() => onOpenAuth('signup', 'hospital')}
                  className="bg-white/80 hover:bg-white text-[#082F63] border border-blue-200 hover:border-blue-300 text-xs font-semibold px-5 py-2.5 rounded-full shadow-2xs transition-all cursor-pointer"
                >
                  Hire Nurses
                </button>
              </div>

              {/* Compact Integrated Job Search */}
              <div className="pt-1 max-w-lg">
                <form
                  onSubmit={handleSearchSubmit}
                  className="bg-white rounded-2xl sm:rounded-full border border-blue-200/80 p-1.5 sm:p-2 shadow-xs hover:border-blue-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                    
                    {/* Role / Specialty input */}
                    <div className="flex-1 flex items-center px-3 py-1">
                      <Search className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-2" />
                      <input
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="Specialty (ICU, OT) or Role..."
                        className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
                      />
                      {keyword && (
                        <button
                          type="button"
                          onClick={() => setKeyword('')}
                          className="text-slate-400 hover:text-slate-600 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    <div className="hidden sm:block w-[1px] h-5 bg-slate-200" />

                    {/* Location input */}
                    <div className="flex-1 flex items-center px-3 py-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-2" />
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="City or state..."
                        className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
                      />
                      {location && (
                        <button
                          type="button"
                          onClick={() => setLocation('')}
                          className="text-slate-400 hover:text-slate-600 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {/* Search Submit */}
                    <Button
                      type="submit"
                      size="sm"
                      className="rounded-xl sm:rounded-full bg-[#082F63] hover:bg-[#0c4389] text-white text-xs font-semibold px-4 py-2 shadow-2xs cursor-pointer shrink-0"
                    >
                      Search
                    </Button>
                  </div>
                </form>
              </div>

            </div>

            {/* Right Large Dominant Nurse Photograph (5 cols - approx 45% width visually, ~400-500px height on desktop, ~280-360px on mobile) */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="relative w-full max-w-md lg:max-w-none rounded-3xl overflow-hidden bg-white/60 shadow-lg border border-blue-200/80 h-[300px] sm:h-[360px] lg:h-[480px] aspect-[4/4.6] group">
                <img
                  src="/images/hero_nurse.webp"
                  alt="Professional Registered Nurse in modern healthcare facility"
                  width={720}
                  height={894}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  onError={(e) => console.error("Failed to load Hero Nurse image:", e.currentTarget.src)}
                  className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-103"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent opacity-60 pointer-events-none" />
                
                {/* Floating Micro Trust Badge */}
                <div className="absolute bottom-3.5 left-3.5 right-3.5 bg-white/95 backdrop-blur-md py-2.5 px-3.5 rounded-2xl border border-white/80 shadow-md flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                      <span className="text-[11px] font-bold text-slate-900 block leading-tight">
                        Direct Hospital Applications
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Zero agency commission
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#082F63] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                    100% Free for Nurses
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          2. TRUST + POPULAR ROLES — CRISP WHITE WITH SUBTLE 5-8% HEALTHCARE BACKGROUND
          ========================================================================= */}
      <section className="relative py-6 sm:py-8 bg-white border-t border-b border-slate-200/80 overflow-hidden">
        {/* Subtle Modern Healthcare Background Image Texture */}
        <div className="absolute inset-0 opacity-[0.10] mix-blend-multiply pointer-events-none overflow-hidden select-none" aria-hidden="true">
          <img
            src="/images/trust_medical_bg.webp"
            alt=""
            width={1280}
            height={720}
            loading="lazy"
            decoding="async"
            onError={(e) => console.error("Failed to load Trust background:", e.currentTarget.src)}
            className="w-full h-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          
          {/* Trust Line */}
          <div className="flex flex-wrap items-center justify-center gap-y-2 gap-x-6 sm:gap-x-10 text-xs font-semibold text-slate-700">
            <span className="inline-flex items-center gap-1.5 text-slate-800">
              <Shield className="h-3.5 w-3.5 text-[#082F63]" />
              Verified Nurse Profiles
            </span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="inline-flex items-center gap-1.5 text-slate-800">
              <Building2 className="h-3.5 w-3.5 text-[#082F63]" />
              Verified Hospitals
            </span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="inline-flex items-center gap-1.5 text-slate-800">
              <Briefcase className="h-3.5 w-3.5 text-[#082F63]" />
              Real Nursing Jobs
            </span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="inline-flex items-center gap-1.5 text-slate-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#082F63]" />
              Secure Applications
            </span>
          </div>

          {/* Popular Roles Compact Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {POPULAR_ROLES.map((role) => {
              const isSelected = keyword.toLowerCase() === role.name.toLowerCase();
              return (
                <button
                  key={role.name}
                  type="button"
                  onClick={() => handleRoleSelect(role.name)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#082F63] text-white shadow-xs'
                      : 'bg-white/90 backdrop-blur-xs text-slate-700 border border-slate-200 hover:border-slate-400 hover:bg-slate-50 shadow-2xs'
                  }`}
                >
                  <span>{role.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200/60'
                  }`}>
                    {role.dept}
                  </span>
                </button>
              );
            })}
          </div>

        </div>
      </section>

      {/* =========================================================================
          3. LATEST JOBS — MODERN HOSPITAL INTERIOR BACKGROUND WITH CRISP WHITE CARDS
          ========================================================================= */}
      <section id="editorial-jobs" className="relative py-10 sm:py-14 bg-[#F7FAFD] border-b border-blue-100/60 overflow-hidden">
        {/* Subtle Modern Hospital Interior Background Photo */}
        <div className="absolute inset-0 opacity-[0.12] mix-blend-multiply pointer-events-none overflow-hidden select-none" aria-hidden="true">
          <img
            src="/images/jobs_hospital_bg.webp"
            alt=""
            width={1280}
            height={720}
            loading="lazy"
            decoding="async"
            onError={(e) => console.error("Failed to load Jobs background:", e.currentTarget.src)}
            className="w-full h-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-blue-100">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Latest Nursing Jobs
                </h2>
                {filteredJobs.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100/80 text-[#082F63] border border-blue-200">
                    {filteredJobs.length} active {filteredJobs.length === 1 ? 'job' : 'jobs'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Verified nurses. Verified hospitals. Transparent opportunities.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-3">
              {(keyword || location) && (
                <button
                  onClick={() => {
                    setKeyword('');
                    setLocation('');
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 underline cursor-pointer"
                >
                  Clear Filters ({keyword || location})
                </button>
              )}
              {filteredJobs.length > 3 && (
                <button
                  onClick={() => setViewAllJobs(!viewAllJobs)}
                  className="text-xs font-semibold text-[#082F63] hover:text-[#0c4389] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {viewAllJobs ? 'Show Top 3 Jobs' : `View All (${filteredJobs.length}) →`}
                </button>
              )}
            </div>
          </div>

          {/* Job Showcase List */}
          {loadingJobs ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-2xs">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                  <div className="h-8 bg-slate-200 rounded-full w-20" />
                </div>
              ))}
            </div>
          ) : displayedJobs.length === 0 ? (
            <div className="py-12 px-4 rounded-2xl border border-dashed border-slate-200 text-center bg-white">
              <Briefcase className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">
                No active positions found matching your criteria
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Try clearing specialty keywords or searching a broader location.
              </p>
              {(keyword || location) && (
                <button
                  type="button"
                  onClick={() => {
                    setKeyword('');
                    setLocation('');
                  }}
                  className="mt-3 inline-flex items-center text-xs font-semibold text-[#082F63] hover:underline"
                >
                  Reset search filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedJobs.map((job) => {
                const hospitalName = job.hospitals?.hospital_name || job.hospitals?.name || 'Accredited Medical Center';
                const jobLoc = job.location || (job.hospitals?.city ? `${job.hospitals.city}, ${job.hospitals.state || ''}` : 'Flexible');
                const expText = job.experience_required != null
                  ? (job.experience_required === 0 ? '0+ Yrs (Freshers)' : `${job.experience_required}+ Yrs Exp`)
                  : 'Open to All Exp';
                const deadline = formatDeadlineDate(job);
                const vacanciesText = `${job.vacancies || 1} ${(job.vacancies || 1) === 1 ? 'vacancy' : 'vacancies'}`;
                const isVerified = job.hospitals?.verification_status === 'verified';

                return (
                  <div
                    key={job.id}
                    className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-blue-300 shadow-2xs hover:shadow-xs group flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                  >
                    {/* Left Column: Job Info & Trust Hierarchy */}
                    <div className="space-y-2 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <VerifiedHospitalBadge
                          isVerified={isVerified}
                          verificationStatus={job.hospitals?.verification_status}
                          size="xs"
                        />
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-[#082F63] transition-colors">
                          {job.job_title}
                        </h3>
                        {job.department && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#082F63] border border-blue-100">
                            {job.department}
                          </span>
                        )}
                      </div>

                      {/* Metadata row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-semibold text-slate-800">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          {hospitalName}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          {jobLoc}
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[11px] border border-emerald-200/50">
                          <IndianRupee className="h-3 w-3 text-emerald-600" />
                          {formatSalaryDisplay(job).formattedFull}
                        </span>
                        {job.shift && (
                          <span className="inline-flex items-center gap-1 text-slate-600 text-[11px]">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {formatShiftDisplay(job).summaryText}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {expText}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          {vacanciesText}
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                          <Calendar className="h-3 w-3" />
                          Apply by: {deadline}
                        </span>
                      </div>

                      {/* Transparency Badges Row */}
                      <div className="pt-0.5">
                        <JobBenefitsBadgesRow job={job} size="sm" />
                      </div>
                    </div>

                    {/* Right Column: Actions */}
                    <div className="flex items-center gap-2.5 shrink-0 pt-1 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => setSelectedJobForModal(job)}
                        className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-full border border-slate-200 bg-slate-50/50 hover:bg-slate-100 transition-all cursor-pointer"
                      >
                        View Job
                      </button>
                      <Button
                        size="sm"
                        onClick={() => setSelectedJobForModal(job)}
                        className="rounded-full text-xs font-semibold px-4 py-2 bg-[#082F63] hover:bg-[#0c4389] text-white shadow-2xs cursor-pointer flex items-center gap-1"
                      >
                        Apply <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </section>

      {/* =========================================================================
          4. NURSE + HOSPITAL PATHWAYS — IMAGE-LED WITH DISTINCT SOFT BACKGROUNDS
             Nurse: #EEF5FC | Hospital: #F5F8FB (Images occupy ~45-50% height/width)
          ========================================================================= */}
      <section id="pathways" className="py-12 sm:py-16 bg-white border-t border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="text-center max-w-xl mx-auto space-y-1.5">
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#082F63]">
              Dual Pathways
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Simple Journeys for Nurses & Hospitals
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-stretch">
            
            {/* LEFT: For Nurses (Soft Background: #EEF5FC) */}
            <div className="bg-[#EEF5FC] rounded-3xl p-5 sm:p-6 border border-blue-200/70 shadow-xs flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                
                {/* Nurse Image - Prominent, bright & large (~45-50% height) */}
                <div className="relative h-60 sm:h-72 w-full rounded-2xl overflow-hidden bg-slate-100 shadow-sm group">
                  <img
                    src="/images/nurse_pathway.webp"
                    alt="Professional Registered Nurse Pathway"
                    width={720}
                    height={894}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => console.error("Failed to load Nurse Pathway image:", e.currentTarget.src)}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-103"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#082F63]/80 via-transparent to-transparent flex items-end p-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">
                        For Registered Nurses
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                        Advance Your Nursing Career
                      </h3>
                    </div>
                  </div>
                </div>

                {/* 3-Step Journey */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-[#082F63] block">01. Profile</span>
                    <p className="text-[10px] text-slate-600 mt-0.5">Add credentials</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-[#082F63] block">02. Find Jobs</span>
                    <p className="text-[10px] text-slate-600 mt-0.5">Filter openings</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-[#082F63] block">03. Apply</span>
                    <p className="text-[10px] text-slate-600 mt-0.5">Direct to HR</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => onOpenAuth('signup', 'nurse')}
                className="w-full h-11 rounded-full font-semibold bg-[#082F63] hover:bg-[#0c4389] text-white text-xs justify-center cursor-pointer shadow-xs"
              >
                Find Nursing Jobs <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>

            {/* RIGHT: For Hospitals (Soft Background: #F5F8FB) */}
            <div className="bg-[#F5F8FB] rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                
                {/* Hospital Image - Modern architectural hospital photography (~45-50% height) */}
                <div className="relative h-60 sm:h-72 w-full rounded-2xl overflow-hidden bg-slate-100 shadow-sm group">
                  <img
                    src="/images/hospital_pathway.webp"
                    alt="Modern Accredited Hospital Medical Center"
                    width={960}
                    height={536}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => console.error("Failed to load Hospital Pathway image:", e.currentTarget.src)}
                    className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-103"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#082F63]/80 via-transparent to-transparent flex items-end p-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">
                        For Healthcare Institutions
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                        Hire Qualified Clinical Staff
                      </h3>
                    </div>
                  </div>
                </div>

                {/* 3-Step Journey */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-800 block">01. Profile</span>
                    <p className="text-[10px] text-slate-600 mt-0.5">Register hospital</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-800 block">02. Post Job</span>
                    <p className="text-[10px] text-slate-600 mt-0.5">Set ward criteria</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-800 block">03. Hire</span>
                    <p className="text-[10px] text-slate-600 mt-0.5">Interview directly</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => onOpenAuth('signup', 'hospital')}
                className="w-full h-11 rounded-full font-semibold bg-white border border-[#082F63] text-[#082F63] hover:bg-blue-50/70 text-xs justify-center cursor-pointer shadow-xs"
              >
                Hire Qualified Nurses <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          5. WHY NURSECONNECT + VISION — DEEP BLUE #082F63 WITH SUBTLE MEDICAL TEXTURE
          ========================================================================= */}
      <section id="why-nurseconnect" className="py-14 sm:py-20 bg-[#082F63] text-white relative overflow-hidden">
        {/* Subtle Healthcare / Abstract Medical Technology Background Texture */}
        <div className="absolute inset-0 opacity-[0.22] mix-blend-screen pointer-events-none overflow-hidden select-none" aria-hidden="true">
          <img
            src="/images/why_nurseconnect.webp"
            alt=""
            width={1280}
            height={720}
            loading="lazy"
            decoding="async"
            onError={(e) => console.error("Failed to load Why NurseConnect visual:", e.currentTarget.src)}
            className="w-full h-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Subtle decorative glow accents */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div className="max-w-3xl space-y-3">
            <span className="text-[11px] font-bold tracking-wider uppercase text-blue-200 bg-blue-900/60 px-3 py-1 rounded-full border border-blue-400/30">
              The NurseConnect Standard
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-tight text-white">
              A better way to connect nurses and hospitals.
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 font-serif italic font-normal leading-relaxed pt-1">
              “Building a trusted healthcare workforce where every nurse gets the right opportunity and every hospital finds the right talent.”
            </p>
          </div>

          {/* 5-Benefit Grid with subtle lighter-blue elements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-4 border-t border-blue-700/60">
            <div className="bg-white/5 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10 space-y-1.5 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-1.5 text-blue-300">
                <Shield className="h-4 w-4" />
                <span className="text-xs font-bold text-white">Verified Nurses</span>
              </div>
              <p className="text-[11px] text-blue-200/80 leading-snug">
                Authenticated qualifications, specialty certifications, and clinical backgrounds.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10 space-y-1.5 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-1.5 text-blue-300">
                <Building2 className="h-4 w-4" />
                <span className="text-xs font-bold text-white">Verified Hospitals</span>
              </div>
              <p className="text-[11px] text-blue-200/80 leading-snug">
                Direct hospital onboarding with authentic department vacancies.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10 space-y-1.5 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-1.5 text-blue-300">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-bold text-white">Direct Candidate Delivery</span>
              </div>
              <p className="text-[11px] text-blue-200/80 leading-snug">
                Direct candidate delivery to hospital HR with zero agency fees.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10 space-y-1.5 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-1.5 text-blue-300">
                <IndianRupee className="h-4 w-4" />
                <span className="text-xs font-bold text-white">Transparent Pay</span>
              </div>
              <p className="text-[11px] text-blue-200/80 leading-snug">
                Upfront salary bands, shift details, and clear role expectations.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10 space-y-1.5 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-1.5 text-blue-300">
                <Activity className="h-4 w-4" />
                <span className="text-xs font-bold text-white">Live Tracking</span>
              </div>
              <p className="text-[11px] text-blue-200/80 leading-snug">
                Live interview alerts and status tracking in real time.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* =========================================================================
          6. FINAL CTA — SOFT BLUE GRADIENT + HOSPITAL ARCHITECTURAL ACCENT
          ========================================================================= */}
      <section className="relative py-12 sm:py-16 overflow-hidden bg-gradient-to-r from-[#EBF3FB] via-[#F2F7FD] to-[#E5EFF9] border-t border-blue-100">
        
        {/* Subtle Architectural Hospital Background Image Overlay */}
        <div className="absolute inset-0 opacity-[0.20] mix-blend-multiply pointer-events-none overflow-hidden" aria-hidden="true">
          <img
            src="/images/cta_hospital.webp"
            alt=""
            width={1280}
            height={720}
            loading="lazy"
            decoding="async"
            onError={(e) => console.error("Failed to load Final CTA hospital image:", e.currentTarget.src)}
            className="w-full h-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white/90 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-blue-200/80 shadow-md">
            <div className="space-y-1.5 text-center md:text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#082F63]">
                Start Today
              </span>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                Your next opportunity starts here.
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md">
                Whether advancing your nursing career or hiring clinical staff, get started in minutes.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
              <Button
                onClick={() => onOpenAuth('signup', 'nurse')}
                className="bg-[#082F63] hover:bg-[#0c4389] text-white text-xs font-bold px-6 py-3 rounded-full shadow-xs transition-transform hover:scale-102 cursor-pointer"
              >
                Find Nursing Jobs
              </Button>
              <button
                onClick={() => onOpenAuth('signup', 'hospital')}
                className="bg-white hover:bg-slate-50 text-[#082F63] border border-slate-300 hover:border-slate-400 text-xs font-semibold px-6 py-3 rounded-full transition-all cursor-pointer shadow-2xs"
              >
                Hire Nurses
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. MINIMAL FOOTER
          ========================================================================= */}
      <footer className="py-8 bg-slate-900 text-slate-400 text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <LogoIcon size="sm" className="h-6 w-6" />
              <span className="font-bold text-white text-sm">NurseConnect</span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">· Healthcare Recruitment Reimagined</span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <span>Verified Nurse Profiles</span>
              <span className="text-slate-600">·</span>
              <span>Verified Hospitals</span>
              <span className="text-slate-600">·</span>
              <span>Secure Applications</span>
            </div>
          </div>

          <div className="text-center sm:text-left text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
            © {new Date().getFullYear()} NurseConnect. All rights reserved.
          </div>
        </div>
      </footer>

      {/* =========================================================================
          JOB DETAILS & QUICK APPLY MODAL
          ========================================================================= */}
      {selectedJobForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
            onClick={() => setSelectedJobForModal(null)}
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 animate-scale-in">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{selectedJobForModal.job_title}</h3>
                  <VerifiedHospitalBadge
                    isVerified={selectedJobForModal.hospitals?.verification_status === 'verified'}
                    verificationStatus={selectedJobForModal.hospitals?.verification_status}
                    size="xs"
                    showUnverifiedState={true}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-700">
                    {selectedJobForModal.hospitals?.hospital_name || selectedJobForModal.hospitals?.name}
                  </span>
                  <span>·</span>
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>{selectedJobForModal.location || 'Flexible'}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedJobForModal(null)}
                aria-label="Close modal"
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-3.5 space-y-3.5 text-xs text-slate-600 max-h-[60vh] overflow-y-auto">
              {/* 1. Transparent Salary & Work/Shift Details */}
              <CompensationAndWorkDetailsSection job={selectedJobForModal} />

              {/* 2. Before You Apply & Application Deadline Checklist */}
              <BeforeYouApplyBanner job={selectedJobForModal} />

              {/* 3. About This Hospital / Trust Card */}
              <HospitalCredibilityCard
                hospital={selectedJobForModal.hospitals}
                hospitalId={selectedJobForModal.hospital_id}
              />

              {/* 4. Clinical Requirements & Position Specifications */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Department</span>
                  <span className="font-bold text-slate-800 text-xs">{selectedJobForModal.department || 'General Nursing'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Experience</span>
                  <span className="font-bold text-slate-800 text-xs">{selectedJobForModal.experience_required != null ? (selectedJobForModal.experience_required === 0 ? 'Freshers (0+ Yrs)' : `${selectedJobForModal.experience_required}+ Years`) : 'Open'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Openings</span>
                  <span className="font-bold text-slate-800 text-xs">{selectedJobForModal.vacancies || 1} {(selectedJobForModal.vacancies || 1) === 1 ? 'vacancy' : 'vacancies'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Salary</span>
                  <span className="font-bold text-emerald-700 text-xs">
                    {formatSalaryDisplay(selectedJobForModal).formattedFull}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Qualification</span>
                  <span className="font-bold text-slate-800 text-xs">{selectedJobForModal.qualification_required || 'B.Sc / GNM Nursing'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Deadline</span>
                  <span className="font-bold text-amber-700 text-xs">{formatDeadlineDate(selectedJobForModal)}</span>
                </div>
              </div>

              {selectedJobForModal.job_description && (
                <div>
                  <span className="font-bold text-slate-900 block mb-1 text-xs">Job Description</span>
                  <p className="leading-relaxed text-slate-600 text-xs bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                    {selectedJobForModal.job_description}
                  </p>
                </div>
              )}

              {selectedJobForModal.required_skills && (
                <div>
                  <span className="font-bold text-slate-900 block mb-1 text-xs">Required Clinical Skills</span>
                  <p className="leading-relaxed text-slate-600 text-xs bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                    {selectedJobForModal.required_skills}
                  </p>
                </div>
              )}

              {/* 5. Trust Summary Guarantee */}
              <TrustSummaryBlock
                hospitalVerified={selectedJobForModal.hospitals?.verification_status === 'verified'}
                credentialsVerified={true}
                hasSalaryTransparency={Boolean(selectedJobForModal.salary_min || selectedJobForModal.salary_max)}
                hasShiftTransparency={Boolean(selectedJobForModal.shift || selectedJobForModal.duty_hours)}
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedJobForModal(null);
                  onOpenAuth('login', 'nurse');
                }}
                className="text-xs font-semibold text-[#082F63] hover:text-[#0c4389] underline cursor-pointer"
              >
                Sign In to Apply
              </button>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedJobForModal(null)}
                  className="text-xs rounded-full px-3.5 cursor-pointer"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedJobForModal(null);
                    onOpenAuth('signup', 'nurse');
                  }}
                  className="bg-[#082F63] hover:bg-[#0c4389] text-white rounded-full text-xs font-semibold px-4 cursor-pointer"
                >
                  Apply Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
