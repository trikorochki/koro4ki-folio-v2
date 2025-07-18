import { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { token } = req.body

  if (!token) {
    return res.status(400).json({ error: 'Token is required' })
  }

  // Проверяем токен напрямую
  if (token !== process.env.STATS_API_SECRET) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  return res.status(200).json({ success: true })
}
