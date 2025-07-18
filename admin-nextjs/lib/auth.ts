export function verifyAuth(authHeader: string | undefined): boolean {
  if (!authHeader) return false
  
  const token = authHeader.replace('Bearer ', '')
  const expectedToken = process.env.STATS_API_SECRET
  
  return token === expectedToken
}

export function withAuth(handler: Function) {
  return async (req: any, res: any) => {
    const authHeader = req.headers.authorization
    
    if (!verifyAuth(authHeader)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    
    return handler(req, res)
  }
}
