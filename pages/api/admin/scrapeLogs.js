import { verifyToken } from '../../../lib/auth.ts'
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import ScrapeLog from '../../../models/ScrapeLog'
import { logAPI } from '../../../lib/logger.ts'

/**
 * Admin scrape-log viewer: recent log entries plus lightweight per-domain
 * aggregate stats. Read-only; logs auto-expire after 90 days (TTL).
 */
export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res)
    if (!decoded) return

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' })
    }

    await dbConnect()
    const userData = await User.findById(decoded.id)
    if (!userData || userData.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    try {
        const days = Math.min(Number(req.query.days) || 7, 90)
        const domainFilter = String(req.query.domain || '').trim()
        const limit = Math.min(Number(req.query.limit) || 100, 500)
        const since = new Date(Date.now() - days * 86400000)

        const match = { created_at: { $gte: since } }
        if (domainFilter) match.domain = domainFilter

        const [logs, byDomain, failures] = await Promise.all([
            ScrapeLog.find(match).sort({ created_at: -1 }).limit(limit).lean(),
            ScrapeLog.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: '$domain',
                        total: { $sum: 1 },
                        ok: { $sum: { $cond: ['$success', 1, 0] } },
                        jsonld: { $sum: { $cond: [{ $and: ['$success', { $eq: ['$extractionTier', 'jsonld'] }] }, 1, 0] } },
                        storedRule: { $sum: { $cond: [{ $and: ['$success', { $eq: ['$extractionTier', 'stored-rule'] }] }, 1, 0] } },
                        heuristic: { $sum: { $cond: [{ $and: ['$success', { $eq: ['$extractionTier', 'heuristic'] }] }, 1, 0] } },
                        aiGenerated: { $sum: { $cond: [{ $and: ['$success', { $eq: ['$extractionTier', 'ai-generated'] }] }, 1, 0] } },
                        aiUsed: { $sum: { $cond: ['$aiUsed', 1, 0] } },
                        curlFallback: { $sum: { $cond: [{ $eq: ['$sourceFallback', 'curl'] }, 1, 0] } },
                        avgMs: { $avg: { $cond: ['$success', '$tookMs', null] } },
                        lastAt: { $max: '$created_at' }
                    }
                },
                { $sort: { total: -1 } }
            ]),
            ScrapeLog.find({ ...match, success: false }).sort({ created_at: -1 }).limit(25).lean()
        ])

        return res.status(200).json({
            success: true,
            data: { logs, byDomain, failures, days },
            message: ''
        })
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message })
    }
}
