import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { LoadingState } from '../../components/ui/EmptyState';
import { TABS } from '../../app/tabRegistry';
import { getJobs } from '../../services/jobsService';
import { useDataEvent } from '../../app/dataEvents';
import { useToast } from '../../app/ToastContext';
import type { Certificate } from '../../services/scopeService';
import type { Job } from '../../types';
import { WorklistTab } from './WorklistTab';
import { ApprovalsTab } from './ApprovalsTab';
import { RiskTab } from './RiskTab';
import { ChallengeTab } from './ChallengeTab';
import { VariationsTab } from './VariationsTab';
import { FreezeTab } from './FreezeTab';
import { PriorityTab } from './PriorityTab';
import { LifecycleBanner } from './LifecycleBanner';
import { FreezeDialog } from './FreezeDialog';
import { useRole } from '../../app/RoleContext';
import { Card } from '../../components/ui/Card';
import { Icon } from '../../app/icons';

export default function ScopePage() {
  const [tab, setTab] = useTabParam(TABS.scope, 'worklist');
  const { role } = useRole();
  const { showToast } = useToast();
  const [freezing, setFreezing] = useState(false);
  const goTo = (t: string) => setTab(t as typeof tab);
  // these tabs are built around estimates and budget movement, which contractors must not see (SOW 4.17)
  const costTab = role === 'contractor' && (tab === 'risk' || tab === 'challenge' || tab === 'variations' || tab === 'freeze');
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const reload = useCallback(() => {
    getJobs().then(setJobs);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  useDataEvent('scope', reload); // new notifications and changed costs arrive from SAP, and every lifecycle action

  const pending = jobs?.filter((j) => j.status === 'pending').length;

  function onFrozen(cert: Certificate) {
    setFreezing(false);
    reload();
    showToast(`Scope frozen. Certificate ${cert.number} Rev ${cert.revision} generated and signed; SFRZ pushed to SAP for ${cert.pushedOrders} orders (simulated).`, 'good');
    setTab('freeze');
  }

  return (
    <div>
      <PageHeader
        title="Scope & Worklist"
        subtitle="From request to frozen worklist: create items (manual, bulk, Excel, SAP) with mandatory fields, screen them through three gates, challenge on risk, cost and man-hours, freeze the scope with a signed certificate, then track every change as a variation."
        checklist="S1 – S9 · P6"
        action={role !== 'contractor' ? <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent('oq:sap-dock', { detail: { toggle: true } }))} title="Show SAP S/4HANA beside this page to watch scope items arrive as maintenance orders">SAP side by side</button> : undefined}
      />
      {jobs && <LifecycleBanner jobs={jobs} reload={reload} goTo={goTo} onFreeze={() => setFreezing(true)} />}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'worklist', label: 'Worklist' },
          { id: 'approvals', label: '3-gate approvals', badge: pending },
          { id: 'risk', label: 'Risk-based optimisation' },
          { id: 'challenge', label: 'Scope challenge' },
          { id: 'variations', label: 'Variations' },
          { id: 'freeze', label: 'Freeze certificate' },
          { id: 'priority', label: 'Priority' },
        ]}
      />
      {costTab ? (
        <Card>
          <div className="empty-state">
            <Icon name="lock" size={28} />
            <div style={{ fontWeight: 600, color: 'var(--ink-2)', margin: '8px 0 4px' }}>Cost estimates are restricted for contractors</div>
            <div style={{ fontSize: 12.5 }}>This tab is built on estimates, budget movement and certificate values, which only OQ staff can see (SOW 4.17). The worklist, approval status and priority tabs remain available.</div>
          </div>
        </Card>
      ) : !jobs ? (
        <LoadingState />
      ) : (
        <>
          {tab === 'worklist' && <WorklistTab jobs={jobs} reload={reload} />}
          {tab === 'approvals' && <ApprovalsTab jobs={jobs} reload={reload} goTo={goTo} />}
          {tab === 'risk' && <RiskTab jobs={jobs} reload={reload} />}
          {tab === 'challenge' && <ChallengeTab jobs={jobs} reload={reload} />}
          {tab === 'variations' && <VariationsTab jobs={jobs} reload={reload} />}
          {tab === 'freeze' && <FreezeTab jobs={jobs} reload={reload} onFreeze={() => setFreezing(true)} goTo={goTo} />}
          {tab === 'priority' && <PriorityTab jobs={jobs} />}
        </>
      )}
      <FreezeDialog open={freezing} onClose={() => setFreezing(false)} onDone={onFrozen} />
    </div>
  );
}
