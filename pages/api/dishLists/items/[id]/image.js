import { verifyToken } from '../../../../../lib/auth'
import dbConnect from '../../../../../lib/dbConnect'
import { getDishListImage } from '../../../../../lib/dishListImageServer'
import { logAPI } from '../../../../../lib/logger'

function weakEtag(data) {
    let hash = 5381
    for (let i = 0; i < data.length; i += 1) {
        hash = ((hash << 5) + hash) ^ data[i]
    }
    return `W/"${data.length.toString(16)}-${(hash >>> 0).toString(16)}"`
}

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res)
    if (!decoded) return

    const { id } = req.query
    const quality = req.query.q === 'full' ? 'full' : 'thumb'

    await dbConnect()

    try {
        if (req.method === 'GET') {
            const image = await getDishListImage(id, quality)
            if (!image) {
                return res.status(404).json({ res: 'Image not found' })
            }

            const etag = weakEtag(image.data)
            res.setHeader('Content-Type', image.mime)
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
            res.setHeader('ETag', etag)

            if (req.headers['if-none-match'] === etag) {
                return res.status(304).end()
            }
            return res.status(200).send(image.data)
        }

        res.setHeader('Allow', ['GET'])
        return res.status(405).end(`Method ${req.method} Not Allowed`)
    } catch (e) {
        return res.status(500).json({ res: 'Internal Server Error: ' + e?.message })
    }
}
