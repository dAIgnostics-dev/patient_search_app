import { cezihProxyUrl, getCezihEndpoint, resolveCezihMode } from '../config/cezihEndpoints';
import { cezihFetch } from './fhir-client/cezihFetch';

export interface CezihEndpointProbeResult {
  status: 'verified' | 'responded' | 'failed' | 'websocket' | 'postDisabled';
  localUrl: string | null;
  httpStatus: number | null;
  response: string;
}

/** Live diagnostics use GET only; business POST operations require their own valid payloads. */
export async function probeCezihEndpoint(id: string): Promise<CezihEndpointProbeResult> {
  const endpoint = getCezihEndpoint(id);
  if (!endpoint.method) {
    return { status: 'websocket', localUrl: null, httpStatus: null, response: '' };
  }
  const live = resolveCezihMode() === 'cert-live';
  if (live && endpoint.method !== 'GET') {
    return { status: 'postDisabled', localUrl: null, httpStatus: null, response: '' };
  }
  const localUrl = cezihProxyUrl(id) + (endpoint.url.includes('{id}') ? '/demo-id' : '') +
    (live && id.endsWith('.search') ? '?_count=1' : '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), live ? 15000 : 5000);
  let httpStatus: number | null = null;
  let response = '';
  try {
    const result = await cezihFetch(localUrl, {
      method: endpoint.method,
      credentials: 'omit',
      headers: { Accept: 'application/fhir+json' },
      signal: controller.signal,
    });
    httpStatus = result.status;
    response = await result.text();
    if (live) {
      const responded = result.headers.get('x-cezih-endpoint') === id &&
        result.headers.get('x-cezih-upstream-status') === String(httpStatus);
      return { status: responded ? 'responded' : 'failed', localUrl, httpStatus, response };
    }
    const payload = JSON.parse(response) as {
      resourceType?: string;
      issue?: Array<{ diagnostics?: string }>;
      extension?: Array<{ url?: string; valueUri?: string; valueCode?: string }>;
    };
    const verified = httpStatus === 503 && payload.resourceType === 'OperationOutcome' &&
      payload.issue?.some((issue) => issue.diagnostics?.startsWith('CEZIH_NETWORK_DISABLED:')) &&
      payload.extension?.some((item) => item.url === 'urn:cezih:offline:endpoint' && item.valueUri === endpoint.url) &&
      payload.extension?.some((item) => item.url === 'urn:cezih:offline:method' && item.valueCode === endpoint.method);
    return { status: verified ? 'verified' : 'failed', localUrl, httpStatus, response };
  } catch (error) {
    return {
      status: 'failed', localUrl, httpStatus,
      response: response || (error instanceof Error ? error.message : String(error)),
    };
  } finally {
    clearTimeout(timeout);
  }
}
