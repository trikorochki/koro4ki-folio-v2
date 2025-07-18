import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '../../../lib/auth'
import { getTracksStats } from '../../../lib/redis'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const tracks = await getTracksStats()
    res.status(200).json({ tracks })
  } catch (error) {
    console.error('Error fetching tracks stats:', error)
    res.status(500).json({ error: 'Failed to fetch tracks statistics' })
  }
}

export default withAuth(handler)
