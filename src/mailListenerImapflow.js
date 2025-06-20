import mongoose from 'mongoose';
import MailAccount from './mailAccountModel.js';
import ReceivedMailLog from './receivedMailLogModel.js';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import dotenv from 'dotenv';
dotenv.config();

if (!mongoose.connection.readyState) {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
}

async function fetchInboxForAccountImapflow(account) {
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: !!account.imapSecure,
    auth: {
      user: account.imapUser || account.user,
      pass: account.imapPass || account.pass
    }
  });

  await client.connect();
  let lock = await client.getMailboxLock('INBOX');
  try {
    // Sadece okunmamış mailleri çek
    for await (let msg of client.fetch({ seen: false }, { envelope: true, source: true })) {
      const parsed = await simpleParser(msg.source);
      await ReceivedMailLog.create({
        from: parsed.from?.text,
        to: parsed.to?.text,
        subject: parsed.subject,
        body: parsed.text,
        date: parsed.date,
        account: account._id,
        raw: parsed,
        attachments: parsed.attachments
      });
    }
  } finally {
    lock.release();
    await client.logout();
  }
}

export async function fetchAllInboxesImapflow() {
  const accounts = await MailAccount.find({ active: true, imapHost: { $exists: true, $ne: null } });
  for (const acc of accounts) {
    try {
      await fetchInboxForAccountImapflow(acc);
    } catch (e) {
      console.error('Account fetch error:', acc.user, e);
    }
  }
}

// fetchAllInboxesImapflow(); // Manuel tetikleme için 