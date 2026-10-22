import type { APIRoute } from 'astro';
import { siteOg } from '../../lib/og';
import { getShootings } from '../../lib/shooting';

export const GET: APIRoute = async () =>
  new Response(new Uint8Array(await siteOg(await getShootings())), { headers: { 'Content-Type': 'image/jpeg' } });
