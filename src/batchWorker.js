import mongoose from 'mongoose';
import EmailQueue from './emailQueueModel.js';
import MailLog from './mailLogModel.js';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import { parentPort, workerData } from 'worker_threads';
import MailAccount from './mailAccountModel.js';

// ES modules için __filename, __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getRandomAvailableAccount() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const accounts = await MailAccount.find({ active: true });
    // Günlük limit sıfırlama
    for (const acc of accounts) {
        if (!acc.lastSentDate || acc.lastSentDate < today) {
            acc.sentToday = 0;
            acc.lastSentDate = today;
            await acc.save();
        }
    }
    const available = accounts.filter(acc => acc.sentToday < acc.dailyLimit);
    if (available.length === 0) throw new Error('Tüm SMTP hesaplarının günlük limiti doldu');
    const idx = Math.floor(Math.random() * available.length);
    return available[idx];
}

function createMailBody(person) {
    return `Merhaba ${person['First Name'] || person.firstName || ''} ${person['Last Name'] || person.lastName || ''},\n\n${person['Company'] || person.company ? (person['Company'] || person.company) + ' şirketinizde' : ''} açık pozisyonlar için başvurmak istiyorum.\n\nPozisyon: ${person['Title'] || person.title || '-'}\nŞirket: ${person['Company'] || person.company || '-'}\nLinkedIn: ${person['Person Linkedin Url'] || person.linkedin || '-'}\n\nCV'm ekte yer almaktadır.\n\nİyi çalışmalar.\nÖmer Faruk Yılmaz`;
}

async function sendEmail(emailData) {
    try {
        const objectId = new mongoose.Types.ObjectId(emailData._id);
        await EmailQueue.findByIdAndUpdate(objectId, { isProcessing: true });
        const body = createMailBody(emailData.personData || emailData);
        const account = await getRandomAvailableAccount();
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user: account.user, pass: account.pass }
        });
        const mailOptions = {
            from: account.user,
            to: emailData.email,
            subject: 'İş Başvurusu: Yazılım Geliştirici',
            text: body,
            attachments: [
                {
                    filename: 'Omer_Faruk_Yilmaz_CV.pdf',
                    path: path.join(__dirname, 'Omer_Faruk_Yilmaz_CV.pdf')
                }
            ]
        };
        await transporter.sendMail(mailOptions);
        // Hesabın gönderim sayısını artır
        account.sentToday += 1;
        account.lastSentDate = new Date();
        await account.save();
        await EmailQueue.findByIdAndUpdate(objectId, {
            isSend: true,
            isProcessing: false,
            status: 'sent',
            sentAt: new Date()
        });
        await MailLog.create({
            email: emailData.email,
            from: account.from,
            firstName: emailData.firstName,
            lastName: emailData.lastName,
            company: emailData.company,
            status: 'sent',
            sentAt: new Date(),
            attachments: mailOptions.attachments ? mailOptions.attachments.map(a => a.filename) : []
        });
        console.log(`Email sent successfully to ${emailData.email}`);
        return true;
    } catch (error) {
        try {
            const objectId = new mongoose.Types.ObjectId(emailData._id);
            await EmailQueue.findByIdAndUpdate(objectId, {
                isProcessing: false,
                status: 'error',
                errorMessage: error.message
            });
        } catch (updateError) {
            console.error('Error updating email status:', updateError);
        }
        console.error(`Failed to send email to ${emailData.email}:`, error);
        return false;
    }
}

// Worker thread için batch processing
if (workerData && workerData.batch) {
    console.log('Batch worker started with', workerData.batch.length, 'emails');
    mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(async () => {
        console.log('Batch worker MongoDB bağlantısı başarılı');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const todaySentCount = await EmailQueue.countDocuments({
            isSend: true,
            sentAt: { $gte: today, $lt: tomorrow }
        });
        console.log(`Today's sent email count: ${todaySentCount}`);
        if (todaySentCount >= 100) {
            console.log('Daily email limit (100) reached. Cannot process batch.');
            parentPort.postMessage({ error: 'Daily email limit (100) reached' });
            process.exit(0);
        }
        const remainingEmails = 100 - todaySentCount;
        const maxBatchSize = Math.min(workerData.batch.length, remainingEmails);
        console.log(`Processing ${maxBatchSize} emails out of ${workerData.batch.length} (remaining daily limit: ${remainingEmails})`);
        for (let i = 0; i < maxBatchSize; i++) {
            const email = workerData.batch[i];
            try {
                await sendEmail(email);
                await new Promise(resolve => setTimeout(resolve, 300000));
            } catch (error) {
                console.error('Batch worker email processing error:', error);
            }
        }
        console.log('Batch processing completed');
        parentPort.postMessage({ done: true, processed: maxBatchSize, total: workerData.batch.length });
        process.exit(0);
    }).catch(err => {
        console.error('Batch worker MongoDB bağlantı hatası:', err);
        parentPort.postMessage({ error: err.message });
        process.exit(1);
    });
} else {
    console.error('No batch data provided to worker');
    process.exit(1);
} 