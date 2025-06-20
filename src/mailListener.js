import mongoose from 'mongoose';
import MailAccount from './mailAccountModel.js';
import ReceivedMailLog from './receivedMailLogModel.js';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import dotenv from 'dotenv';
import { Buffer } from 'buffer';
dotenv.config();

// Connect to MongoDB if not already
if (!mongoose.connection.readyState) {
  await mongoose.connect("mongodb+srv://omer:cnZXReX0N7fiGIAQ@cluster0.a6nr3dw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
}

async function fetchInboxForAccount(account) {
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
    // Sadece son 300 okunmamış maili çek
    const mailbox = await client.mailboxOpen('INBOX');
    const total = mailbox.exists;
    const fetchStart = Math.max(1, total - 299); // Son 300 mail
    let count = 0;
    const startAll = Date.now();
    for await (let msg of client.fetch({ seq: `${fetchStart}:*`, seen: false }, { envelope: true, source: true })) {
      const startMail = Date.now();
      let source = Buffer.from([]);
      for await (const chunk of msg.source) {
        let buf;
        if (Buffer.isBuffer(chunk)) {
          buf = chunk;
        } else if (typeof chunk === 'string') {
          buf = Buffer.from(chunk);
        } else if (typeof chunk === 'number') {
          buf = Buffer.from([chunk]);
        } else {
          buf = Buffer.from(String(chunk));
        }
        source = Buffer.concat([source, buf]);
      }
      const parsed = await simpleParser(source);
      // Duplicate kontrolü: aynı account, subject ve date varsa kaydetme
      const alreadyExists = await ReceivedMailLog.exists({
        account: account._id,
        subject: parsed.subject,
        date: parsed.date
      });
      if (alreadyExists) {
        console.log(`Zaten kayıtlı: ${parsed.subject} (${parsed.date})`);
        continue;
      }
      try {
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
        count++;
        console.log(`Mail kaydedildi: ${parsed.subject} (${count}/${total}) - Süre: ${Date.now() - startMail}ms`);
      } catch (e) {
        console.error('DB save error:', e);
      }
    }
    console.log(`Tüm mailler işlendi. Toplam: ${count}, Toplam süre: ${Date.now() - startAll}ms`);
  } catch (e) {
    console.log("catch error test deneme", e)
  } finally {
    console.log("finaly test deneme")
    lock.release();
    await client.logout();
  }
}

export async function fetchAllInboxes() {
  const accounts = await MailAccount.find({ active: true, imapHost: { $exists: true, $ne: null } });
  console.log(accounts, "accounts")
  for (const acc of accounts) {
    try {
      await fetchInboxForAccount(acc);
      console.log("all fetched test deneme")
      return true
    } catch (e) {
      console.error('Account fetch error:', acc.user, e);
      return false
    }
  }
}

// fetchAllInboxes(); // Manuel tetikleme için 