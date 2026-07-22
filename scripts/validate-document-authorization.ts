import assert from 'node:assert/strict';
import {
  DEFAULT_PRACTITIONER_ROLE,
  DOCUMENT_RETRIEVE_ROLES,
  DOCUMENT_SEARCH_ROLES,
  canRegisterDocument,
  canRetrieveDocuments,
  canSearchDocuments,
} from '../src/auth/roles';

// ITI-67 pretraga
assert.equal(
  canSearchDocuments(DEFAULT_PRACTITIONER_ROLE),
  true,
  'default POC role must be allowed to search documents',
);
assert.equal(canSearchDocuments('specialistic_nurse'), true, 'specialistic_nurse may search');
assert.equal(canSearchDocuments('helpdesk_clinical_documents'), true, 'helpdesk may search');
assert.equal(canSearchDocuments(' resident '), true, 'role should be trimmed before check');
assert.equal(canSearchDocuments('unknown_role'), false, 'unlisted role must be rejected');
assert.equal(canSearchDocuments(null), false, 'null role must be rejected');

// ITI-68 dohvat
assert.equal(
  canRetrieveDocuments(DEFAULT_PRACTITIONER_ROLE),
  true,
  'default POC role must be allowed to retrieve documents',
);
assert.equal(canRetrieveDocuments('helpdesk_clinical_documents'), true, 'helpdesk may retrieve');
assert.equal(
  canRetrieveDocuments('specialistic_nurse'),
  false,
  'specialistic_nurse is not on the retrieve list',
);
assert.equal(canRetrieveDocuments('unknown_role'), false, 'unlisted role must be rejected');

// ITI-65 registracija (matrica po tipu; implementirano samo za 011)
assert.equal(
  canRegisterDocument(DEFAULT_PRACTITIONER_ROLE, '011'),
  true,
  'private_care_specialist must be allowed to register type 011',
);
assert.equal(
  canRegisterDocument('helpdesk_clinical_documents', '011'),
  true,
  'helpdesk (universal) must be allowed to register any type',
);
assert.equal(
  canRegisterDocument('helpdesk_clinical_documents', '999'),
  true,
  'helpdesk (universal) must be allowed even for unknown type',
);
assert.equal(
  canRegisterDocument('resident', '011'),
  false,
  'resident is not permitted to register type 011',
);
assert.equal(
  canRegisterDocument('private_care_specialist', '999'),
  false,
  'unknown document type must be rejected for non-universal roles',
);
assert.equal(canRegisterDocument(null, '011'), false, 'null role must be rejected');
assert.equal(canRegisterDocument('private_care_specialist', null), false, 'null type must be rejected');

assert.equal(DOCUMENT_SEARCH_ROLES.size, 26, 'expected exactly 26 search roles (25 + helpdesk)');
assert.equal(DOCUMENT_RETRIEVE_ROLES.size, 22, 'expected exactly 22 retrieve roles (21 + helpdesk)');

console.log('Document authorization validation passed.');
