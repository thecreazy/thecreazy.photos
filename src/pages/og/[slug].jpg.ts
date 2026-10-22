import type { APIRoute, GetStaticPaths } from 'astro';
import { shootingOg } from '../../lib/og';
import { getShootings } from '../../lib/shooting';

export const getStaticPaths = (async () => (await getShootings()).map((s) => ({ params: { slug: s.slug }, props: { s } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await shootingOg(props.s)), { headers: { 'Content-Type': 'image/jpeg' } });
