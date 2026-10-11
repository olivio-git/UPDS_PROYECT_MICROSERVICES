// scripts/migrations/2026-10-attempts-and-otp.js
//
// One-off data fix to run once, right before deploying the attempt limit.
//
// 1. exams.configuration.attemptsAllowed: the old exam form had this field
//    disabled and always saved 1, so every existing exam holds 1 although no
//    teacher ever chose it. exam-service now enforces the limit, which would
//    block every student who already finished an exam. Existing exams are set
//    to 0 (no limit), which is how they behaved until now; teachers can set a
//    real limit from the form.
// 2. notification_emails: OTP emails no longer store the code. Older rows may
//    still hold templateData.otpCode (long expired); remove it.
//
// Dry run by default. Pass --apply to write.
//
//   docker cp scripts/migrations/2026-10-attempts-and-otp.js exam-service:/app/exam-service/migrate.js
//   docker exec -w /app/exam-service -e NOTIFICATIONS_DB=<db> exam-service node migrate.js [--apply]
//
// MONGO_URI must name the exam database (cba_platform); NOTIFICATIONS_DB
// defaults to notifications_db (notifications-service MONGO_DB_NAME).

const { MongoClient } = require('mongodb');

const apply = process.argv.includes('--apply');
const notificationsDb = process.env.NOTIFICATIONS_DB || 'notifications_db';

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is required.');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  try {
    const exams = client.db().collection('exams');
    const emails = client.db(notificationsDb).collection('notification_emails');

    const examFilter = { 'configuration.attemptsAllowed': 1 };
    const otpFilter = { template: 'otp_verification', 'templateData.otpCode': { $exists: true } };

    const examCount = await exams.countDocuments(examFilter);
    const otpCount = await emails.countDocuments(otpFilter);
    console.log(`db ${client.db().databaseName}: exams with attemptsAllowed=1 -> 0 (no limit): ${examCount}`);
    console.log(`db ${notificationsDb}: OTP emails still holding the code: ${otpCount}`);

    if (!apply) {
      console.log('Dry run. Re-run with --apply to write.');
      return;
    }

    const e = await exams.updateMany(examFilter, { $set: { 'configuration.attemptsAllowed': 0 } });
    const o = await emails.updateMany(otpFilter, { $unset: { 'templateData.otpCode': '' } });
    console.log(`Updated exams: ${e.modifiedCount}; cleaned OTP emails: ${o.modifiedCount}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
