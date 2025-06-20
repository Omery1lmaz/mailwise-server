import mongoose from 'mongoose';
import EmailQueue from './emailQueueModel.js';
import { createMailBody } from './index.js';
import dotenv from 'dotenv';
import cron from 'node-cron';
import MailLog from './mailLogModel.js';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import { parentPort, workerData } from 'worker_threads';
import MailAccount from './mailAccountModel.js';

dotenv.config();

// ES modules için __dirname alternatifi
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

// Email gönderme fonksiyonu
async function sendEmail(emailData) {
    try {
        // Email gönderme işlemi başladı
        await EmailQueue.findByIdAndUpdate(emailData._id, { isProcessing: true });

        // Email içeriğini oluştur
        const body = createMailBody(emailData.personData || emailData);

        const account = await getRandomAvailableAccount();
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user: account.user, pass: account.pass }
        });

        const mailOptions = {
            from: account.from,
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

        // Email'i gönder
        await transporter.sendMail(mailOptions);

        // Hesabın gönderim sayısını artır
        account.sentToday += 1;
        account.lastSentDate = new Date();
        await account.save();

        // Başarılı gönderim kaydı
        await EmailQueue.findByIdAndUpdate(emailData._id, {
            isSend: true,
            isProcessing: false,
            status: 'sent',
            sentAt: new Date()
        });

        // Log kaydı oluştur
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
        // Hata durumunda güncelle
        await EmailQueue.findByIdAndUpdate(emailData._id, {
            isProcessing: false,
            status: 'error',
            errorMessage: error.message
        });

        console.error(`Failed to send email to ${emailData.email}:`, error);
        return false;
    }
}

// Worker thread için batch processing
if (workerData && workerData.batch) {
    console.log(workerData, "worker data var")
    // MongoDB bağlantısı
    mongoose.connect("mongodb+srv://omer:cnZXReX0N7fiGIAQ@cluster0.a6nr3dw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0").then(async () => {
        console.log('Worker MongoDB bağlantısı başarılı');

        for (const email of workerData.batch) {
            try {
                await sendEmail(email);
                // 5 dakika bekle
                await new Promise(resolve => setTimeout(resolve, 3000));
            } catch (error) {
                console.error('Worker email processing error:', error);
            }
        }

        parentPort.postMessage({ done: true });
        process.exit(0);
    }).catch(err => {
        console.error('Worker MongoDB bağlantı hatası:', err);
        parentPort.postMessage({ error: err.message });
        process.exit(1);
    });
} else {
    // Cron job için normal çalışma - sadece cron job'ı başlat, server başlatma
    // Her dakika çalışacak cron job
    cron.schedule('0 * * * *', async () => {
        console.log('Starting minute email processing...');
        try {
            // İşlenmemiş emailleri bul
            const pendingEmails = await EmailQueue.find({
                isSend: false,
                isProcessing: false,
                status: { $ne: 'error' }
            }).limit(50); // Her seferde en fazla 50 email işle

            console.log(`Found ${pendingEmails.length} pending emails to process`);

            // Her email için gönderim işlemini başlat
            for (const email of pendingEmails) {
                await sendEmail(email);
                // Rate limiting için 5 dakika bekle
                await new Promise(resolve => setTimeout(resolve, 300000));
            }

            console.log('Minute email processing completed');
        } catch (error) {
            console.error('Error in cron job:', error);
        }
    });

    // Worker başlatıldığında log
    console.log('Email worker started and cron job scheduled for minute execution');
}

// Manuel email gönderimi için export
export const processEmail = async (emailId) => {
    try {
        const email = await EmailQueue.findById(emailId);
        if (!email) {
            throw new Error('Email not found');
        }
        return await sendEmail(email);
    } catch (error) {
        console.error('Error processing email:', error);
        return false;
    }
}; 