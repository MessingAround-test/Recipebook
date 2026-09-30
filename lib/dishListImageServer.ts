import { Buffer } from 'buffer'
import dbConnect from './dbConnect'
import DishListItem from '../models/DishListItem'
import DishListImage from '../models/DishListImage'
import {
    decodeImageValue,
    sharpResize,
    THUMB_LONG_EDGE,
    FULL_LONG_EDGE
} from './recipeImageServer'

export type Quality = 'thumb' | 'full'

export function dishListImageUrl(itemId: string | object, quality: Quality = 'thumb', version?: number | string): string {
    const id = typeof itemId === 'object' ? String((itemId as any)._id) : String(itemId)
    // `v` is a pure cache-busting token (see recipeImageUrl).
    return `/api/dishLists/items/${id}/image?q=${quality}&v=${version ?? 0}`
}

/**
 * Downloads (or decodes) the supplied image value and stores full + thumb
 * copies for a dish-list item. Mirrors saveRecipeImages but keeps list images
 * entirely separate from recipe images.
 */
export async function saveDishListImage(itemId: string, imageValue: string): Promise<{ ok: boolean }> {
    if (!itemId || !imageValue) return { ok: false }
    const decoded = await decodeImageValue(imageValue)
    if (!decoded || decoded.buffer.length === 0) return { ok: false }

    let fullMime = decoded.mime
    let fullBuffer = decoded.buffer
    let width: number | undefined
    let height: number | undefined
    try {
        const resized = await sharpResize(decoded.buffer, FULL_LONG_EDGE, 'jpeg', 80)
        fullBuffer = resized.data
        fullMime = 'image/jpeg'
        width = resized.info.width
        height = resized.info.height
    } catch (e: any) {
        console.error('dishListImage full resize failed:', e?.message || e)
    }

    const fullDoc = { mime: fullMime, data: fullBuffer, bytes: fullBuffer.length, width, height }

    try {
        const thumb = await sharpResize(decoded.buffer, THUMB_LONG_EDGE, 'webp', 70)
        await DishListImage.updateOne(
            { itemId, quality: 'thumb' },
            { mime: 'image/webp', data: thumb.data, width: thumb.info.width, height: thumb.info.height, bytes: thumb.data.length },
            { upsert: true }
        )
    } catch (e: any) {
        console.error('dishListImage thumb generation failed:', e?.message || e)
        await DishListImage.updateOne(
            { itemId, quality: 'thumb' },
            { mime: fullMime, data: fullDoc.data, width: fullDoc.width, height: fullDoc.height, bytes: fullDoc.bytes },
            { upsert: true }
        )
    }

    await DishListImage.updateOne(
        { itemId, quality: 'full' },
        { mime: fullDoc.mime, data: fullDoc.data, width: fullDoc.width, height: fullDoc.height, bytes: fullDoc.bytes },
        { upsert: true }
    )

    await DishListItem.updateOne({ _id: itemId }, { $set: { hasImage: true }, $inc: { imageVersion: 1 } })
    return { ok: true }
}

export async function getDishListImage(itemId: string, quality: Quality = 'thumb'): Promise<{ mime: string; data: Buffer } | null> {
    await dbConnect()
    const doc = await DishListImage.findOne({ itemId, quality }).select('mime data -_id').lean()
    if (doc?.data) {
        const buf = Buffer.isBuffer(doc.data) ? doc.data : Buffer.from((doc.data as any).buffer)
        return { mime: doc.mime || 'image/jpeg', data: buf }
    }
    return null
}

/**
 * Removes an item's stored variants and clears the hasImage flag / busts
 * client caches. (Whole-list deletion purges DishListImage rows directly,
 * since the items themselves are removed too.)
 */
export async function deleteDishListImage(itemId: string): Promise<void> {
    await dbConnect()
    await DishListImage.deleteMany({ itemId })
    await DishListItem.updateOne({ _id: itemId }, { $set: { hasImage: false }, $inc: { imageVersion: 1 } })
}
