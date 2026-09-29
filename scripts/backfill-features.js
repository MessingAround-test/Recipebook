/**
 * One-off backfill for per-user feature access.
 *
 * Accounts created before feature flags existed have no `features` /
 * `features_onboarded_at` fields. Left alone they'd be treated as legacy by
 * `resolveFeatures` (all-on) but would keep being sent to /welcome. This marks
 * them explicitly as all-on and onboarded so they skip onboarding.
 *
 *   npx tsx scripts/backfill-features.js
 */
import fs from 'fs'
import path from 'path'

const FEATURE_KEYS = [
    'recipes', 'shoppingList', 'healthTracker', 'weeklyPlanner',
    'worldList', 'ingredients', 'quickTools', 'dailyTasks'
]

;(async () => {
    const envPath = path.join(__dirname, '..', '.env.local')
    if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/)
            if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
        }
    }

    await (await import('../lib/dbConnect')).default()
    const User = (await import('../models/User')).default

    const allOn = FEATURE_KEYS.reduce((acc, key) => { acc[key] = true; return acc }, {})

    const users = await User.find({
        $or: [
            { features_onboarded_at: { $exists: false } },
            { features_onboarded_at: null },
            { features: { $exists: false } },
            { features: {} },
        ]
    }).select('_id features features_onboarded_at created_at').lean()

    let updated = 0
    for (const user of users) {
        const alreadyHasFeatures = user.features && Object.keys(user.features).length > 0
        if (user.features_onboarded_at != null || alreadyHasFeatures) continue
        await User.updateOne(
            { _id: user._id },
            { $set: { features: allOn, features_onboarded_at: user.created_at || new Date() } }
        )
        updated += 1
    }

    console.log(`Backfilled ${updated} legacy user(s) with all features enabled.`)
    process.exit(0)
})()
