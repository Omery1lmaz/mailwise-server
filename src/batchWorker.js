import mongoose from 'mongoose';
import EmailQueue from './emailQueueModel.js';
import MailLog from './mailLogModel.js';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import { parentPort, workerData } from 'worker_threads';

// ES modules için __dirname alternatifi
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Email gönderimi için transporter oluştur
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: "omer@omerfarukyilmaz.dev",
        pass: "jblloliwllagtkib"
    }
});

// createMailBody fonksiyonunu burada tanımla
function createMailBody(person) {
    return `Merhaba ${person['First Name'] || person.firstName || ''} ${person['Last Name'] || person.lastName || ''},\n\n${person['Company'] || person.company ? (person['Company'] || person.company) + ' şirketinizde' : ''} açık pozisyonlar için başvurmak istiyorum.\n\nPozisyon: ${person['Title'] || person.title || '-'}\nŞirket: ${person['Company'] || person.company || '-'}\nLinkedIn: ${person['Person Linkedin Url'] || person.linkedin || '-'}\n\nCV'm ekte yer almaktadır.\n\nİyi çalışmalar.\nÖmer Faruk Yılmaz`;
}

// Email gönderme fonksiyonu
async function sendEmail(emailData) {
    try {
        // String ObjectId'yi ObjectId'ye çevir
        const objectId = new mongoose.Types.ObjectId(emailData._id);

        // Email gönderme işlemi başladı
        await EmailQueue.findByIdAndUpdate(objectId, { isProcessing: true });

        // Email içeriğini oluştur
        const body = createMailBody(emailData.personData || emailData);

        const mailOptions = {
            from: `"Ömer Faruk Yılmaz" <omer@omerfarukyilmaz.dev>`,
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

        // Başarılı gönderim kaydı
        await EmailQueue.findByIdAndUpdate(objectId, {
            isSend: true,
            isProcessing: false,
            status: 'sent',
            sentAt: new Date()
        });

        // Log kaydı oluştur
        await MailLog.create({
            email: emailData.email,
            firstName: emailData.firstName,
            lastName: emailData.lastName,
            company: emailData.company,
            status: 'sent',
            sentAt: new Date()
        });

        console.log(`Email sent successfully to ${emailData.email}`);
        return true;
    } catch (error) {
        // Hata durumunda güncelle
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

    // MongoDB bağlantısı
    mongoose.connect("mongodb+srv://omer:cnZXReX0N7fiGIAQ@cluster0.a6nr3dw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0").then(async () => {
        console.log('Batch worker MongoDB bağlantısı başarılı');

        // Bugün gönderilen email sayısını kontrol et
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todaySentCount = await EmailQueue.countDocuments({
            isSend: true,
            sentAt: { $gte: today, $lt: tomorrow }
        });

        console.log(`Today's sent email count: ${todaySentCount}`);

        // Günlük limit kontrolü
        if (todaySentCount >= 100) {
            console.log('Daily email limit (100) reached. Cannot process batch.');
            parentPort.postMessage({ error: 'Daily email limit (100) reached' });
            process.exit(0);
        }

        // Kalan gönderilebilecek email sayısı
        const remainingEmails = 100 - todaySentCount;
        const maxBatchSize = Math.min(workerData.batch.length, remainingEmails);

        console.log(`Processing ${maxBatchSize} emails out of ${workerData.batch.length} (remaining daily limit: ${remainingEmails})`);

        // Sadece limit kadar email işle
        for (let i = 0; i < maxBatchSize; i++) {
            const email = workerData.batch[i];
            try {
                await sendEmail(email);
                // 5 dakika bekle
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