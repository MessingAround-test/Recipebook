/**
 * One-off cleanup for the old shared dish-list tick-off state.
 *
 * `cooked`/`cookedAt` used to live on DishListItem and were shared by every
 * user. Tick-off is now per-user (DishListItemCooked), so the legacy fields are
 * dead weight — this drops them so nobody reads a stale global "cooked" flag.
 *
 *   npx tsx scripts/clear-shared-cooked.js
 */
import fs from 'fs'
import path from 'path'

(async () => {
    const envPath = path.join(__dirname, '..', '.env.local')
    if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/)
            if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
        }
    }

    await (await import('../lib/dbConnect')).default()
    const DishListItem = (await import('../models/DishListItem')).default

    const result: any = await (DishListItem as any).updateMany(
        { $or: [{ cooked: { $exists: true } }, { cookedAt: { $exists: true } }] },
        { $unset: { cooked: '', cookedAt: '' } }
    )

    console.log(`Cleared shared cooked state from ${result.modifiedCount ?? result.nModified ?? 0} dish item(s).`)
    process.exit(0)
})()
