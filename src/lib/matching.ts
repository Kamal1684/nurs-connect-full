import type { Job, Profile, NurseProfile, JobWithHospital } from './supabase';

export interface MatchReasonItem {
  type: 'positive' | 'neutral' | 'negative';
  text: string;
  field: 'specialty' | 'experience' | 'location' | 'shift' | 'salary' | 'qualification' | 'general';
}

export interface FactorBreakdown {
  score: number;
  max: number;
  weight: number; // Percentage weight, e.g., 30 for 30%
  label: string;
  detail: string;
  matched: boolean;
  isAvailable: boolean;
}

export interface MatchScoreBreakdown {
  specialty: FactorBreakdown;
  experience: FactorBreakdown;
  location: FactorBreakdown;
  shift: FactorBreakdown;
  salary: FactorBreakdown;
}

export interface SmartMatchResult {
  score: number; // 0 - 100
  total: number; // Alias for score
  isCalculable: boolean;
  isProfileReady: boolean;
  tier: 'exceptional' | 'great' | 'good' | 'moderate' | 'potential';
  tierLabel: string;
  badgeColor: 'emerald' | 'blue' | 'teal' | 'amber' | 'slate';
  breakdown: MatchScoreBreakdown;
  reasons: MatchReasonItem[];
  matchReasons: string[]; // Simple string list for legacy compatibility
  matchingHighlights: string[]; // Positive reasons for compact tags
  mismatchNotes: string[]; // Neutral/mismatch notes
  activeWeightTotal: number;
}

export interface RequiredDocumentStatus {
  hasQualificationDoc: boolean;
  hasRegistrationDoc: boolean;
  hasIdProofDoc: boolean;
  hasPhoto: boolean;
  missingDocs: string[];
  missingDocDetails: Array<{ key: string; label: string; impact: string }>;
  allRequiredDocsUploaded: boolean;
}

export interface ProfileCompletenessInfo {
  score: number; // 0 - 100
  percentage: number; // 0 - 100 (alias for score)
  missingFields: Array<{ key: string; label: string; impact: string }>;
  missingFieldLabels: string[];
  actionSuggestion: string;
  suggestion: string; // alias for actionSuggestion
  isMatchReady: boolean;
  isReadyForMatching: boolean; // alias for isMatchReady
  isComplete: boolean; // true ONLY if score === 100 and all required documents are uploaded
  canApply: boolean; // true ONLY if isComplete is true
  requiredDocs: RequiredDocumentStatus;
}

// Synonyms and department clusters for intelligent matching
const DEPARTMENT_CLUSTERS: Record<string, string[]> = {
  icu: ['icu', 'critical care', 'micu', 'sicu', 'ccu', 'intensive care', 'ventilator', 'critical'],
  emergency: ['emergency', 'casualty', 'trauma', 'er', 'triage', 'urgent care', 'ambulance'],
  ot: ['ot', 'operation theatre', 'operation theater', 'surgical', 'theatre', 'surgery', 'pacu', 'perioperative', 'scrub'],
  nicu: ['nicu', 'picu', 'neonatal', 'pediatric icu', 'newborn', 'child icu'],
  pediatrics: ['pediatric', 'pediatrics', 'child health', 'paediatrics'],
  cardiology: ['cardiology', 'cath lab', 'cardiac', 'ccu', 'heart'],
  dialysis: ['dialysis', 'nephrology', 'renal', 'hemodialysis'],
  oncology: ['oncology', 'chemotherapy', 'cancer care', 'palliative'],
  maternity: ['maternity', 'labor and delivery', 'gynaecology', 'gynecology', 'obg', 'obstetrics', 'labor room', 'postpartum'],
  general: ['general ward', 'ipd', 'opd', 'med-surg', 'medical-surgical', 'staff nurse', 'general nursing', 'ward'],
  neurology: ['neuro', 'neurology', 'neurosurgery', 'stroke care'],
  orthopedics: ['ortho', 'orthopedics', 'orthopaedics', 'bone and joint'],
};

