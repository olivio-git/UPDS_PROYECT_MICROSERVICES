/*
 * End-to-end check that a student cannot escalate privileges through the
 * identity-service user endpoints: no role/status change on themselves via
 * /users/me or /users/:id, no edits to another user, and no user listing.
 *
 * Creates two throwaway students (@example.com, RFC 2606 reserved) and deletes
 * them at the end, even on failure.
 *
 * Run inside the exam-service container (it has mongoose and jsonwebtoken):
 *   docker cp scripts/e2e/identity-privilege.e2e.js exam-service:/app/exam-service/identity-privilege.e2e.js
 *   docker exec -w /app/exam-service exam-service node identity-privilege.e2e.js
 */
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const GATEWAY = process.env.E2E_GATEWAY_URL || 'http://api-gateway';
const TAG = `e2e-privilege-${Date.now()}`;
const { ObjectId } = mongoose.Types;

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

async function api(method, path, token, body) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run against production.');
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(process.env.MONGO_URI);
  const people = mongoose.connection.client.db(process.env.MONGO_UMS_DB_NAME || 'cba_identity_db');
  const created = [];

  try {
    const makeStudent = async (suffix) => {
      const id = new ObjectId();
      const email = `${TAG}-${suffix}@example.com`;
      await people.collection('users').insertOne({
        _id: id, authServiceUserId: String(id), email, firstName: 'E2E', lastName: suffix,
        role: 'student', isActive: true, status: 'active', createdAt: new Date(),
      });
      created.push(id);
      const token = jwt.sign({ userId: String(id), email, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '10m' });
      return { id, token };
    };

    const attacker = await makeStudent('attacker');
    const victim = await makeStudent('victim');

    const me = await api('PATCH', '/api/v1/users/me', attacker.token, { firstName: 'Renamed', role: 'admin', status: 'active' });
    const afterMe = await people.collection('users').findOne({ _id: attacker.id });
    check('PATCH /users/me cannot set role', afterMe.role === 'student', `HTTP ${me.status}, role=${afterMe.role}`);

    const selfById = await api('PATCH', `/api/v1/users/${attacker.id}`, attacker.token, { role: 'admin' });
    const afterSelf = await people.collection('users').findOne({ _id: attacker.id });
    check('PATCH /users/:self cannot set role', afterSelf.role === 'student', `HTTP ${selfById.status}, role=${afterSelf.role}`);

    const putSelf = await api('PUT', `/api/v1/users/${attacker.id}`, attacker.token, { role: 'admin' });
    const afterPut = await people.collection('users').findOne({ _id: attacker.id });
    check('PUT /users/:self cannot set role', afterPut.role === 'student', `HTTP ${putSelf.status}, role=${afterPut.role}`);

    const other = await api('PATCH', `/api/v1/users/${victim.id}`, attacker.token, { status: 'inactive' });
    const afterOther = await people.collection('users').findOne({ _id: victim.id });
    check('cannot change another user', other.status === 403 && afterOther.status === 'active', `HTTP ${other.status}, status=${afterOther.status}`);

    const list = await api('GET', '/api/v1/users', attacker.token);
    check('cannot list users', list.status === 403, `HTTP ${list.status}`);
  } finally {
    await people.collection('users').deleteMany({ _id: { $in: created } });
    console.log('cleanup done');
    await mongoose.disconnect();
  }

  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exitCode = failed ? 1 : 0;
}

main().catch(async (e) => { console.error('ERROR:', e.message); process.exitCode = 1; await mongoose.disconnect().catch(() => {}); });
