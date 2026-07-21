/**
 * Vercel serverless function — returns the visitor's coarse location from
 * Vercel's edge geo headers. No IP is stored; the booking widget calls this
 * and saves only country/region/city onto the booking for analytics.
 */

type VercelReq = { headers: Record<string, string | string[] | undefined> };
type VercelRes = {
    status: (code: number) => VercelRes;
    setHeader: (k: string, v: string) => void;
    json: (data: unknown) => void;
};

const h = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

export default function handler(req: VercelReq, res: VercelRes) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
        country: h(req.headers['x-vercel-ip-country']),
        region: h(req.headers['x-vercel-ip-country-region']),
        city: decodeURIComponent(h(req.headers['x-vercel-ip-city'])),
    });
}
