import { resolveCezihMessageUrl } from '../../config/runtime';
import type { FhirMessageBundle } from '../../fhir/types';
import type { CezihMessageClient } from './cezihMessageClient';

/**
 * POST FHIR message bundles to CEZIH encounter-management endpoint.
 * Bundle signing (signature.data) is not implemented until mTLS cert is available.
 */
export class CezihHttpMessageClient implements CezihMessageClient {
  constructor(private readonly messageUrl: string = resolveCezihMessageUrl()!) {}

  async postMessage(bundle: FhirMessageBundle): Promise<FhirMessageBundle> {
    const response = await fetch(this.messageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/fhir+json',
        Accept: 'application/fhir+json',
      },
      body: JSON.stringify(bundle),
    });

    const payload = (await response.json()) as FhirMessageBundle;
    if (!response.ok) {
      throw new Error(`CEZIH message request failed (${response.status})`);
    }
    return payload;
  }
}