// Hierarchy rankings for nursing qualifications
const QUAL_RANKS: Record<string, number> = {
  'ph.d nursing': 5,
  'phd nursing': 5,
  'm.sc nursing': 4,
  'msc nursing': 4,
  'post basic b.sc nursing': 3,
  'post basic bsc nursing': 3,
  'p.b.b.sc nursing': 3,
  'b.sc nursing': 2,
  'bsc nursing': 2,
  'g.n.m': 1,
  'gnm': 1,
  'general nursing and midwifery': 1,
  'a.n.m': 0,
  'anm': 0,
};

function normalizeText(text?: string | null): string {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function getQualRank(qualText?: string | null): number {
  const norm = normalizeText(qualText);
  if (!norm) return -1;
  for (const [key, rank] of Object.entries(QUAL_RANKS)) {
    if (norm.includes(key)) return rank;
  }
  return 1; // Default basic qualification level
}

export type NurseMatchProfile = {
  id?: string;
  nurse_id?: string;
  full_name?: string | null;
  qualification?: string | null;
  specialty?: string | null;
  departments?: string | null;
  total_experience?: number | null;
  years_experience?: number | null;
  preferred_location?: string | null;
  city?: string | null;
  state?: string | null;
  expected_salary?: number | null;
  shift_preference?: string | null;
  accommodation_required?: boolean | null;
  availability?: string | null;
  verification_status?: string | null;
};

/**
 * Calculates Profile Completeness (0–100%) and returns targeted suggestions.
 * 
 * MANDATORY REQUIREMENT:
 * A nurse profile must NOT reach 100% complete nor be eligible to apply for jobs
 * unless all required documents are uploaded:
 * 1. Qualification certificate
 * 2. Nursing Registration certificate
 * 3. ID proof
 * 4. Passport-size photo
 */
export function getProfileCompleteness(
  profile: Profile | null | undefined,
  nurseProfile: NurseProfile | null | undefined,
  documents?: Array<{ document_type: string }> | null | undefined
): ProfileCompletenessInfo {
  let score = 0;
  const missingObj: Array<{ key: string; label: string; impact: string }> = [];
  const missing: string[] = [];

  // 1. Basic Profile Fields (24%)
  if (profile?.full_name?.trim()) {
    score += 8;
  } else {
    missing.push('full name');
    missingObj.push({ key: 'full_name', label: 'Full Name', impact: '+8% Profile' });
  }

  if (profile?.phone?.trim()) {
    score += 8;
  } else {
    missing.push('phone number');
    missingObj.push({ key: 'phone', label: 'Phone Number', impact: '+8% Profile' });
  }

  if (profile?.city?.trim() || profile?.state?.trim() || nurseProfile?.preferred_location?.trim()) {
    score += 8;
  } else {
    missing.push('preferred location / city');
    missingObj.push({ key: 'location', label: 'Preferred Location', impact: '+8% Smart Match' });
  }

  // 2. Professional Details (36%)
  if (nurseProfile?.qualification?.trim() || profile?.specialty?.trim()) {
    score += 10;
  } else {
    missing.push('nursing qualification');
    missingObj.push({ key: 'qualification', label: 'Qualification (BSc/GNM/MSc)', impact: '+10% Matching' });
  }

  if (nurseProfile?.nursing_registration_number?.trim()) {
    score += 10;
  } else {
    missing.push('nursing registration number');
    missingObj.push({ key: 'registration', label: 'Registration Number', impact: '+10% Trust' });
  }

  if (nurseProfile?.departments?.trim() || profile?.specialty?.trim()) {
    score += 8;
  } else {
    missing.push('clinical specialty / departments');
    missingObj.push({ key: 'specialty', label: 'Clinical Department (ICU, ER, etc.)', impact: '+8% Core Weight' });
  }

  if (nurseProfile?.total_experience != null || profile?.years_experience != null) {
    score += 8;
  } else {
    missing.push('years of clinical experience');
    missingObj.push({ key: 'experience', label: 'Experience Years', impact: '+8% Core Weight' });
  }

  // 3. Mandatory Documents (40% Total — 10% each)
  const docList = documents || [];
  const hasQualificationDoc = docList.some((d) => d.document_type === 'qualification');
  const hasRegistrationDoc = docList.some((d) => d.document_type === 'registration');
  const hasIdProofDoc = docList.some((d) => d.document_type === 'id_proof');
  const hasPhoto = Boolean(
    profile?.profile_photo ||
    profile?.avatar_url ||
    docList.some((d) => d.document_type === 'passport_photo')
  );

  const missingDocs: string[] = [];
  const missingDocDetails: Array<{ key: string; label: string; impact: string }> = [];

  if (hasQualificationDoc) {
    score += 10;
  } else {
    missingDocs.push('Qualification Certificate');
    missingDocDetails.push({ key: 'doc_qualification', label: 'Qualification Certificate', impact: '+10% Mandatory' });
    missing.push('qualification certificate document');
    missingObj.push({ key: 'doc_qualification', label: 'Qualification Certificate (PDF/Image)', impact: '+10% Mandatory' });
  }

  if (hasRegistrationDoc) {
    score += 10;
  } else {
    missingDocs.push('Nursing Registration Certificate');
    missingDocDetails.push({ key: 'doc_registration', label: 'Nursing Registration Certificate', impact: '+10% Mandatory' });
    missing.push('nursing registration certificate document');
    missingObj.push({ key: 'doc_registration', label: 'Nursing Registration Certificate (PDF/Image)', impact: '+10% Mandatory' });
  }

  if (hasIdProofDoc) {
    score += 10;
  } else {
    missingDocs.push('ID Proof');
    missingDocDetails.push({ key: 'doc_id_proof', label: 'ID Proof (Aadhaar/Passport/DL)', impact: '+10% Mandatory' });
    missing.push('ID proof document');
    missingObj.push({ key: 'doc_id_proof', label: 'Government ID Proof (PDF/Image)', impact: '+10% Mandatory' });
  }

  if (hasPhoto) {
    score += 10;
  } else {
    missingDocs.push('Passport-size Photo');
    missingDocDetails.push({ key: 'doc_photo', label: 'Passport-size Photo', impact: '+10% Mandatory' });
    missing.push('passport-size photo');
    missingObj.push({ key: 'doc_photo', label: 'Passport-size Photo', impact: '+10% Mandatory' });
  }

  const allRequiredDocsUploaded = hasQualificationDoc && hasRegistrationDoc && hasIdProofDoc && hasPhoto;

  // Strict constraint: profile score can ONLY be 100 if all required items and documents are present
  const isComplete = allRequiredDocsUploaded && missingObj.length === 0 && score === 100;
  const canApply = isComplete;

  // Generate actionable suggestion
  let actionSuggestion = '';
  if (missingDocs.length > 0) {
    actionSuggestion = `Upload required documents (${missingDocs.slice(0, 2).join(', ')}${missingDocs.length > 2 ? ` +${missingDocs.length - 2} more` : ''}) to reach 100% profile completion and unlock job applications.`;
  } else if (missing.includes('clinical specialty / departments') || missing.includes('nursing qualification')) {
    actionSuggestion = 'Add your nursing qualification and clinical specialty to unlock high-accuracy job matches.';
  } else if (missing.length > 0) {
    actionSuggestion = `Complete your ${missing.slice(0, 2).join(' and ')} to finish your profile.`;
  } else {
    actionSuggestion = 'Your profile is 100% complete with all verified documents. You are fully eligible to apply for hospital jobs.';
  }

  // A profile is ready for Smart Match display if it has at least qualification/specialty and experience
  const isMatchReady = Boolean(
    (nurseProfile?.qualification || profile?.specialty || nurseProfile?.departments) &&
    (nurseProfile?.total_experience != null || profile?.years_experience != null)
  );

  const finalScore = isComplete ? 100 : Math.min(95, Math.max(0, score));

  return {
    score: finalScore,
    percentage: finalScore,
    missingFields: missingObj,
    missingFieldLabels: missing,
    actionSuggestion,
    suggestion: actionSuggestion,
    isMatchReady,
    isReadyForMatching: isMatchReady,
    isComplete,
    canApply,
    requiredDocs: {
      hasQualificationDoc,
      hasRegistrationDoc,
      hasIdProofDoc,
      hasPhoto,
      missingDocs,
      missingDocDetails,
      allRequiredDocsUploaded,
    },
  };
}

/**
 * Calculates a transparent Smart Match score (0–100) using the signature 5-pillar weights:
 * 1. Specialty / Department match — 30%
 * 2. Experience match — 20%
 * 3. Preferred location match — 20%
 * 4. Preferred shift match — 15%
 * 5. Salary expectation vs offered salary — 15%
 *
 * Missing fields are dynamically normalized so nurses are never unfairly penalized.
 */
export function calculateSmartMatch(
  arg1: any,
  arg2?: any
): SmartMatchResult {
  // Support flexible argument order (job, nurse) vs (nurse, job)
  let job: Partial<Job> = {};
  let nurse: { profile?: Partial<Profile> | null; nurseProfile?: Partial<NurseProfile> | null } = {};

  if (arg1 && ('job_title' in arg1 || 'vacancies' in arg1 || 'experience_required' in arg1)) {
    job = arg1 || {};
    if (arg2) {
      if ('profile' in arg2 || 'nurseProfile' in arg2) {
        nurse = arg2;
      } else {
        nurse = {
          profile: {
            id: arg2.id || arg2.nurse_id,
            full_name: arg2.full_name,
            specialty: arg2.specialty || arg2.departments,
            city: arg2.city || arg2.preferred_location,
            state: arg2.state,
            years_experience: arg2.years_experience ?? arg2.total_experience,
            verification_status: arg2.verification_status,
          },
          nurseProfile: {
            qualification: arg2.qualification,
            departments: arg2.departments || arg2.specialty,
            total_experience: arg2.total_experience ?? arg2.years_experience,
            preferred_location: arg2.preferred_location || arg2.city,
            expected_salary: arg2.expected_salary,
            shift_preference: arg2.shift_preference,
            availability: arg2.availability,
            verification_status: arg2.verification_status,
          },
        };
      }
    }
  } else {
    const nObj = arg1 || {};
    nurse = {
      profile: {
        id: nObj.id || nObj.nurse_id,
        full_name: nObj.full_name,
        specialty: nObj.specialty || nObj.departments,
        city: nObj.city || nObj.preferred_location,
        state: nObj.state,
        years_experience: nObj.years_experience ?? nObj.total_experience,
        verification_status: nObj.verification_status,
      },
      nurseProfile: {
        qualification: nObj.qualification,
        departments: nObj.departments || nObj.specialty,
        total_experience: nObj.total_experience ?? nObj.years_experience,
        preferred_location: nObj.preferred_location || nObj.city,
        expected_salary: nObj.expected_salary,
        shift_preference: nObj.shift_preference,
        availability: nObj.availability,
        verification_status: nObj.verification_status,
      },
    };
    job = arg2 || {};
  }

  const profile = nurse.profile || {};
  const np = nurse.nurseProfile || {};

  const structuredReasons: MatchReasonItem[] = [];
  const positiveHighlights: string[] = [];
  const mismatchNotes: string[] = [];

  let earnedPoints = 0;
  let activeWeightTotal = 0;

  // -------------------------------------------------------------
  // 1. Specialty / Department Match (Weight: 30%)
  // -------------------------------------------------------------
  const SPECIALTY_WEIGHT = 30;
  let specScore = 0;
  let specDetail = '';
  let specMatched = false;
  let specAvailable = false;

  const jobDept = normalizeText(job.department || '');
  const jobTitle = normalizeText(job.job_title || '');
  const nurseDeptRaw = np.departments || profile.specialty || '';
  const nurseDept = normalizeText(nurseDeptRaw);
  const nurseQual = normalizeText(np.qualification || '');

  if (jobDept || jobTitle) {
    if (!nurseDept && !nurseQual) {
      // Nurse has not specified specialty or qualification
      specAvailable = false;
      specScore = 0;
      specDetail = 'Specialty details pending profile completion';
    } else {
      specAvailable = true;
      activeWeightTotal += SPECIALTY_WEIGHT;

      // Check cluster alignment
      let clusterMatched = false;
      let matchedClusterLabel = '';

      for (const [key, words] of Object.entries(DEPARTMENT_CLUSTERS)) {
        const jobInCluster = words.some((w) => jobDept.includes(w) || jobTitle.includes(w));
        if (jobInCluster) {
          matchedClusterLabel = key.toUpperCase();
          const nurseInCluster = words.some((w) => nurseDept.includes(w) || nurseQual.includes(w));
          if (nurseInCluster) {
            clusterMatched = true;
            break;
          }
        }
      }

      if (clusterMatched) {
        specScore = SPECIALTY_WEIGHT;
        specMatched = true;
        specDetail = `${job.department || 'Clinical'} specialty directly matches your profile`;
        const text = `${job.department || matchedClusterLabel} specialty matches`;
        structuredReasons.push({ type: 'positive', text, field: 'specialty' });
        positiveHighlights.push(text);
      } else if (
        (nurseDept && (nurseDept.includes(jobDept) || jobDept.includes(nurseDept))) ||
        (nurseDept && jobTitle.includes(nurseDept))
      ) {
        specScore = SPECIALTY_WEIGHT * 0.95;
        specMatched = true;
        specDetail = `Matching clinical department: ${job.department || 'Department'}`;
        const text = `${job.department} department matches`;
        structuredReasons.push({ type: 'positive', text, field: 'specialty' });
        positiveHighlights.push(text);
      } else if (!jobDept || jobDept.includes('general') || jobDept.includes('ward') || jobDept.includes('staff')) {
        specScore = SPECIALTY_WEIGHT * 0.85;
        specMatched = true;
        specDetail = 'Open to general nursing and med-surg competencies';
        const text = 'Applicable to general nursing roles';
        structuredReasons.push({ type: 'positive', text, field: 'specialty' });
        positiveHighlights.push(text);
      } else if (nurseDept) {
        specScore = SPECIALTY_WEIGHT * 0.45;
        specDetail = `Background in ${nurseDeptRaw} (Job: ${job.department || 'Specialized Unit'})`;
        const text = `Department focuses on ${job.department} (Your background: ${nurseDeptRaw})`;
        structuredReasons.push({ type: 'neutral', text, field: 'specialty' });
        mismatchNotes.push(text);
      } else {
        specScore = SPECIALTY_WEIGHT * 0.5;
        specDetail = 'General nursing qualification';
      }
    }
  } else {
    specDetail = 'Open department specification';
  }
  earnedPoints += specScore;

  // -------------------------------------------------------------
  // 2. Experience Match (Weight: 20%)
  // -------------------------------------------------------------
  const EXP_WEIGHT = 20;
  let expScore = 0;
  let expDetail = '';
  let expMatched = false;
  let expAvailable = false;

  const jobExpReq = typeof job.experience_required === 'number' ? job.experience_required : 0;
  const nurseExp = typeof np.total_experience === 'number'
    ? np.total_experience
    : (typeof profile.years_experience === 'number' ? profile.years_experience : null);

  if (nurseExp !== null) {
    expAvailable = true;
    activeWeightTotal += EXP_WEIGHT;

    if (jobExpReq === 0) {
      expScore = EXP_WEIGHT;
      expMatched = true;
      expDetail = `Entry-level friendly (${nurseExp} yrs experience)`;
      const text = `${nurseExp > 0 ? `${nurseExp} years experience meets requirement` : 'Entry-level friendly'}`;
      structuredReasons.push({ type: 'positive', text, field: 'experience' });
      positiveHighlights.push(text);
    } else if (nurseExp >= jobExpReq) {
      expScore = EXP_WEIGHT;
      expMatched = true;
      expDetail = `${nurseExp} yrs experience meets/exceeds requirement (${jobExpReq} yrs req)`;
      const text = `${nurseExp} years experience meets requirement`;
      structuredReasons.push({ type: 'positive', text, field: 'experience' });
      positiveHighlights.push(text);
    } else if (nurseExp >= jobExpReq - 1) {
      expScore = EXP_WEIGHT * 0.8;
      expMatched = true;
      expDetail = `${nurseExp} yrs experience (close to ${jobExpReq} yrs req)`;
      const text = `${nurseExp} yrs experience (${jobExpReq} yrs preferred)`;
      structuredReasons.push({ type: 'neutral', text, field: 'experience' });
    } else if (nurseExp > 0) {
      const ratio = Math.max(0.2, nurseExp / Math.max(1, jobExpReq));
      expScore = EXP_WEIGHT * ratio;
      expDetail = `${nurseExp} yrs clinical background (req: ${jobExpReq} yrs)`;
      const text = `${nurseExp} yrs experience (${jobExpReq}+ yrs required)`;
      structuredReasons.push({ type: 'neutral', text, field: 'experience' });
      mismatchNotes.push(text);
    } else {
      expScore = EXP_WEIGHT * 0.3;
      expDetail = `Fresher / Entry level (req: ${jobExpReq} yrs)`;
      const text = `Requires ${jobExpReq} years clinical experience`;
      structuredReasons.push({ type: 'neutral', text, field: 'experience' });
      mismatchNotes.push(text);
    }
  } else {
    expDetail = 'Experience details pending profile completion';
  }
  earnedPoints += expScore;

  // -------------------------------------------------------------
  // 3. Preferred Location Match (Weight: 20%)
  // -------------------------------------------------------------
  const LOC_WEIGHT = 20;
  let locScore = 0;
  let locDetail = '';
  let locMatched = false;
  let locAvailable = false;

  const jobLoc = normalizeText(job.location || '');
  const nursePrefLoc = normalizeText(np.preferred_location || profile.city || '');
  const nurseState = normalizeText(profile.state || '');

  if (jobLoc && (nursePrefLoc || nurseState)) {
    locAvailable = true;
    activeWeightTotal += LOC_WEIGHT;

    if (nursePrefLoc && (jobLoc === nursePrefLoc || jobLoc.includes(nursePrefLoc) || nursePrefLoc.includes(jobLoc))) {
      locScore = LOC_WEIGHT;
      locMatched = true;
      locDetail = `${job.location || 'City'} matches your preferred location`;
      const text = `${job.location || 'Local area'} matches preferred location`;
      structuredReasons.push({ type: 'positive', text, field: 'location' });
      positiveHighlights.push(text);
    } else if (nurseState && (jobLoc.includes(nurseState) || nursePrefLoc.includes(nurseState))) {
      locScore = LOC_WEIGHT * 0.8;
      locMatched = true;
      locDetail = `In your state region (${profile.state})`;
      const text = `${profile.state} regional match`;
      structuredReasons.push({ type: 'positive', text, field: 'location' });
      positiveHighlights.push(text);
    } else {
      locScore = LOC_WEIGHT * 0.3;
      locDetail = `Location: ${job.location || 'Other city'} (Your preference: ${np.preferred_location || profile.city || 'flexible'})`;
      const text = `Location differs from your preference`;
      structuredReasons.push({ type: 'neutral', text, field: 'location' });
      mismatchNotes.push(text);
    }
  } else if (!jobLoc && nursePrefLoc) {
    locScore = LOC_WEIGHT * 0.75;
    locDetail = 'Open location / Multiple hospital branches';
    locAvailable = true;
    activeWeightTotal += LOC_WEIGHT;
  } else {
    locDetail = 'Location preference unassigned';
  }
  earnedPoints += locScore;

  // -------------------------------------------------------------
  // 4. Preferred Shift Match (Weight: 15%)
  // -------------------------------------------------------------
  const SHIFT_WEIGHT = 15;
  let shiftScore = 0;
  let shiftDetail = '';
  let shiftMatched = false;
  let shiftAvailable = false;

  const nurseShift = np.shift_preference;
  // Check if job or description specifies shifts
  const jobText = normalizeText([job.job_title, job.job_description, job.department].filter(Boolean).join(' '));

  if (nurseShift) {
    shiftAvailable = true;
    activeWeightTotal += SHIFT_WEIGHT;

    if (nurseShift === 'flexible') {
      shiftScore = SHIFT_WEIGHT;
      shiftMatched = true;
      shiftDetail = 'Flexible shift availability matches standard hospital rotations';
      const text = 'Flexible shift matches hospital schedule';
      structuredReasons.push({ type: 'positive', text, field: 'shift' });
      positiveHighlights.push(text);
    } else if (nurseShift === 'night' && (jobText.includes('night') || jobText.includes('icu') || jobText.includes('rotational') || jobText.includes('24'))) {
      shiftScore = SHIFT_WEIGHT;
      shiftMatched = true;
      shiftDetail = 'Night shift availability matches hospital ICU/critical staffing';
      const text = 'Night shift matches preference';
      structuredReasons.push({ type: 'positive', text, field: 'shift' });
      positiveHighlights.push(text);
    } else if (nurseShift === 'day' && (jobText.includes('day') || jobText.includes('opd') || jobText.includes('general'))) {
      shiftScore = SHIFT_WEIGHT;
      shiftMatched = true;
      shiftDetail = 'Day shift availability matches department schedule';
      const text = 'Day shift matches preference';
      structuredReasons.push({ type: 'positive', text, field: 'shift' });
      positiveHighlights.push(text);
    } else {
      shiftScore = SHIFT_WEIGHT * 0.75;
      shiftMatched = true;
      shiftDetail = `Compatible with standard nursing rotations (${nurseShift} preference)`;
      const text = `${nurseShift.charAt(0).toUpperCase() + nurseShift.slice(1)} shift preferred`;
      structuredReasons.push({ type: 'positive', text, field: 'shift' });
      positiveHighlights.push(text);
    }
  } else {
    shiftDetail = 'Shift preference not specified on profile';
  }
  earnedPoints += shiftScore;

  // -------------------------------------------------------------
  // 5. Salary Expectation vs Offered Salary (Weight: 15%)
  // -------------------------------------------------------------
  const SALARY_WEIGHT = 15;
  let salScore = 0;
  let salDetail = '';
  let salMatched = false;
  let salAvailable = false;

  const nurseExpectedSalary = np.expected_salary;
  const jobSalaryMax = job.salary_max || job.salary_min;

  if (nurseExpectedSalary && nurseExpectedSalary > 0 && jobSalaryMax && jobSalaryMax > 0) {
    salAvailable = true;
    activeWeightTotal += SALARY_WEIGHT;

    if (jobSalaryMax >= nurseExpectedSalary) {
      salScore = SALARY_WEIGHT;
      salMatched = true;
      salDetail = `Offered salary (₹${jobSalaryMax.toLocaleString('en-IN')}) meets your expectation (₹${nurseExpectedSalary.toLocaleString('en-IN')})`;
      const text = 'Salary is within your expectation';
      structuredReasons.push({ type: 'positive', text, field: 'salary' });
      positiveHighlights.push(text);
    } else if (jobSalaryMax >= nurseExpectedSalary * 0.85) {
      salScore = SALARY_WEIGHT * 0.8;
      salMatched = true;
      salDetail = `Offered salary (₹${jobSalaryMax.toLocaleString('en-IN')}) is near your expectation (₹${nurseExpectedSalary.toLocaleString('en-IN')})`;
      const text = 'Salary is near your expectation';
      structuredReasons.push({ type: 'positive', text, field: 'salary' });
      positiveHighlights.push(text);
    } else {
      salScore = SALARY_WEIGHT * 0.4;
      salDetail = `Offered salary (₹${jobSalaryMax.toLocaleString('en-IN')}) is below your expected (₹${nurseExpectedSalary.toLocaleString('en-IN')})`;
      const text = `Offered salary below expectation`;
      structuredReasons.push({ type: 'neutral', text, field: 'salary' });
      mismatchNotes.push(text);
    }
  } else {
    salDetail = 'Salary expectation not specified on profile';
  }
  earnedPoints += salScore;

  // -------------------------------------------------------------
  // DYNAMIC NORMALIZATION
  // -------------------------------------------------------------
  // If active available weights < 100, normalize earnedPoints against activeWeightTotal
  let finalScore = 0;
  if (activeWeightTotal > 0) {
    const normalizedRatio = earnedPoints / activeWeightTotal;
    finalScore = Math.min(100, Math.max(0, Math.round(normalizedRatio * 100)));
  } else {
    finalScore = 0; // Empty profile has no calculable score
  }

  // Profile readiness check
  const isProfileReady = Boolean(
    (nurseDept || nurseQual) &&
    (nurseExp !== null || profile.years_experience !== undefined)
  );

  // If candidate has empty profile, score is 0 and not match ready
  if (!isProfileReady && (!nurseDept && nurseExp === null)) {
    finalScore = 0;
  }

  // Determine Match Tier & Badges
  let tier: SmartMatchResult['tier'] = 'good';
  let tierLabel = 'Good Match';
  let badgeColor: SmartMatchResult['badgeColor'] = 'blue';

  if (finalScore >= 90) {
    tier = 'exceptional';
    tierLabel = 'Top Match';
    badgeColor = 'emerald';
  } else if (finalScore >= 80) {
    tier = 'great';
    tierLabel = 'Great Match';
    badgeColor = 'teal';
  } else if (finalScore >= 70) {
    tier = 'good';
    tierLabel = 'Good Match';
    badgeColor = 'blue';
  } else if (finalScore >= 55) {
    tier = 'moderate';
    tierLabel = 'Moderate Match';
    badgeColor = 'amber';
  } else {
    tier = 'potential';
    tierLabel = 'Potential Match';
    badgeColor = 'slate';
  }

  // Ensure 3-5 real reasons are surfaced
  const stringReasons: string[] = [];
  positiveHighlights.forEach((h) => stringReasons.push(`✓ ${h}`));
  mismatchNotes.forEach((m) => stringReasons.push(`○ ${m}`));

  return {
    score: finalScore,
    total: finalScore,
    isCalculable: isProfileReady,
    isProfileReady,
    tier,
    tierLabel,
    badgeColor,
    activeWeightTotal,
    breakdown: {
      specialty: {
        score: Math.round(specScore),
        max: SPECIALTY_WEIGHT,
        weight: SPECIALTY_WEIGHT,
        label: 'Specialty / Department (30%)',
        detail: specDetail || 'Clinical department alignment',
        matched: specMatched,
        isAvailable: specAvailable,
      },
      experience: {
        score: Math.round(expScore),
        max: EXP_WEIGHT,
        weight: EXP_WEIGHT,
        label: 'Experience (20%)',
        detail: expDetail || 'Clinical experience requirement',
        matched: expMatched,
        isAvailable: expAvailable,
      },
      location: {
        score: Math.round(locScore),
        max: LOC_WEIGHT,
        weight: LOC_WEIGHT,
        label: 'Preferred Location (20%)',
        detail: locDetail || 'Geographic compatibility',
        matched: locMatched,
        isAvailable: locAvailable,
      },
      shift: {
        score: Math.round(shiftScore),
        max: SHIFT_WEIGHT,
        weight: SHIFT_WEIGHT,
        label: 'Preferred Shift (15%)',
        detail: shiftDetail || 'Shift preference compatibility',
        matched: shiftMatched,
        isAvailable: shiftAvailable,
      },
      salary: {
        score: Math.round(salScore),
        max: SALARY_WEIGHT,
        weight: SALARY_WEIGHT,
        label: 'Salary Expectation (15%)',
        detail: salDetail || 'Compensation expectation alignment',
        matched: salMatched,
        isAvailable: salAvailable,
      },
    },
    reasons: structuredReasons,
    matchReasons: stringReasons.slice(0, 5),
    matchingHighlights: positiveHighlights.slice(0, 4),
    mismatchNotes: mismatchNotes.slice(0, 3),
  };
}

/**
 * Sorts jobs for a nurse by:
 * 1. Match score descending
 * 2. Freshness (created_at descending)
 * 3. Application deadline
 */
export function sortJobsBySmartMatch(
  jobs: JobWithHospital[],
  nurseData: { profile?: Profile | null; nurseProfile?: NurseProfile | null }
): Array<JobWithHospital & { matchScore: number; matchBreakdown: SmartMatchResult }> {
  return jobs
    .map((job) => {
      const breakdown = calculateSmartMatch(job, nurseData);
      return {
        ...job,
        matchScore: breakdown.score,
        matchBreakdown: breakdown,
      };
    })
    .sort((a, b) => {
      // 1. Match score
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }
      // 2. Freshness
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      // 3. Deadline
      const deadlineA = a.last_date_to_apply ? new Date(a.last_date_to_apply).getTime() : Infinity;
      const deadlineB = b.last_date_to_apply ? new Date(b.last_date_to_apply).getTime() : Infinity;
      return deadlineA - deadlineB;
    });
}

/**
 * Sorts candidates for a hospital job by Smart Match score descending.
 */
export function sortNursesBySmartMatch(
  nurses: Array<{ profile: Profile; nurseProfile?: NurseProfile | null }>,
  job: Job
): Array<{ profile: Profile; nurseProfile?: NurseProfile | null; smartMatch: SmartMatchResult }> {
  return nurses
    .map((nurse) => ({
      ...nurse,
      smartMatch: calculateSmartMatch(job, nurse),
    }))
    .sort((a, b) => b.smartMatch.score - a.smartMatch.score);
}
