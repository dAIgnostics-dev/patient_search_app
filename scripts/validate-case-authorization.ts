import assert from 'node:assert/strict';
import {
  CASE_MANAGEMENT_ROLES,
  DEFAULT_PRACTITIONER_ROLE,
  canManageCases,
} from '../src/auth/roles';

assert.equal(
  canManageCases('private_care_specialist'),
  true,
  'private_care_specialist must be allowed to manage cases',
);

assert.equal(
  canManageCases(DEFAULT_PRACTITIONER_ROLE),
  true,
  'default POC role must be allowed to manage cases',
);

assert.equal(canManageCases('specialist'), true, 'specialist must be allowed');
assert.equal(canManageCases('dentist'), true, 'dentist must be allowed');
assert.equal(canManageCases(' resident '), true, 'role should be trimmed before check');

assert.equal(canManageCases('clinician'), false, 'legacy generic role must be rejected');
assert.equal(canManageCases('nurse'), false, 'unlisted role must be rejected');
assert.equal(canManageCases(''), false, 'empty role must be rejected');
assert.equal(canManageCases(null), false, 'null role must be rejected');
assert.equal(canManageCases(undefined), false, 'undefined role must be rejected');

assert.equal(CASE_MANAGEMENT_ROLES.size, 17, 'expected exactly 17 authorized roles');

console.log('Case authorization validation passed.');
