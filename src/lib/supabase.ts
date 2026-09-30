import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo-placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type UserRole = 'nurse' | 'hospital' | 'admin';
export type PublicUserRole = 'nurse' | 'hospital';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  license_number: string | null;
  specialty: string | null;
  years_experience: number | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  profile_photo: string | null;
  city: string | null;
  state: string | null;
  status: 'active' | 'suspended' | 'deactivated';
  verification_status: 'pending' | 'verified' | 'rejected';
  updated_at: string;
};

export type Hospital = {
  id: string;
  user_id: string;
  name: string;
  location: string;
  description: string | null;
  website: string | null;
  phone: string | null;
  created_at: string;
  hospital_name: string | null;
  hospital_type: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  number_of_beds: number | null;
  departments: string | null;
  contact_person: string | null;
  contact_email: string | null;
  verification_status: 'pending' | 'verified' | 'rejected';
  updated_at: string;
};

export type NurseProfile = {
  id: string;
  nurse_id: string;
  qualification: string | null;
  nursing_registration_number: string | null;
  registration_authority: string | null;
  total_experience: number | null;
  previous_hospital: string | null;
  departments: string | null;
  preferred_location: string | null;
  expected_salary: number | null;
  shift_preference: 'day' | 'evening' | 'night' | 'flexible' | null;
  accommodation_required: boolean;
  availability: 'immediately' | '2_weeks' | '1_month' | 'not_available' | null;
  resume_url: string | null;
  verification_status: 'pending' | 'verified' | 'rejected';
  created_at: string;
  updated_at: string;
};

export type Shift = {
  id: string;
  hospital_id: string;
  title: string;
  description: string | null;
  department: string;
  shift_type: 'day' | 'evening' | 'night';
  start_time: string;
  end_time: string;
  hourly_rate: number;
  required_specialty: string | null;
  status: 'open' | 'filled' | 'closed';
  created_at: string;
};

export type SalaryType = 'monthly' | 'annual';
export type SalaryBasis = 'ctc' | 'gross' | 'take_home';

export type Job = {
  id: string;
  hospital_id: string;
  job_title: string;
  department: string;
  qualification_required: string | null;
  experience_required: number | null;

  // Real Salary Transparency
  salary_type?: SalaryType | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_basis?: SalaryBasis | null;

  // Real Shift Transparency
  shift?: string | null;
  duty_hours?: number | null;
  night_shifts_per_month?: number | null;

  // Real Benefits Transparency
  accommodation_available: boolean;
  meals_provided?: boolean | null;
  overtime_available?: boolean | null;
  joining_bonus_available?: boolean | null;
  joining_bonus_amount?: number | null;

  location: string | null;
  vacancies: number;
  shift_id: string | null;
  job_description: string | null;
  required_skills: string | null;
  last_date_to_apply?: string | null;
  deadline?: string | null;
  status: 'draft' | 'pending_approval' | 'active' | 'closed' | 'rejected';
  created_at: string;
  updated_at: string;
};

export type ApplicationStatus =
  | 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  | 'applied' | 'under_review' | 'shortlisted' | 'interview_scheduled'
  | 'interview_completed' | 'selected' | 'joined';

export type Application = {
  id: string;
  shift_id: string | null;
  job_id: string | null;
  nurse_id: string;
  status: ApplicationStatus;
  cover_message: string | null;
  created_at: string;
  updated_at: string;
};

export type Interview = {
  id: string;
  application_id: string;
  interview_date: string;
  interview_time: string;
  interview_type: 'in_person' | 'video' | 'phone';
  meeting_link: string | null;
  location: string | null;
  notes: string | null;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  created_at: string;
  updated_at: string;
};

export type NurseDocument = {
  id: string;
  nurse_id: string;
  document_type: 'qualification' | 'registration' | 'experience' | 'id_proof' | 'passport_photo' | 'resume' | 'other';
  file_name: string;
  document_name?: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  verification_status: 'pending' | 'verified' | 'rejected';
  rejection_reason?: string | null;
  uploaded_at?: string;
  created_at: string;
  updated_at: string;
};

export type HospitalDocument = {
  id: string;
  hospital_id: string;
  document_type: 'registration' | 'license' | 'tax' | 'other';
  file_name: string;
  document_name?: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  verification_status: 'pending' | 'verified' | 'rejected';
  rejection_reason?: string | null;
  uploaded_at?: string;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'application' | 'interview' | 'verification' | 'job' | 'system';
  is_read: boolean;
  created_at: string;
};

export type SavedJob = {
  id: string;
  nurse_id: string;
  job_id: string;
  created_at: string;
};

export type JobMatch = {
  id: string;
  job_id: string;
  nurse_id: string;
  match_score: number;
  qualification_score: number;
  experience_score: number;
  skills_score: number;
  location_score: number;
  salary_score: number;
  created_at: string;
};

export type Review = {
  id: string;
  shift_id: string;
  reviewer_id: string;
  reviewee_id: string;
  reviewer_role: 'nurse' | 'hospital';
  rating: number;
  comment: string | null;
  created_at: string;
};

// ============ COMPOSITE TYPES FOR QUERIES ============

export type JobWithHospital = Job & {
  hospitals: Pick<Hospital, 'id' | 'hospital_name' | 'name' | 'city' | 'state' | 'verification_status'>;
};

export type ApplicationWithJob = Application & {
  jobs: Job & {
    hospitals: Pick<Hospital, 'id' | 'hospital_name' | 'name' | 'city' | 'state'>;
  };
  profiles: Pick<Profile, 'id' | 'full_name' | 'profile_photo' | 'email' | 'phone' | 'specialty' | 'city' | 'state'>;
  nurse_profiles: Pick<NurseProfile, 'qualification' | 'total_experience' | 'departments' | 'verification_status'> | null;
  interviews: Interview[];
};

export type ApplicationWithNurse = Application & {
  profiles: Pick<Profile, 'id' | 'full_name' | 'profile_photo' | 'email' | 'phone' | 'specialty' | 'city' | 'state' | 'verification_status'>;
  nurse_profiles: Pick<NurseProfile, 'qualification' | 'total_experience' | 'departments' | 'verification_status' | 'expected_salary'> | null;
  interviews: Interview[];
};

export type SavedJobWithJob = SavedJob & {
  jobs: Job & {
    hospitals: Pick<Hospital, 'id' | 'hospital_name' | 'name' | 'city' | 'state'>;
  };
};

export type InterviewWithApplication = Interview & {
  applications: Application & {
    jobs: Pick<Job, 'id' | 'job_title' | 'department'> & {
      hospitals: Pick<Hospital, 'id' | 'hospital_name' | 'name'>;
    };
  };
};

export type JobMatchWithJob = JobMatch & {
  jobs: Job & {
    hospitals: Pick<Hospital, 'id' | 'hospital_name' | 'name' | 'city' | 'state'>;
  };
};

export type ShiftWithHospital = Shift & {
  hospitals: Pick<Hospital, 'id' | 'name' | 'location'>;
};

export type ApplicationWithShift = Application & {
  shifts: Shift & {
    hospitals: Pick<Hospital, 'id' | 'name' | 'location'>;
  };
};
