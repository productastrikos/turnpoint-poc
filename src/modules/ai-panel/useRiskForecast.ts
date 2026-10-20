import { useCallback, useEffect, useState } from 'react';
import { getRiskForecast, type RiskForecast } from '../../services/predictionService';
import { useDataEvent } from '../../app/dataEvents';

/** Live risk forecast; `reload` re-runs the model and the simulation on the current data and returns the result. */
export function useRiskForecast() {
  const [data, setData] = useState<RiskForecast | null>(null);
  const reload = useCallback(async () => {
    const f = await getRiskForecast();
    setData(f);
    return f;
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  useDataEvent('schedule', reload); // a P6 reschedule changes the network the simulation runs on
  return { data, reload };
}
