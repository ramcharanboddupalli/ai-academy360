import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BriefcaseBusiness, Sparkles } from 'lucide-react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { studentDashboardService, type OpportunityMatch, type StudentInternship, type StudentInternshipApplication } from '../../services/studentDashboard.service';

export function StudentInternshipsPage() {
  const [opportunities, setOpportunities] = useState<StudentInternship[]>([]);
  const [applications, setApplications] = useState<StudentInternshipApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [workModeFilter, setWorkModeFilter] = useState('all');
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applicationNotice, setApplicationNotice] = useState('');
  const [matches, setMatches] = useState<Record<string, { loading: boolean; message?: string; result?: OpportunityMatch; provider?: string; model?: string }>>({});

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await studentDashboardService.getInternships();
      setOpportunities(response.data.opportunities);
      setApplications(response.data.applications);
    } catch (cause) {
      setError(axios.isAxiosError(cause) && cause.response?.status === 401 ? 'Your session has expired. Sign in again.' : 'Internship information could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const applicationByInternship = useMemo(() => new Map(applications.map((application) => [String(application.internshipId), application])), [applications]);
  const workModes = Array.from(new Set(opportunities.map((item) => item.workMode).filter((mode): mode is string => Boolean(mode))));
  const filteredOpportunities = opportunities.filter((item) => {
    const text = `${item.title} ${item.organization} ${item.location ?? ''} ${item.description ?? ''} ${item.eligibility ?? ''}`.toLowerCase();
    return text.includes(search.trim().toLowerCase()) && (workModeFilter === 'all' || item.workMode === workModeFilter);
  });

  const apply = async (opportunity: StudentInternship) => {
    setApplyingId(String(opportunity.id));
    setError('');
    setApplicationNotice('');
    try {
      await studentDashboardService.applyToInternship(opportunity.id);
      setApplicationNotice(`Application submitted for ${opportunity.title}.`);
      await load();
    } catch (cause) {
      const message = axios.isAxiosError<{ message?: string }>(cause)
        ? cause.response?.data.message ?? 'Your application could not be submitted.'
        : 'Your application could not be submitted.';
      setError(message);
      if (axios.isAxiosError(cause) && cause.response?.status === 409) await load();
    } finally {
      setApplyingId(null);
    }
  };

  const requestMatch = async (opportunity: StudentInternship) => {
    setMatches((current) => ({ ...current, [opportunity.id]: { loading: true } }));
    try {
      const response = await studentDashboardService.matchInternship(opportunity.id);
      setMatches((current) => ({
        ...current,
        [opportunity.id]: response.data.available
          ? { loading: false, result: response.data.match, provider: response.data.provider, model: response.data.model }
          : { loading: false, message: response.data.message },
      }));
    } catch (cause) {
      setMatches((current) => ({ ...current, [opportunity.id]: { loading: false, message: axios.isAxiosError(cause) ? cause.response?.data?.message ?? 'Opportunity matching is unavailable.' : 'Opportunity matching is unavailable.' } }));
    }
  };

  return (
    <div className="min-w-0 p-4 md:p-6">
      <PageHeader title="Certificates & Internships" subtitle="Real credentials and published opportunities associated with your account." />
      {isLoading ? <p role="status" className="mb-5 text-sm text-[var(--color-muted)]">Loading internship records...</p> : null}
      {error ? <p role="alert" className="mb-5 text-sm text-[var(--color-primary)]">{error}</p> : null}
      {applicationNotice ? <p role="status" className="mb-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm">{applicationNotice}</p> : null}
      {!isLoading ? <>
        <Card className="mb-5 p-5"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--color-primary)]" /><h2 className="font-semibold text-[var(--color-text)]">AI Opportunity Match</h2></div><p className="mt-2 text-sm text-[var(--color-muted)]">Optional Groq analysis compares enrolled course titles with published opportunity requirements. It does not predict selection or infer unrecorded skills.</p></Card>
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-[var(--color-text)]">Available Opportunities</h2><div className="flex w-full flex-wrap gap-2 sm:w-auto"><input aria-label="Search internships" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search internships" className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm sm:w-64" /><select aria-label="Filter by work mode" value={workModeFilter} onChange={(event) => setWorkModeFilter(event.target.value)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"><option value="all">All work modes</option>{workModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></div></div>
          {opportunities.length ? filteredOpportunities.length ? <div className="grid gap-5 lg:grid-cols-2">{filteredOpportunities.map((opportunity) => {
            const match = matches[String(opportunity.id)];
            const application = applicationByInternship.get(String(opportunity.id));
            return <Card key={opportunity.id} className="p-5">
              <div className="flex items-center justify-between gap-3"><div className="rounded-xl bg-[var(--color-background)] p-2 text-[var(--color-primary)]"><BriefcaseBusiness className="h-4 w-4" /></div>{opportunity.applicationDeadline ? <StatusBadge label={`Apply by ${new Date(opportunity.applicationDeadline).toLocaleDateString()}`} /> : null}</div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--color-text)]">{opportunity.title}</h3>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{opportunity.organization}{opportunity.duration ? ` · ${opportunity.duration}` : ''}{opportunity.location ? ` · ${opportunity.location}` : ''}{opportunity.workMode ? ` · ${opportunity.workMode}` : ''}</p>
              {opportunity.stipendAmount !== null ? <p className="mt-2 text-sm font-medium text-[var(--color-text)]">Stipend: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: opportunity.stipendCurrency || 'INR' }).format(Number(opportunity.stipendAmount))}</p> : null}
              <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-[var(--color-green)]">View opportunity details</summary><div className="mt-3 space-y-2 text-sm text-[var(--color-muted)]">{opportunity.description ? <p>{opportunity.description}</p> : null}{opportunity.eligibility ? <p>Eligibility: {opportunity.eligibility}</p> : null}<p>Skills: {opportunity.skillRequirements ? JSON.stringify(opportunity.skillRequirements) : 'Not specified'}</p><p>Requirements: {opportunity.requirements ? JSON.stringify(opportunity.requirements) : 'Not specified'}</p></div></details>
              {application ? <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">Your application</strong><StatusBadge label={application.status.replaceAll('_', ' ')} /></div><p className="mt-1 text-xs text-[var(--color-muted)]">Submitted {new Date(application.appliedAt).toLocaleString()} · Updated {new Date(application.updatedAt).toLocaleString()}</p>{application.adminNote ? <p className="mt-2 text-sm text-[var(--color-text)]">Admin update: {application.adminNote}</p> : null}</div> : <Button className="mt-4" variant="primary" loading={applyingId === String(opportunity.id)} disabled={applyingId !== null} onClick={() => void apply(opportunity)}>Apply to internship</Button>}
              {opportunity.applicationUrl ? <a href={opportunity.applicationUrl} target="_blank" rel="noreferrer" className="ml-3 mt-4 inline-block text-sm font-medium text-[var(--color-primary)]">External application details</a> : null}
              <div className="mt-5 border-t border-[var(--color-border)] pt-4">
                <Button variant="outline" loading={match?.loading} onClick={() => void requestMatch(opportunity)}><Sparkles className="h-4 w-4" /> Match with my courses</Button>
                {match?.message ? <p role="status" className="mt-3 text-sm text-[var(--color-muted)]">{match.message}</p> : null}
                {match?.result ? <div className="mt-4 space-y-3"><div className="flex flex-wrap gap-2"><StatusBadge label={match.provider ?? 'Groq'} /><StatusBadge label={match.model ?? ''} /></div><p className="text-sm text-[var(--color-text)]">{match.result.matchExplanation}</p><div><h4 className="text-sm font-semibold text-[var(--color-text)]">Evidence in enrolled courses</h4>{match.result.matchingSkills.length ? <ul className="mt-1 list-disc pl-5 text-sm text-[var(--color-muted)]">{match.result.matchingSkills.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="mt-1 text-sm text-[var(--color-muted)]">No direct evidence identified.</p>}</div><div><h4 className="text-sm font-semibold text-[var(--color-text)]">Requirements without direct course evidence</h4>{match.result.skillsToDevelop.length ? <ul className="mt-1 list-disc pl-5 text-sm text-[var(--color-muted)]">{match.result.skillsToDevelop.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="mt-1 text-sm text-[var(--color-muted)]">No additional requirements identified.</p>}</div></div> : null}
              </div>
            </Card>;
          })}</div> : <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-sm text-[var(--color-muted)]">No opportunities match the selected search or filter.</p> : <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-sm text-[var(--color-muted)]">No internship opportunities are currently available.</p>}
        </section>
        <section className="mt-6"><Card className="p-5"><h2 className="font-semibold text-[var(--color-text)]">Application history</h2>{applications.length ? <div className="mt-3 space-y-3">{applications.map((application) => <div key={application.id} className="rounded-xl border border-[var(--color-border)] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium text-[var(--color-text)]">{application.title}</h3><StatusBadge label={application.status.replaceAll('_', ' ')} /></div><p className="mt-1 text-sm text-[var(--color-muted)]">{application.organization}</p><p className="mt-2 text-xs text-[var(--color-muted)]">Submitted {new Date(application.appliedAt).toLocaleString()} · Last updated {new Date(application.updatedAt).toLocaleString()}</p>{application.adminNote ? <p className="mt-2 text-sm text-[var(--color-text)]">Admin update: {application.adminNote}</p> : <p className="mt-2 text-sm text-[var(--color-muted)]">No admin update recorded.</p>}</div>)}</div> : <p className="mt-3 text-sm text-[var(--color-muted)]">You have not submitted any internship applications.</p>}</Card></section>
      </> : null}
    </div>
  );
}