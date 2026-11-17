interface ImprovMXConfig {
  apiKey: string;
  domain: string;
}

function generateOrgEmail(name: string, domain: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.-]/g, '');
  return `${slug}@${domain}`;
}

function loadImprovMXConfig(): ImprovMXConfig {
  try {
    const raw = localStorage.getItem('hkm_app_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.improvmxConfig) {
        return {
          apiKey: parsed.improvmxConfig.apiKey || '',
          domain: parsed.improvmxConfig.domain || 'hkmministries.org',
        };
      }
    }
  } catch {
    console.warn('[ImprovMX] Could not parse hkm_app_settings');
  }
  return { apiKey: '', domain: 'hkmministries.org' };
}

async function createAlias(orgEmail: string, forwardTo: string): Promise<{ success: boolean; error?: string }> {
  const config = loadImprovMXConfig();
  if (!config.apiKey) {
    return { success: false, error: 'ImprovMX API key not configured.' };
  }
  if (!forwardTo) {
    return { success: false, error: 'No forwarding email address provided.' };
  }

  const domain = config.domain;
  const localPart = orgEmail.split('@')[0];

  try {
    const response = await fetch(`https://api.improvmx.com/v3/domains/${domain}/aliases`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(config.apiKey + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        alias: localPart,
        forward: forwardTo,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.warn(`[ImprovMX] Alias ${orgEmail} -> ${forwardTo} created successfully.`);
      return { success: true };
    }

    const errMsg = result.error || result.message || `HTTP ${response.status}`;
    console.error('[ImprovMX] Create alias failed:', result);
    return { success: false, error: `ImprovMX: ${errMsg}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ImprovMX] Network error:', err);
    return { success: false, error: `Network error: ${msg}` };
  }
}

async function deleteAlias(orgEmail: string): Promise<{ success: boolean; error?: string }> {
  const config = loadImprovMXConfig();
  if (!config.apiKey) {
    return { success: false, error: 'ImprovMX API key not configured.' };
  }

  const domain = config.domain;
  const localPart = orgEmail.split('@')[0];

  try {
    const response = await fetch(`https://api.improvmx.com/v3/domains/${domain}/aliases/${localPart}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${btoa(config.apiKey + ':')}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.warn(`[ImprovMX] Alias ${orgEmail} deleted successfully.`);
      return { success: true };
    }

    const result = await response.json();
    const errMsg = result.error || result.message || `HTTP ${response.status}`;
    console.error('[ImprovMX] Delete alias failed:', result);
    return { success: false, error: `ImprovMX: ${errMsg}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ImprovMX] Network error:', err);
    return { success: false, error: `Network error: ${msg}` };
  }
}

async function checkAliasExists(orgEmail: string): Promise<{ exists: boolean; error?: string }> {
  const config = loadImprovMXConfig();
  if (!config.apiKey) {
    return { exists: false, error: 'ImprovMX API key not configured.' };
  }

  const domain = config.domain;
  const localPart = orgEmail.split('@')[0];

  try {
    const response = await fetch(`https://api.improvmx.com/v3/domains/${domain}/aliases/${localPart}`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${btoa(config.apiKey + ':')}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      return { exists: true };
    }

    if (response.status === 404 || response.status === 400) {
      return { exists: false };
    }

    const result = await response.json();
    const errMsg = result.error || result.message || `HTTP ${response.status}`;
    console.error('[ImprovMX] Check alias failed:', result);
    return { exists: false, error: `ImprovMX: ${errMsg}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ImprovMX] Network error:', err);
    return { exists: false, error: `Network error: ${msg}` };
  }
}

async function updateAlias(orgEmail: string, forwardTo: string): Promise<{ success: boolean; error?: string }> {
  const config = loadImprovMXConfig();
  if (!config.apiKey) {
    return { success: false, error: 'ImprovMX API key not configured.' };
  }
  if (!forwardTo) {
    return { success: false, error: 'No forwarding email address provided.' };
  }

  const domain = config.domain;
  const localPart = orgEmail.split('@')[0];

  try {
    const response = await fetch(`https://api.improvmx.com/v3/domains/${domain}/aliases/${localPart}`, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${btoa(config.apiKey + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        forward: forwardTo,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.warn(`[ImprovMX] Alias ${orgEmail} updated to forward to ${forwardTo}.`);
      return { success: true };
    }

    const errMsg = result.error || result.message || `HTTP ${response.status}`;
    console.error('[ImprovMX] Update alias failed:', result);
    return { success: false, error: `ImprovMX: ${errMsg}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ImprovMX] Network error:', err);
    return { success: false, error: `Network error: ${msg}` };
  }
}

export { generateOrgEmail, createAlias, deleteAlias, checkAliasExists, updateAlias, loadImprovMXConfig };
export type { ImprovMXConfig };
