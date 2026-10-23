// How many shootings per section go on the home roll (the rest only live in the Archive).
export const HOME_LIMIT = { models: 12, projects: 99, travels: 99, erotic: 99 } as const;

// Frames (shooting slug, 1-based photo number) shown on the site-wide social preview and on the Contact page. None of them is nude.
export const SITE_FRAMES: [string, number][] = [['2025-new-york', 25], ['people-in-museums', 18], ['brutalism-in-skopje', 19]];
