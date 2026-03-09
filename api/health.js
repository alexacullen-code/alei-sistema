export default async function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: 'api',
    has_database_url: Boolean(process.env.DATABASE_URL),
    method: req.method,
  });
}
