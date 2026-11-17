/**
 * lib/portalApi.js
 *
 * Thin server-side client for fetching public data from the BMI Portal API.
 * Fetched at build time; rebuild to refresh.
 *
 * All calls are server-side only — no secrets required for public endpoints.
 */

import { API_WORKER_URL } from './contracts-bridge';

const BASE = API_WORKER_URL;

/** Shared fetch with timeout + error handling */
async function portalFetch(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      console.warn(`[portalApi] ${path} returned HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    return json.success ? json.data : null;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`[portalApi] ${path} timed out`);
    } else {
      console.error(`[portalApi] ${path} error:`, err.message);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch live program catalog from the portal.
 * Falls back to an empty array on error so pages render with static data.
 * @param {string} [level] - Optional filter: 'undergraduate' | 'graduate' | 'doctorate' | 'certificate'
 * @returns {Promise<Array>}
 */
export async function getPortalPrograms(level) {
  const qs = level ? `?level=${encodeURIComponent(level)}` : '';
  const data = await portalFetch(`/api/public/programs${qs}`);
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch aggregate stats (no PII) for display on marketing pages.
 * @returns {Promise<{total_programs: number, total_enrolled_students: number, total_applications_this_term: number} | null>}
 */
export async function getPortalStats() {
  return portalFetch('/api/public/stats');
}

/**
 * Fetch published CMS posts for news/blog section.
 * @param {{ page?: number, perPage?: number }} options
 * @returns {Promise<{results: Array, total: number, total_pages: number} | null>}
 */
export async function getPortalPosts({ page = 1, perPage = 6 } = {}) {
  return portalFetch(`/api/public/cms/posts?page=${page}&per_page=${perPage}`);
}

/**
 * Fetch a single published CMS post by slug.
 * @param {string} slug
 * @returns {Promise<Object | null>}
 */
export async function getPortalPost(slug) {
  return portalFetch(`/api/public/cms/posts/${encodeURIComponent(slug)}`);
}

/**
 * Fetch a single published CMS page by slug.
 * @param {string} slug
 * @returns {Promise<Object | null>}
 */
export async function getPortalPage(slug) {
  return portalFetch(`/api/public/cms/pages/${encodeURIComponent(slug)}`);
}
