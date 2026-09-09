import { Buffer } from 'buffer'
import mongoose from 'mongoose'
import dbConnect from './dbConnect'
import Recipe from '../models/Recipe'
import RecipeImage from '../models/RecipeImage'

export type Quality = 'thumb' | 'full'

const THUMB_LONG_EDGE = 400
const FULL_LONG_EDGE = 1600

const MIME_ALIASES: Record<string, string> = {
    'image/jpg': 'image/jpeg'
}

export function recipeImageUrl(recipeId: string | object, quality: Quality = 'thumb'): string {
    const id = typeof recipeId === 'object' ? String((recipeId as any)._id) : String(recipeId)
    return `/api/Recipe/${id}/image?q=${quality}`
}

/** Accepts a data URL, raw base64, or an http(s) URL and returns decoded bytes + mime. */
export async function decodeImageValue(value: string): Promise<{ buffer: Buffer; mime: string } | null> {
    if (!value || typeof value !== 'string') return null

    const dataUrlMatch = value.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/)
    if (dataUrlMatch) {
        const mime = dataUrlMatch[1] || 'image/jpeg'
        if (dataUrlMatch[2]) {
            return { buffer: Buffer.from(dataUrlMatch[3], 'base64'), mime: MIME_ALIASES[mime] || mime }
        }
        // URL-encoded data URL
        return { buffer: Buffer.from(decodeURIComponent(dataUrlMatch[3]), 'utf-8'), mime: MIME_ALIASES[mime] || mime }
    }

    if (/^https?:\/\//i.test(value)) {
        const res = await fetch(value, { signal: AbortSignal.timeout(30000) })
        if (!res.ok) return null
        const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]
        return { buffer: Buffer.from(await res.arrayBuffer()), mime: MIME_ALIASES[mime] || mime }
    }

    // Tolerate raw base64 (heuristic: no spaces/protocol, long, base64 charset)
    if (value.length > 256 && /^[A-Za-z0-9+/=\r\n]+$/.test(value.slice(0, 128))) {
        try {
            return { buffer: Buffer.from(value, 'base64'), mime: 'image/jpeg' }
        } catch {
            return null
        }
    }

    return null
}

async function sharpResize(buffer: Buffer, longEdge: number, format: 'webp' | 'jpeg', quality: number) {
    const sharp = (await import('sharp')).default
    return sharp(buffer)
        .resize({ width: longEdge, height: longEdge, fit: 'inside', withoutEnlargement: true })
        .toFormat(format, { quality })
        .toBuffer({ resolveWithObject: true })
}

/** Upserts the full-res copy plus a derived thumb, clears any legacy inline blob, sets hasImage. */
export async function saveRecipeImages(recipeId: string, imageValue: string): Promise<{ ok: boolean }> {
    if (!recipeId || !imageValue) return { ok: false }
    const decoded = await decodeImageValue(imageValue)
    if (!decoded || decoded.buffer.length === 0) return { ok: false }

    // NB: mongoose silently ignores $unset on fields that are no longer in the
    // Recipe schema — use the raw collection so legacy inline blobs are removed.
    await Recipe.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(recipeId) },
        { $unset: { image: '' } }
    )

    // Full res: cap dimensions, re-encode as jpeg
    let fullMime = MIME_ALIASES[decoded.mime] || decoded.mime
    let fullBuffer = decoded.buffer
    let width: number | undefined
    let height: number | undefined
    try {
        const resized = await sharpResize(decoded.buffer, FULL_LONG_EDGE, 'jpeg', 80)
        fullBuffer = resized.data
        fullMime = 'image/jpeg'
        width = resized.info.width
        height = resized.info.height
    } catch (e) {
        // Sharp failed (unsupported/corrupt?) — store original bytes unchanged
        try { console.error('recipeImage full resize failed:', e?.message || e) } catch { /* noop */ }
    }

    const fullDoc: any = {
        mime: fullMime,
        data: fullBuffer,
        bytes: fullBuffer.length,
        width,
        height
    }

    try {
        const thumb = await sharpResize(decoded.buffer, THUMB_LONG_EDGE, 'webp', 70)
        await RecipeImage.updateOne(
            { recipeId, quality: 'thumb' },
            {
                mime: 'image/webp',
                data: thumb.data,
                width: thumb.info.width,
                height: thumb.info.height,
                bytes: thumb.data.length
            },
            { upsert: true }
        )
    } catch (e) {
        // Fallback: use the (capped) full buffer as the thumb so thumbnails still work
        try { console.error('recipeImage thumb generation failed:', e?.message || e) } catch { /* noop */ }
        await RecipeImage.updateOne(
            { recipeId, quality: 'thumb' },
            { mime: fullMime, data: fullDoc.data, width: fullDoc.width, height: fullDoc.height, bytes: fullDoc.bytes },
            { upsert: true }
        )
    }

    await RecipeImage.updateOne(
        { recipeId, quality: 'full' },
        { mime: fullDoc.mime, data: fullDoc.data, width: fullDoc.width, height: fullDoc.height, bytes: fullDoc.bytes },
        { upsert: true }
    )

    await Recipe.updateOne({ _id: recipeId }, { $set: { hasImage: true } })
    return { ok: true }
}

/** Returns image bytes + mime, falling back to a legacy inline blob if the variant is missing. */
export async function getRecipeImage(recipeId: string, quality: Quality = 'thumb'): Promise<{ mime: string; data: Buffer } | null> {
    const doc = await RecipeImage.findOne({ recipeId, quality }).select('mime data -_id').lean()
    if (doc?.data) {
        const buf = Buffer.isBuffer(doc.data) ? doc.data : Buffer.from((doc.data as any).buffer)
        return { mime: doc.mime || 'image/jpeg', data: buf }
    }

    // Legacy: image stored inline on the recipe doc
    const recipe: any = await Recipe.findById(recipeId).select('image').lean()
    if (recipe?.image) {
        const decoded = await decodeImageValue(recipe.image)
        if (decoded) return { mime: decoded.mime, data: decoded.buffer }
    }
    return null
}

export async function deleteRecipeImages(recipeId: string): Promise<void> {
    await RecipeImage.deleteMany({ recipeId })
}
