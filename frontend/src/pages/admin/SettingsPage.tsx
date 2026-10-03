import { Settings2 } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { PageHeader } from '../../components/PageHeader';

export function AdminSettingsPage() {
  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Settings" subtitle="Platform administration and configuration." />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-[var(--color-background)] p-2 text-[var(--color-primary)]"><Settings2 className="h-4 w-4" /></div>
            <h3 className="font-semibold text-[var(--color-text)]">System preferences</h3>
          </div>
          <div className="space-y-4">
            <Input label="Academy name" value="AI Academy360" />
            <Input label="Support email" value="support@academy360.edu" />
            <Input label="Default timezone" value="UTC+01:00" />
          </div>
          <div className="mt-5 flex justify-end">
            <Button variant="primary">Save settings</Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-[var(--color-background)] p-2 text-[var(--color-primary)]"><Settings2 className="h-4 w-4" /></div>
            <h3 className="font-semibold text-[var(--color-text)]">Operational controls</h3>
          </div>
          <div className="space-y-4 text-sm text-[var(--color-muted)]">
            <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
              <span>AI support routing</span>
              <span className="font-medium text-[var(--color-text)]">Enabled</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
              <span>Complaint escalation</span>
              <span className="font-medium text-[var(--color-text)]">Enabled</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
              <span>Student access review</span>
              <span className="font-medium text-[var(--color-text)]">Weekly</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
