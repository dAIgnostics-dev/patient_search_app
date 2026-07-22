import assert from 'node:assert/strict';
import {
  DEFAULT_PRACTITIONER_ROLE,
  ENCOUNTER_MANAGEMENT_ROLES,
  canManageEncounters,
} from '../src/auth/roles';

assert.equal(
  canManageEncounters('private_care_specialist'),
  true,
  'private_care_specialist must be allowed to manage encounters',
);

assert.equal(
  canManageEncounters(DEFAULT_PRACTITIONER_ROLE),
  true,
  'default POC role must be allowed to manage encounters',
);

assert.equal(canManageEncounters('nurse'), true, 'nurse must be allowed for encounters');
assert.equal(
  canManageEncounters('sgp_administrator'),
  true,
  'sgp_administrator must be allowed for encounters',
);
assert.equal(canManageEncounters('home_caregiver'), true, 'home_caregiver must be allowed');
assert.equal(canManageEncounters(' resident '), true, 'role should be trimmed before check');

assert.equal(canManageEncounters('clinician'), false, 'legacy generic role must be rejected');
assert.equal(canManageEncounters('unknown_role'), false, 'unlisted role must be rejected');
assert.equal(canManageEncounters(''), false, 'empty role must be rejected');
assert.equal(canManageEncounters(null), false, 'null role must be rejected');
assert.equal(canManageEncounters(undefined), false, 'undefined role must be rejected');

assert.equal(ENCOUNTER_MANAGEMENT_ROLES.size, 30, 'expected exactly 30 authorized roles');

console.log('Encounter authorization validation passed.');
