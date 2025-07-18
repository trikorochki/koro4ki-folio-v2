import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

export function withAuth(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    if (token !== process.env.STATS_API_SECRET) {
      console.warn('Invalid auth attempt:', {
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      });
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    return handler(req, res);
  };
}
