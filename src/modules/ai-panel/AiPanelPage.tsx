import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { TABS } from '../../app/tabRegistry';
import { AssistantChat } from '../../ai/assistant/AssistantChat';
import { RiskTab } from './RiskTab';
import { ForecastTab, PredictiveTab } from './ForecastTabs';

function AssistantTab() {
  return (
    <div className="grid grid-3-2" style={{ alignItems: 'start' }}>
      <Card>
        <CardHeader title="Ask TURNPOINT" />
        <AssistantChat minHeight={340} className="chat-inline" />
      </Card>
      <Card>
        <CardHeader title="How it answers" />
        <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
          <li>Every answer reads the same services as the screens (schedule, risk model, scope, budget, readiness, materials, quality, change control, integrations).</li>
          <li>The steps it ran are shown above each answer, with links to the matching page.</li>
          <li>Contractor viewers never get cost figures: they are removed in code by the tools, not by the prompt.</li>
          <li>With an API key in <code>.env.local</code> Claude answers open questions through a local relay (the key never reaches the browser). Without one, an on-device engine answers the common questions from the same data.</li>
        </ul>
      </Card>
    </div>
  );
}

export default function AiPanelPage() {
  const [tab, setTab] = useTabParam(TABS['ai-panel'], 'risk');
  return (
    <div>
      <PageHeader
        title="AI Assistant & Analytics"
        subtitle="Risk prediction, schedule forecast and predictive critical path run a trained slip model and a 2,000-run schedule simulation on the live data, in the browser. The assistant answers questions about the turnaround."
        badges={['model']}
        checklist="G12 · G13 · X16 · X17"
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'risk', label: 'Risk prediction' },
          { id: 'assistant', label: 'Assistant' },
          { id: 'forecast', label: 'Schedule forecast' },
          { id: 'predictive', label: 'Predictive critical path' },
        ]}
      />
      {tab === 'risk' && <RiskTab />}
      {tab === 'assistant' && <AssistantTab />}
      {tab === 'forecast' && <ForecastTab />}
      {tab === 'predictive' && <PredictiveTab />}
    </div>
  );
}
