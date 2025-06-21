import EmailQueue from '../src/emailQueueModel.js';
import MailLog from '../src/mailLogModel.js';
import MailAccount from '../src/mailAccountModel.js';
import nodemailer from 'nodemailer';
import path from 'path';
import { createMailBody } from '../src/index.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todaySentCount = await EmailQueue.countDocuments({
      isSend: true,
      sentAt: { $gte: today, $lt: tomorrow }
    });
    if (todaySentCount >= 100) {
      return res.json({ message: 'Daily email limit (100) reached.' });
    }
    const remainingEmails = 100 - todaySentCount;
    const limit = Math.min(50, remainingEmails);
    const pendingEmails = await EmailQueue.find({
      isSend: false,
      isProcessing: false,
      status: { $ne: 'error' }
    }).limit(limit);
    let processed = 0;
    for (const email of pendingEmails) {
      try {
        await EmailQueue.findByIdAndUpdate(email._id, { isProcessing: true });
        const body = createMailBody(email.personData || email);
        const accounts = await MailAccount.find({ active: true });
        for (const acc of accounts) {
          if (!acc.lastSentDate || acc.lastSentDate < today) {
            acc.sentToday = 0; acc.lastSentDate = today; await acc.save();
          }
        }
        const available = accounts.filter(acc => acc.sentToday < acc.dailyLimit);
        if (available.length === 0) throw new Error('Tüm SMTP hesaplarının günlük limiti doldu');
        const idx = Math.floor(Math.random() * available.length);
        const account = available[idx];
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com', port: 465, secure: true,
          auth: { user: account.user, pass: account.pass }
        });
        const mailOptions = {
          from: account.from,
          to: email.email,
          subject: 'İş Başvurusu: Yazılım Geliştirici',
          text: body,
          attachments: [
            { filename: 'Omer_Faruk_Yilmaz_CV.pdf', path: path.join(process.cwd(), 'src', 'Omer_Faruk_Yilmaz_CV.pdf') }
          ]
        };
        await transporter.sendMail(mailOptions);
        account.sentToday += 1; account.lastSentDate = new Date(); await account.save();
        await EmailQueue.findByIdAndUpdate(email._id, {
          isSend: true, isProcessing: false, status: 'sent', sendAt: new Date()
        });
        await MailLog.create({
          email: email.email,
          from: account.from,
          firstName: email.firstName,
          lastName: email.lastName,
          company: email.company,
          status: 'sent',
          sentAt: new Date(),
          attachments: mailOptions.attachments ? mailOptions.attachments.map(a => a.filename) : []
        });
        processed++;
      } catch (err) {
        await EmailQueue.findByIdAndUpdate(email._id, {
          isProcessing: false, status: 'error', errorMessage: err.message
        });
      }
    }
    res.json({ message: 'Vercel cron endpoint processed.', processed });
  } catch (error) {
    res.status(500).json({ error: 'Vercel cron endpoint error', details: error.message });
  }
} 