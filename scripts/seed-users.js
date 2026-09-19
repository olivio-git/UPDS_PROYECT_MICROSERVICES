/*
 * Creates a consistent set of accounts across the two user stores.
 *
 * "One person, one id": a person has up to three records — credentials in
 * cba_auth_db, a profile in cba_user_management_db, and — only for students —
 * a candidate document that the exam domain references — but they all share
 * the SAME _id (the auth-service user id). The profile keeps authServiceUserId
 * populated for backward compatibility, but it always equals _id. This script
 * creates all of them together so they can never drift apart.
 *
 * Run inside the auth-service container:
 *   docker cp scripts/seed-users.js auth-service:/app/seed-users.js
 *   docker exec -e UMS_DB_NAME=cba_user_management_db -w /app auth-service node seed-users.js
 *
 * Set SEED_PASSWORD to choose the shared password (default below).
 */
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

const PASSWORD = process.env.SEED_PASSWORD || 'CbaTest2026!';

const PEOPLE = [
  { email: 'admin@cba.test', firstName: 'Admin', lastName: 'CBA', role: 'admin' },
  { email: 'docente@cba.test', firstName: 'Docente', lastName: 'CBA', role: 'teacher' },
  { email: 'supervisor@cba.test', firstName: 'Supervisor', lastName: 'CBA', role: 'proctor' },
  { email: 'alumno1@cba.test', firstName: 'Alumno', lastName: 'Uno', role: 'student', level: 'A1' },
  { email: 'alumno2@cba.test', firstName: 'Alumno', lastName: 'Dos', role: 'student', level: 'A2' },
  { email: 'alumno3@cba.test', firstName: 'Alumno', lastName: 'Tres', role: 'student', level: 'B1' },
];

(async () => {
  const client = await MongoClient.connect(process.env.MONGO_URI);
  const auth = client.db(process.env.MONGO_DB_NAME);
  const ums = client.db(process.env.UMS_DB_NAME || 'cba_user_management_db');
  const usersCol = process.env.MONGO_COLLECTION_USERS || 'users';
  const hash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date();

  for (const person of PEOPLE) {
    const { email, firstName, lastName, role, level } = person;
    await auth.collection(usersCol).deleteMany({ email });
    await ums.collection('users').deleteMany({ email });

    // "one person, one id": the auth-service user _id is the canonical person
    // id, reused as-is for the profile and (for students) the candidate.
    const personId = new ObjectId();
    await auth.collection(usersCol).insertOne({
      _id: personId, email, password: hash, firstName, lastName, role,
      isActive: true, isEmailVerified: true, permissions: [], profile: {},
      createdAt: now, updatedAt: now,
    });

    await ums.collection('users').insertOne({
      _id: personId, authServiceUserId: String(personId), email, firstName, lastName, role,
      isActive: true, status: 'active', permissions: [], profile: {},
      createdAt: now, updatedAt: now,
    });

    // Only students are exam candidates. A proctor used to have a candidate
    // record, which is what made the roles impossible to reason about.
    if (role === 'student') {
      // By email: the id is new on every run, so matching on it would leave
      // the previous run's candidate behind.
      await ums.collection('candidates').deleteMany({ 'personalInfo.email': email });
      await ums.collection('candidates').insertOne({
        _id: personId,
        userId: personId,
        personalInfo: { firstName, lastName, email },
        academicInfo: { currentLevel: level, targetLevel: level },
        status: 'active', examHistory: [], createdAt: now, updatedAt: now,
      });
    }
    console.log(`${role.padEnd(8)} ${email}`);
  }

  console.log(`\npassword for every account: ${PASSWORD}`);
  console.log('sign-in is OTP first, then this password.');
  await client.close();
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
