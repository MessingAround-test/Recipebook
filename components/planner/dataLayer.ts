import { Plan, Recipe } from './types';

const TOKEN_HEADER = 'edgetoken';

async function authedFetch(url: string, opts: RequestInit = {}): Promise<any> {
    const token = localStorage.getItem('Token');
    const headers: any = { ...(opts.headers || {}) };
    if (token) headers[TOKEN_HEADER] = token;
    if (opts.body) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, { ...opts, headers });
    return res.json();
}

export async function fetchPlan(startDate: string): Promise<any> {
    return authedFetch(`/api/weeklyPlan?startDate=${encodeURIComponent(startDate)}`);
}

export async function postPlan(startDate: string, plan: Plan): Promise<any> {
    return authedFetch('/api/weeklyPlan', {
        method: 'POST',
        body: JSON.stringify({ startDate, ...plan })
    });
}

// Fire-and-forget save that survives page unload (used to flush pending edits
// when the user refreshes or navigates away before the debounced autosave runs).
export async function postPlanKeepAlive(startDate: string, plan: Plan): Promise<void> {
    const token = localStorage.getItem('Token');
    try {
        await fetch('/api/weeklyPlan', {
            method: 'POST',
            keepalive: true,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { [TOKEN_HEADER]: token } : {})
            },
            body: JSON.stringify({ startDate, ...plan })
        });
    } catch (err) {
        console.error(err);
    }
}

export async function fetchAnalysis(plan: Plan): Promise<any> {
    return authedFetch('/api/weeklyPlan/analysis', {
        method: 'POST',
        body: JSON.stringify({ plan })
    });
}

export async function postExport(startDate: string): Promise<any> {
    return authedFetch('/api/weeklyPlan/export', {
        method: 'POST',
        body: JSON.stringify({ startDate })
    });
}

export async function fetchRecipes(): Promise<Recipe[]> {
    const token = localStorage.getItem('Token');
    const res = await fetch('/api/Recipe', {
        headers: token ? { [TOKEN_HEADER]: token } : {}
    });
    const data = await res.json();
    return data.res || [];
}
