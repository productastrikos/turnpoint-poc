import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { OverviewTab } from './OverviewTab';
import { P6Tab } from './P6Tab';
import { SapTab } from './SapTab';
import { MonitoringTab } from './MonitoringTab';
import { DryRunTab } from './DryRunTab';
import { LiveSyncTab } from './LiveSyncTab';
import { useHub } from './useHub';
import { errorQueue } from '../../services/integrationService';

const TABS = ['overview', 'live', 'p6', 'sap', 'monitoring', 'dryrun'] as const;

export default function IntegrationHubPage() {
  const [tab, setTab] = useTabParam(TABS, 'overview');
  const hub = useHub();
  const errs = errorQueue(hub.messages).length;

  return (
    <div>
      <PageHeader
        title="Integration Hub"
        subtitle="SAP S/4HANA (PM / MM / PS) and Primavera P6 as the client would see them: one platform on the field side, both systems kept in sync. Live two-way sync runs against SAP and P6 stand-in consoles in this browser; there is no connection to the client's systems."
        badges={['simulated']}
        checklist="D5 · D6 · G5"
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'live', label: 'Live two-way sync' },
          { id: 'p6', label: 'Primavera P6 (XER round trip)' },
          { id: 'sap', label: 'SAP S/4HANA' },
          { id: 'monitoring', label: 'Monitoring & error handling', badge: errs || undefined },
          { id: 'dryrun', label: 'Dry-run readiness (SOW 16)', badge: 34 },
        ]}
      />
      {tab === 'overview' && <OverviewTab />}
      {tab === 'live' && <LiveSyncTab />}
      {tab === 'p6' && <P6Tab />}
      {tab === 'sap' && <SapTab />}
      {tab === 'monitoring' && <MonitoringTab />}
      {tab === 'dryrun' && <DryRunTab />}
      <p className="small muted" style={{ marginTop: 20 }}>No connection to the client's SAP or P6: the live tab talks to stand-in consoles. See docs/MOCK_VS_REAL.md for what is real and what is simulated.</p>
    </div>
  );
}
