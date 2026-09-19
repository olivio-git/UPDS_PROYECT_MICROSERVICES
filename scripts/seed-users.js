/*
 * Creates a consistent set of accounts in the merged identity-service database.
 *
 * "One person, one id": since the auth-service + user-management-service
 * merge, a person is ONE document in the `users` collection holding both the
 * profile fields and the credential hash (passwordHash) — plus, only for
 * students, a `candidates` document in the SAME database that the exam
 * domain references. Both documents share the SAME _id. The user document
 * keeps authServiceUserId populated for backward compatibility with
 * exam-service's read-only mirror of this collection, but it always equals
 * _id.toString() now — see identity-service/src/models/User.ts.
 *
 * Run inside the identity-service container:
 *   docker cp scripts/seed-users.js identity-service:/app/seed-users.js
 *   docker exec -w /app identity-service node seed-users.js
 *
 * (No UMS_DB_NAME override needed anymore — the script reads MONGO_DB_NAME,
 * which identity-service's own environment already points at the merged DB.)
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

const DEFAULT_PROFILE = {
  preferences: {
    language: 'es',
    timezone: 'America/La_Paz',
    notifications: { email: true, push: true, sms: false },
  },
};

(async () => {
  const client = await MongoClient.connect(process.env.MONGO_URI);
  const db = client.db(process.env.MONGO_DB_NAME || 'cba_identity_db');
  const usersCol = process.env.MONGO_COLLECTION_USERS || 'users';
  const candidatesCol = process.env.MONGO_COLLECTION_CANDIDATES || 'candidates';
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const now = new Date();

  for (const person of PEOPLE) {
    const { email, firstName, lastName, role, level } = person;
    await db.collection(usersCol).deleteMany({ email });

    // "one person, one id": there is only ever one _id for this person now —
    // minted once, here, and mirrored into authServiceUserId for
    // exam-service's read-only copy of this collection.
    const personId = new ObjectId();
    await db.collection(usersCol).insertOne({
      _id: personId,
      authServiceUserId: String(personId),
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      status: 'active',
      permissions: [],
      profile: DEFAULT_PROFILE,
      createdAt: now,
      updatedAt: now,
    });

    // Only students are exam candidates. A proctor used to have a candidate
    // record, which is what made the roles impossible to reason about.
    if (role === 'student') {
      // By email: the id is new on every run, so matching on it would leave
      // the previous run's candidate behind.
      await db.collection(candidatesCol).deleteMany({ 'personalInfo.email': email });
      await db.collection(candidatesCol).insertOne({
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
