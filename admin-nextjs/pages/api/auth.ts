import { NextApiRequest, NextApiResponse } from 'next'
import { verifyAuth } from '../../lib/auth'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { token } = req.body
  
  if (!token) {
    return res.status(400).json({ error: 'Token is required' })
  }

  const isValid = verifyAuth(`Bearer ${token}`)
  
  if (isValid) {
    res.status(200).json({ success: true })
  } else {
    res.status(401).json({ error: 'Invalid token' })
  }
}
