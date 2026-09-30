import { useEffect, useState, useMemo } from 'react';
import {
  Zap, Search, Stethoscope, Briefcase, MapPin,
  CheckCircle2, Mail, Send, Award, User as UserIcon,
  ShieldCheck, ArrowRight, Sparkles, Filter, X
} from 'lucide-react';
import { supabase, type Job, type Profile, type NurseProfile } from '@/lib/supabase';
import { calculateSmartMatch, type SmartMatchResult } from '@/lib/matching';
import { SmartMatchBadge } from './SmartMatchBadge';
import { Modal, Button, Input, Select, Spinner, EmptyState, Badge, useToast } from '@/components/ui';
import { getInitials } from '@/lib/utils';

interface SmartMatchedNursesModalProps {
  job: Job;
  hospital?: any;
  hospitalName?: string;
  onClose: () => void;
}

interface NurseCandidate {
  profile: Profile;
  nurseProfile: NurseProfile | null;
  match: SmartMatchResult;
  hasApplied: boolean;
  applicationStatus?: string;
}

export function SmartMatchedNursesModal({
  job,
  hospital,
  hospitalName: explicitHospitalName,
  onClose,
}: SmartMatchedNursesModalProps) {
  const hospitalName = explicitHospitalName || hospital?.hospital_name || hospital?.name || 'Hospital Partner';
  const { showToast } = useToast();
  const [candidates, setCandidates] = useState<NurseCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [minScoreFilter, setMinScoreFilter] = useState<string>('all');
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitedNurseIds, setInvitedNurseIds] = useState<Set<string>>(new Set());
  const [selectedCandidateForDetails, setSelectedCandidateForDetails] = useState<NurseCandidate | null>(null);

  useEffect(() => {
    async function loadMatchedNurses() {
      setLoading(true);
      try {
        // 1. Fetch nurse profiles
        const [{ data: profs }, { data: npList }, { data: existingApps }] = await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('role', 'nurse'),
          supabase
            .from('nurse_profiles')
            .select('*'),
          supabase
            .from('applications')
            .select('nurse_id, status')
            .eq('job_id', job.id),
        ]);

        const appMap = new Map<string, string>();
        (existingApps || []).forEach((a: { nurse_id: string; status: string }) => {
          appMap.set(a.nurse_id, a.status);
        });

        const npMap = new Map<string, NurseProfile>();
        (npList || []).forEach((np: NurseProfile) => {
          npMap.set(np.nurse_id, np);
        });

        const nurseList = (profs as Profile[] || [])
          .filter((p) => p.role === 'nurse')
          .map((p) => {
            const np = npMap.get(p.id) || null;
            const match = calculateSmartMatch(job, { profile: p, nurseProfile: np });
            return {
              profile: p,
              nurseProfile: np,
              match,
              hasApplied: appMap.has(p.id),
              applicationStatus: appMap.get(p.id),
            };
          })
          // Rank by match score descending
          .sort((a, b) => b.match.score - a.match.score);

        setCandidates(nurseList);
      } catch (err) {
        console.error('Error loading matched nurses:', err);
      } finally {
        setLoading(false);
      }
    }

    loadMatchedNurses();
  }, [job]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (minScoreFilter === 'top' && c.match.score < 80) return false;
      if (minScoreFilter === 'high' && c.match.score < 70) return false;
      if (minScoreFilter === 'moderate' && c.match.score < 50) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const name = c.profile.full_name?.toLowerCase() || '';
        const qual = (c.nurseProfile?.qualification || c.profile.specialty || '').toLowerCase();
        const dept = (c.nurseProfile?.departments || c.profile.specialty || '').toLowerCase();
        const loc = (c.nurseProfile?.preferred_location || c.profile.city || c.profile.state || '').toLowerCase();
        return name.includes(q) || qual.includes(q) || dept.includes(q) || loc.includes(q);
      }
      return true;
    });
  }, [candidates, search, minScoreFilter]);

  async function handleInviteNurse(candidate: NurseCandidate) {
    const nurseId = candidate.profile.id;
    setInvitingId(nurseId);

    try {
      // Send notification to the nurse
      await supabase.rpc('create_notification', {
        p_user_id: nurseId,
        p_title: `Job Invitation: ${job.job_title}`,
        p_message: `${hospitalName} viewed your profile and invited you to apply for the ${job.job_title} position (${job.department}) with a ${candidate.match.score}% Smart Match.`,
        p_type: 'job',
      });

      setInvitedNurseIds((prev) => new Set([...prev, nurseId]));
      showToast('success', `Invitation sent to ${candidate.profile.full_name || 'candidate'}!`);
    } catch (err: any) {
      showToast('error', `Failed to send invitation: ${err?.message || 'Unknown error'}`);
    } finally {
      setInvitingId(null);
    }
  }

  const topMatchCount = candidates.filter((c) => c.match.score >= 80).length;

  return (
    <Modal
      onClose={onClose}
      title="Smart Matched Nurses"
      size="xl"
    >
      <div className="space-y-4">
        {/* Job context header */}
        <div className="rounded-xl bg-slate-900 text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Position</span>
              <span className="text-slate-400">•</span>
              <span className="text-xs text-slate-300">{job.department}</span>
            </div>
            <h3 className="text-lg font-bold text-white mt-0.5">{job.job_title}</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300 mt-1">
              {job.qualification_required && <span>Req: {job.qualification_required}</span>}
              {job.experience_required != null && <span>Exp: {job.experience_required}+ yrs</span>}
              {job.location && <span>Loc: {job.location}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:border-l sm:border-slate-800 sm:pl-4">
            <div className="text-right">
              <div className="text-xl font-black text-amber-400">{topMatchCount}</div>
              <div className="text-[11px] text-slate-300">Top Matches (80%+)</div>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search matched nurses by name, specialty, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={minScoreFilter}
            onChange={(e) => setMinScoreFilter(e.target.value)}
          >
            <option value="all">All Match Scores</option>
            <option value="top">Top Matches (80%+)</option>
            <option value="high">High Matches (70%+)</option>
            <option value="moderate">Moderate Matches (50%+)</option>
          </Select>
        </div>

        {/* Candidates List */}
        {loading ? (
          <Spinner className="py-12" />
        ) : filteredCandidates.length === 0 ? (
          <EmptyState
            icon={<Zap className="h-7 w-7" />}
            title="No matching nurses found"
            description="Try changing the filter options or adjusting job criteria to discover more candidates."
          />
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {filteredCandidates.map((c) => {
              const p = c.profile;
              const np = c.nurseProfile;
              const isInvited = invitedNurseIds.has(p.id);
              const isVerified = p.verification_status === 'verified';

              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-bold text-sm">
                      {p.full_name ? getInitials(p.full_name) : <UserIcon className="h-5 w-5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-slate-900 text-base">{p.full_name || 'Registered Nurse'}</h4>
                        {isVerified && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="h-3 w-3" /> Verified
                          </span>
                        )}
                        <SmartMatchBadge
                          match={c.match}
                          size="sm"
                          jobTitle={job.job_title}
                          candidateName={p.full_name}
                        />
                        {c.hasApplied && (
                          <Badge color="blue">
                            Applied ({c.applicationStatus || 'In Review'})
                          </Badge>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        {(np?.qualification || p.specialty) && (
                          <span className="flex items-center gap-1 font-medium text-slate-800">
                            <Award className="h-3.5 w-3.5 text-primary-600" />
                            {np?.qualification || p.specialty}
                          </span>
                        )}
                        {(np?.departments || p.specialty) && (
                          <span className="flex items-center gap-1">
                            <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
                            {np?.departments || p.specialty}
                          </span>
                        )}
                        {(np?.total_experience != null || p.years_experience != null) && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                            {np?.total_experience ?? p.years_experience} yrs exp
                          </span>
                        )}
                        {(np?.preferred_location || p.city || p.state) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {np?.preferred_location || [p.city, p.state].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </div>

                      {/* Top Match reasons snippet */}
                      {c.match.matchReasons.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {c.match.matchReasons.slice(0, 2).map((r, i) => (
                            <span key={i} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedCandidateForDetails(c)}
                    >
                      View Profile
                    </Button>

                    {c.hasApplied ? (
                      <span className="text-xs font-semibold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-md">
                        Already Applied
                      </span>
                    ) : isInvited ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Invited
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        disabled={invitingId === p.id}
                        onClick={() => handleInviteNurse(c)}
                        className="bg-[#082F63] hover:bg-[#0c3d7e] text-white"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {invitingId === p.id ? 'Inviting...' : 'Invite to Apply'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Candidate Detail Modal */}
        {selectedCandidateForDetails && (
          <Modal
            onClose={() => setSelectedCandidateForDetails(null)}
            title="Candidate Profile Details"
            size="lg"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-bold text-base">
                    {selectedCandidateForDetails.profile.full_name ? getInitials(selectedCandidateForDetails.profile.full_name) : <UserIcon className="h-6 w-6" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">
                      {selectedCandidateForDetails.profile.full_name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedCandidateForDetails.profile.city || ''} {selectedCandidateForDetails.profile.state ? `(${selectedCandidateForDetails.profile.state})` : ''}
                    </p>
                  </div>
                </div>

                <SmartMatchBadge
                  match={selectedCandidateForDetails.match}
                  size="md"
                  jobTitle={job.job_title}
                  candidateName={selectedCandidateForDetails.profile.full_name}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Qualification</div>
                  <div className="font-medium text-slate-900 mt-0.5">
                    {selectedCandidateForDetails.nurseProfile?.qualification || selectedCandidateForDetails.profile.specialty || 'Nursing Graduate'}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Clinical Experience</div>
                  <div className="font-medium text-slate-900 mt-0.5">
                    {selectedCandidateForDetails.nurseProfile?.total_experience ?? selectedCandidateForDetails.profile.years_experience ?? 0} Years Total Experience
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Departments / Specialties</div>
                  <div className="font-medium text-slate-900 mt-0.5">
                    {selectedCandidateForDetails.nurseProfile?.departments || selectedCandidateForDetails.profile.specialty || 'General Nursing'}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Registration Authority</div>
                  <div className="font-medium text-slate-900 mt-0.5">
                    {selectedCandidateForDetails.nurseProfile?.registration_authority || 'State Nursing Council'}
                  </div>
                </div>
              </div>

              {selectedCandidateForDetails.profile.bio && (
                <div className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Professional Summary</div>
                  <p className="text-slate-700">{selectedCandidateForDetails.profile.bio}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelectedCandidateForDetails(null)}>
                  Close
                </Button>
                {!selectedCandidateForDetails.hasApplied && !invitedNurseIds.has(selectedCandidateForDetails.profile.id) && (
                  <Button
                    onClick={() => {
                      handleInviteNurse(selectedCandidateForDetails);
                      setSelectedCandidateForDetails(null);
                    }}
                    className="bg-[#082F63] hover:bg-[#0c3d7e] text-white"
                  >
                    <Send className="h-3.5 w-3.5" /> Invite to Apply
                  </Button>
                )}
              </div>
            </div>
          </Modal>
        )}
      </div>
    </Modal>
  );
}
