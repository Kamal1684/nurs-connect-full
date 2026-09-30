import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, ArrowLeft, Building2, HeartPulse, Shield, CheckCircle2, Mail, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { PublicUserRole } from '@/lib/supabase';
import { Button, Input, Select } from '@/components/ui';
import { cn } from '@/lib/utils';
import { INDIAN_STATES_AND_UTS } from '@/lib/constants';
import { Logo, LogoIcon } from '@/components/Logo';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

export const INDIAN_STATES = INDIAN_STATES_AND_UTS;

export function AuthPage({
  initialMode = 'login',
  initialRole = 'nurse',
  onBackToHome,
}: {
  initialMode?: AuthMode;
  initialRole?: PublicUserRole | string;
  onBackToHome?: () => void;
}) {
  const { signIn, signUp, resetPasswordForEmail, updateUserPassword, clearPasswordRecovery } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('Haryana');
  const [role, setRole] = useState<PublicUserRole>(initialRole === 'hospital' ? 'hospital' : 'nurse');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error: err } = await signIn(email, password);
        if (err) setError(err);
      } else if (mode === 'signup') {
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        if (role !== 'nurse' && role !== 'hospital') {
          setError('Please select a valid role: Nurse or Hospital');
          setLoading(false);
          return;
        }
        const { error: err, needsEmailConfirmation } = await signUp(email, password, fullName, role, phone, state);
        if (err) {
          setError(err);
        } else if (needsEmailConfirmation) {
          setSuccess('Account created successfully! Please check your email to confirm your address, then sign in.');
        }
      } else if (mode === 'forgot') {
        const { error: err } = await resetPasswordForEmail(email);
        if (err) {
          setError(err);
        } else {
          setSuccess('Password reset link sent! Check your email inbox for instructions to reset your password.');
        }
      } else if (mode === 'reset') {
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        const { error: err } = await updateUserPassword(password);
        if (err) {
          setError(err);
        } else {
          setSuccess('Password updated successfully! You can now sign in with your new password.');
          clearPasswordRecovery();
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<AuthMode, string> = {
    login: 'Welcome back',
    signup: 'Create your account',
    forgot: 'Reset your password',
    reset: 'Set a new password',
  };

  const subtitles: Record<AuthMode, string> = {
    login: 'Sign in to access your dashboard',
    signup: 'Join NurseConnect as a nurse or hospital',
    forgot: 'Enter your email and we\'ll send you a reset link',
    reset: 'Choose a new password for your account',
  };

  const buttonLabels: Record<AuthMode, string> = {
    login: 'Sign in',
    signup: 'Create account',
    forgot: 'Send reset link',
    reset: 'Update password',
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary-700 p-12 text-white lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary-400/10 blur-3xl" />

        <div className="relative">
          <Logo iconSize="md" dark textClassName="text-2xl text-white font-bold" />
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Connecting nurses with hospitals, one shift at a time.
            </h1>
            <p className="mt-4 text-lg text-primary-100">
              A streamlined platform for healthcare staffing — browse open shifts, apply instantly, and manage your workforce.
            </p>
          </div>

          <div className="space-y-4">
            <FeatureRow icon={<HeartPulse className="h-5 w-5" />} title="For Nurses" desc="Find flexible shifts that match your specialty and schedule" />
            <FeatureRow icon={<Building2 className="h-5 w-5" />} title="For Hospitals" desc="Post shifts, review applicants, and fill positions fast" />
            <FeatureRow icon={<Shield className="h-5 w-5" />} title="Secure & Verified" desc="Every professional is credentialed and verified" />
          </div>
        </div>

        <div className="relative text-sm text-primary-200">
          Trusted by healthcare networks nationwide
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex min-h-screen items-center justify-center p-6 lg:min-h-0">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center justify-center lg:hidden">
            <Logo iconSize="md" textClassName="text-xl font-bold text-[#082F63]" />
          </div>

          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to NurseConnect Home
            </button>
          )}

          {(mode === 'forgot' || mode === 'reset') && (
            <button
              onClick={() => switchMode('login')}
              className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </button>
          )}

          <h2 className="text-2xl font-bold text-slate-900">{titles[mode]}</h2>
          <p className="mt-1.5 text-sm text-slate-500">{subtitles[mode]}</p>

          {success ? (
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700 animate-scale-in">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <span>{success}</span>
              </div>
              {mode === 'reset' ? (
                <Button fullWidth size="lg" onClick={() => switchMode('login')}>
                  Go to sign in
                </Button>
              ) : (
                <Button fullWidth size="lg" variant="outline" onClick={() => switchMode('login')}>
                  Back to sign in
                </Button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {mode === 'signup' && (
                <>
                  <Input
                    label="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Smith"
                    required
                    disabled={loading}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Phone number"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      disabled={loading}
                    />
                    <Select
                      label="State"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      required
                      disabled={loading}
                    >
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </Select>
                  </div>
                </>
              )}

              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
              />

              {mode === 'login' && (
                <div className="relative">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600 focus:outline-none p-1 disabled:opacity-50"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              )}

              {mode === 'signup' && (
                <>
                  <div className="relative">
                    <Input
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                      className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600 focus:outline-none p-1 disabled:opacity-50"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Select
                    label="Select Role"
                    value={role}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'nurse' || val === 'hospital') {
                        setRole(val);
                      }
                    }}
                    required
                    disabled={loading}
                  >
                    <option value="nurse">Nurse</option>
                    <option value="hospital">Hospital</option>
                  </Select>
                </>
              )}

              {mode === 'forgot' && (
                <div className="flex items-start gap-2 rounded-lg bg-primary-50 border border-primary-100 px-3.5 py-3 text-xs text-primary-700">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>We'll send a password reset link to this email address. Click the link in the email to set a new password.</span>
                </div>
              )}

              {mode === 'reset' && (
                <>
                  <div className="relative">
                    <Input
                      label="New password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                      className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600 focus:outline-none p-1 disabled:opacity-50"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      label="Confirm new password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={loading}
                      className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600 focus:outline-none p-1 disabled:opacity-50"
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-600">Passwords do not match</p>
                  )}
                </>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-scale-in">
                  {error}
                </div>
              )}

              <Button type="submit" fullWidth size="lg" disabled={loading}>
                {loading ? 'Please wait...' : buttonLabels[mode]}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          )}

          {/* Footer links */}
          {!success && (
            <div className="mt-6 space-y-2 text-center text-sm text-slate-500">
              {mode === 'login' && (
                <>
                  <button
                    onClick={() => switchMode('forgot')}
                    className="block w-full font-medium text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    Forgot password?
                  </button>
                  <span>
                    Don't have an account?{' '}
                    <button
                      onClick={() => switchMode('signup')}
                      className={cn('font-medium text-primary-600 hover:text-primary-700')}
                    >
                      Sign up
                    </button>
                  </span>
                </>
              )}
              {mode === 'signup' && (
                <span>
                  Already have an account?{' '}
                  <button
                    onClick={() => switchMode('login')}
                    className={cn('font-medium text-primary-600 hover:text-primary-700')}
                  >
                    Sign in
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
        {icon}
      </div>
      <div>
        <div className="font-medium text-white">{title}</div>
        <div className="text-sm text-primary-200">{desc}</div>
      </div>
    </div>
  );
}
