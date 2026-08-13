import dbConnect from "./dbConnect";
import ProviderStatus from "../models/ProviderStatus";

export const KNOWN_PROVIDERS = ["WW", "IGA", "Panetta", "Aldi", "Coles"];

let cachedDisabled: Set<string> | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 1000; // 60 seconds

export async function getDisabledProviders(useCache: boolean = true): Promise<Set<string>> {
    const now = Date.now();
    if (useCache && cachedDisabled && now - cacheTime < CACHE_TTL) return cachedDisabled;
    try {
        await dbConnect();
        const docs = await ProviderStatus.find({ disabled: true }).select('name').lean().exec();
        cachedDisabled = new Set(docs.map(d => String(d.name)));
        cacheTime = now;
        return cachedDisabled;
    } catch (err) {
        console.error("Error loading disabled providers:", err);
        return new Set();
    }
}

export async function isProviderDisabled(name: string): Promise<boolean> {
    const disabled = await getDisabledProviders();
    return disabled.has(name);
}

export function invalidateProviderStatusCache() {
    cachedDisabled = null;
    cacheTime = 0;
}
