import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '../../../lib/auth'
import { getAudienceStats } from '../../../lib/redis'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const stats = await getAudienceStats()
    res.status(200).json(stats)
  } catch (error) {
    console.error('Error fetching audience stats:', error)
    res.status(500).json({ error: 'Failed to fetch audience statistics' })
  }
}

export default withAuth(handler)
