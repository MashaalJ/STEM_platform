import { authFetch } from '../app/api';

/** After mission/challenge/quiz finishes, mark the journey node that launched it. */
export async function completePendingJourneyNode(): Promise<boolean> {
  try {
    const raw = sessionStorage.getItem('stemverse_pending_journey_node');
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { nodeId?: string };
    const nodeId = parsed?.nodeId ? String(parsed.nodeId) : '';
    if (!nodeId) return false;
    const res = await authFetch(`/api/journey-nodes/${nodeId}/complete`, { method: 'POST' });
    sessionStorage.removeItem('stemverse_pending_journey_node');
    return res.ok;
  } catch {
    return false;
  }
}
