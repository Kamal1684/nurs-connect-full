import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile, UserRole, PublicUserRole, Hospital, NurseProfile } from './supabase';

const ALLOWED_PUBLIC_REGISTRATION_ROLES: readonly PublicUserRole[] = ['nurse', 'hospital'];

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  !import.meta.env.VITE_SUPABASE_URL.includes('demo-placeholder') &&
  !import.meta.env.VITE_SUPABASE_URL.includes('placeholder') &&
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  !import.meta.env.VITE_SUPABASE_ANON_KEY.includes('dummy')
);

export function formatAuthError(err: unknown): string {
  if (!err) return 'An unexpected error occurred. Please try again.';

  const rawMsg =
    typeof err === 'string'
      ? err
      : (err as any)?.message || (err instanceof Error ? err.message : String(err));

  console.warn('[Supabase Auth Info]:', rawMsg);

  const lower = rawMsg.toLowerCase();

  if (
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('networkerror') ||
    lower.includes('fetch') ||
    lower.includes('connection refused') ||
    lower.includes('err_name_not_resolved')
  ) {
    if (!isSupabaseConfigured) {
      return 'Supabase is not configured yet. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect to your Supabase project.';
    }
    return 'Unable to connect to the server. Please check your internet connection or verify your Supabase project status.';
  }

  if (lower.includes('invalid login credentials') || lower.includes('invalid_grant')) {
    return 'Invalid email or password. Please verify your credentials and try again.';
  }

  if (
    lower.includes('user already registered') ||
    lower.includes('already exists') ||
    lower.includes('email address is already registered')
  ) {
    return 'An account with this email already exists. Please sign in instead.';
  }

  if (lower.includes('password should be at least') || lower.includes('weak_password')) {
    return 'Password must be at least 6 characters long.';
  }

  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email address via the link sent to your inbox before signing in.';
  }

  if (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('over_email_send_rate_limit') ||
    lower.includes('email rate limit exceeded')
  ) {
    return 'Supabase email rate limit reached (exceeded hourly quota for verification emails). Please wait a few minutes before trying again or contact admin.';
  }

  return rawMsg;
}

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  signUp: (email: string, password: string, fullName: string, role: PublicUserRole | UserRole, phone?: string, state?: string) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>;
  updateUserPassword: (password: string) => Promise<{ error: string | null }>;
  clearPasswordRecovery: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const isSigningUpRef = useRef(false);
  const lastFetchedUidRef = useRef<string | null>(null);

  async function fetchProfile(uid: string, authUser?: User | null) {
    if (lastFetchedUidRef.current === uid && profile) {
      return;
    }
    lastFetchedUidRef.current = uid;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      if (error) {
        console.warn('[Profile Fetch Warning]:', error);
      }

      if (data) {
        setProfile(data as Profile);
        return;
      }

      // If no profile found in database yet, initialize it from auth metadata
      const currentUser = authUser || user;
      if (currentUser && currentUser.id === uid) {
        const role = (currentUser.user_metadata?.role as UserRole) || 'nurse';
        const fullName = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'User';
        const phone = currentUser.user_metadata?.phone || null;
        const state = currentUser.user_metadata?.state || null;

        const newProfile: Partial<Profile> = {
          id: uid,
          email: currentUser.email || '',
          full_name: fullName,
          role,
          phone,
          state,
          status: 'active',
          verification_status: 'pending',
          updated_at: new Date().toISOString(),
        };

        const { data: created, error: insertErr } = await supabase
          .from('profiles')
          .upsert(newProfile, { onConflict: 'id' })
          .select()
          .maybeSingle();

        if (insertErr) {
          console.warn('[Profile Upsert Warning]:', insertErr);
        }

        if (created) {
          setProfile(created as Profile);
        } else {
          // Provide fallback in-memory profile so authentication is not blocked
          setProfile({
            id: uid,
            email: currentUser.email || '',
            full_name: fullName,
            role,
            phone,
            license_number: null,
            specialty: null,
            years_experience: null,
            bio: null,
            avatar_url: null,
            created_at: new Date().toISOString(),
            profile_photo: null,
            city: null,
            state,
            status: 'active',
            verification_status: 'pending',
            updated_at: new Date().toISOString(),
          });
        }

        // Initialize role-specific table record
        if (role === 'hospital') {
          const { data: existingHosp } = await supabase
            .from('hospitals')
            .select('id')
            .eq('user_id', uid)
            .limit(1);

          if (!existingHosp || existingHosp.length === 0) {
            await supabase.from('hospitals').insert({
              user_id: uid,
              name: fullName,
              hospital_name: fullName,
              hospital_type: 'private',
              phone,
              state: state || 'Haryana',
              contact_email: currentUser.email,
              contact_person: fullName,
              location: state || 'Haryana',
              verification_status: 'pending',
            });
          }
        } else if (role === 'nurse') {
          const { data: existingNp } = await supabase
            .from('nurse_profiles')
            .select('id')
            .eq('nurse_id', uid)
            .limit(1);

          if (!existingNp || existingNp.length === 0) {
            await supabase.from('nurse_profiles').insert({
              nurse_id: uid,
              verification_status: 'pending',
            });
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching profile:', err);
      // Ensure user has at least basic metadata profile so they are not locked out
      const currentUser = authUser || user;
      if (currentUser && currentUser.id === uid) {
        setProfile((prev) => prev || {
          id: uid,
          email: currentUser.email || '',
          full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'User',
          role: (currentUser.user_metadata?.role as UserRole) || 'nurse',
          phone: currentUser.user_metadata?.phone || null,
          license_number: null,
          specialty: null,
          years_experience: null,
          bio: null,
          avatar_url: null,
          created_at: new Date().toISOString(),
          profile_photo: null,
          city: null,
          state: currentUser.user_metadata?.state || null,
          status: 'active',
          verification_status: 'pending',
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  useEffect(() => {
    let isMounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('Error getting session:', error);
      }
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id, s.user).finally(() => {
          if (isMounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.warn('Get session catch:', err);
      if (isMounted) setLoading(false);
    });

    // Listen to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, s) => {
      if (!isMounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }

      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        fetchProfile(s.user.id, s.user).finally(() => {
          if (isMounted) setLoading(false);
        });
      } else {
        setProfile(null);
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const signUp: AuthContextType['signUp'] = async (email, password, fullName, role, phone, state) => {
    if (isSigningUpRef.current) {
      return { error: 'Registration is already in progress. Please wait a moment.' };
    }

    // Security check: Public registration is strictly restricted to Nurse and Hospital roles only
    const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';
    if (!ALLOWED_PUBLIC_REGISTRATION_ROLES.includes(normalizedRole as PublicUserRole)) {
      return {
        error: 'Security Error: Public registration only allows Nurse and Hospital accounts. Privileged accounts (Admin / Super Admin) must be managed through secure administrative channels.',
      };
    }

    const publicRole: PublicUserRole = normalizedRole === 'hospital' ? 'hospital' : 'nurse';

    isSigningUpRef.current = true;
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();
    const trimmedPhone = phone?.trim() || null;
    const trimmedState = state?.trim() || null;

    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedName,
            role: publicRole,
            phone: trimmedPhone,
            state: trimmedState,
          },
        },
      });

      if (error) {
        return { error: formatAuthError(error) };
      }

      if (data.user) {
        // Upsert profile in Supabase profiles table
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          email: trimmedEmail,
          full_name: trimmedName,
          role: publicRole,
          phone: trimmedPhone,
          state: trimmedState,
          status: 'active',
          verification_status: 'pending',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        if (profileError) {
          console.warn('Profile creation warning:', profileError);
        }

        // Initialize role table
        if (publicRole === 'hospital') {
          const { data: existingHosp } = await supabase
            .from('hospitals')
            .select('id')
            .eq('user_id', data.user.id)
            .limit(1);

          if (!existingHosp || existingHosp.length === 0) {
            await supabase.from('hospitals').insert({
              user_id: data.user.id,
              name: trimmedName,
              hospital_name: trimmedName,
              hospital_type: 'private',
              phone: trimmedPhone,
              state: trimmedState || 'Haryana',
              contact_email: trimmedEmail,
              contact_person: trimmedName,
              location: trimmedState || 'Haryana',
              verification_status: 'pending',
            });
          }
        } else if (publicRole === 'nurse') {
          const { data: existingNp } = await supabase
            .from('nurse_profiles')
            .select('id')
            .eq('nurse_id', data.user.id)
            .limit(1);

          if (!existingNp || existingNp.length === 0) {
            await supabase.from('nurse_profiles').insert({
              nurse_id: data.user.id,
              verification_status: 'pending',
            });
          }
        }

        if (data.session) {
          setSession(data.session);
          setUser(data.user);
          await fetchProfile(data.user.id, data.user);
          return { error: null, needsEmailConfirmation: false };
        }

        // If data.session was not embedded in signUp response (e.g. Confirm Email is OFF in project),
        // attempt immediate signInWithPassword to establish session right away without prompting user
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (!signInError && signInData.session && signInData.user) {
          setSession(signInData.session);
          setUser(signInData.user);
          await fetchProfile(signInData.user.id, signInData.user);
          return { error: null, needsEmailConfirmation: false };
        }
      }

      return { error: null, needsEmailConfirmation: !data.session };
    } catch (err: unknown) {
      return { error: formatAuthError(err) };
    } finally {
      isSigningUpRef.current = false;
    }
  };

  const signIn: AuthContextType['signIn'] = async (email, password) => {
    const trimmedEmail = email.trim().toLowerCase();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        return { error: formatAuthError(error) };
      }

      if (data.user) {
        setSession(data.session);
        setUser(data.user);
        await fetchProfile(data.user.id, data.user);
      }
      return { error: null };
    } catch (err: unknown) {
      return { error: formatAuthError(err) };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    lastFetchedUidRef.current = null;
    setProfile(null);
    setSession(null);
    setUser(null);
  };

  const refreshProfile = async () => {
    if (user) {
      lastFetchedUidRef.current = null;
      await fetchProfile(user.id, user);
    }
  };

  const resetPasswordForEmail: AuthContextType['resetPasswordForEmail'] = async (email) => {
    const trimmedEmail = email.trim().toLowerCase();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: window.location.origin,
      });
      if (error) {
        return { error: formatAuthError(error) };
      }
      return { error: null };
    } catch (err: unknown) {
      return { error: formatAuthError(err) };
    }
  };

  const updateUserPassword: AuthContextType['updateUserPassword'] = async (password) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        return { error: formatAuthError(error) };
      }
      return { error: null };
    } catch (err: unknown) {
      return { error: formatAuthError(err) };
    }
  };

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        isPasswordRecovery,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        resetPasswordForEmail,
        updateUserPassword,
        clearPasswordRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

