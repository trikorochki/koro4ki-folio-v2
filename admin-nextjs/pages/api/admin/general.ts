import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '../../../lib/auth'
import { getGeneralStats } from '../../../lib/redis'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const stats = await getGeneralStats()
    res.status(200).json(stats)
  } catch (error) {
    console.error('Error fetching general stats:', error)
    res.status(500).json({ error: 'Failed to fetch statistics' })
  }
}

export default withAuth(handler)
