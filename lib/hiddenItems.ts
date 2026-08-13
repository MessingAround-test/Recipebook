import dbConnect from "./dbConnect";
import HiddenItem from "../models/HiddenItem";

export async function getHiddenPatterns(): Promise<string[]> {
    try {
        await dbConnect();
        const docs = await HiddenItem.find({}).select('pattern').lean().exec();
        return docs.map(d => String(d.pattern).toLowerCase());
    } catch (err) {
        console.error("Error loading hidden item patterns:", err);
        return [];
    }
}

export function isNameHidden(name: string, patterns: string[]): boolean {
    if (!patterns || patterns.length === 0) return false;
    const lower = String(name || '').toLowerCase();
    return patterns.some(p => lower.includes(p));
}

export function applyHiddenFilter(items: any[], patterns: string[]): any[] {
    if (!items || items.length === 0) return items;
    if (!patterns || patterns.length === 0) return items;
    return items.filter(item => !isNameHidden(item?.name, patterns));
}
