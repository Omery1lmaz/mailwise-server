import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import fs from 'fs'
import csv from 'csv-parser'
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import MailLog from './mailLogModel.js';
import adminRoutes from './adminRoutes.js';
import emailQueueRoutes from './emailQueueRoutes.js';
import EmailQueue from './emailQueueModel.js';
import userRoutes from './userRoutes.js';
import './cronWorker.js'; // Cron job'ı başlatmak için import
import { cron } from "./vercelCron.js"
const SELECTED_FIELDS = [
    'First Name',
    'Last Name',
    'Title',
    'Company',
    'Company Name for Emails',
    'Email',
    'Seniority',
    'Departments',
    'Work Direct Phone',
    'Mobile Phone',
    'Industry',
    'Person Linkedin Url',
    'Company Linkedin Url',
    'City',
    'State',
    'Country',
    'Company Address',
    'Company Phone',
    'Website',
    'Annual Revenue',
    'Total Funding',
    'Email Status',
    'Email Confidence',
    'Replied',
    'Email Open',
    'Email Bounced',
    'Secondary Email',
    'Tertiary Email',
    'Technologies'
];


dotenv.config();

// MongoDB bağlantısı
mongoose.connect("mongodb+srv://omer:cnZXReX0N7fiGIAQ@cluster0.a6nr3dw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0").then(() => {
    console.log('MongoDB bağlantısı başarılı');
}).catch(err => {
    console.error('MongoDB bağlantı hatası:', err);
});

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS support
app.use(morgan('combined')); // Logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Routes
const results = new Set(); // Aynı e-posta tekrar gelmesin diye

const csvFilePath = path.join(__dirname, 'apollo-contacts-export.csv');
console.log('CSV dosya yolu:', csvFilePath);
console.log('Çalışma dizini:', process.cwd());

// Nodemailer transporter
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: "omer@omerfarukyilmaz.dev",
        pass: "jblloliwllagtkib"
    }
});

const cvPath = path.join(__dirname, 'Omer_Faruk_Yilmaz_CV.pdf');

function extractSelectedData() {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(csvFilePath)
            .pipe(csv())
            .on('data', (row) => {
                const filtered = {};
                SELECTED_FIELDS.forEach((field) => {
                    filtered[field] = row[field] || null;
                });
                results.push(filtered);
            })
            .on('end', () => {
                resolve(results);
            })
            .on('error', (err) => {
                reject(err);
            });
    });
}

function createMailBody(person) {
    return `Merhaba ${person['First Name'] || ''} ${person['Last Name'] || ''},
  
  Yazılım geliştiricisi olarak ${person['Company'] ? person['Company'] + ' şirketinizde' : 'şirketinizde'} uygun bir pozisyonda görev almak ve ekibinize katkı sağlamak isterim.
  
  Ortaokul yıllarından bu yana yazılım alanında kendimi geliştiriyorum. React, React Native, Node.js gibi teknolojilerle projeler ürettim ve aktif olarak bir startup’ta frontend developer olarak görev aldım. Aynı zamanda başvuru ve iletişim süreçlerini kolaylaştırmak adına geliştirdiğim [Mailwise](https://omerfarukyilmaz.dev) adlı platform üzerinden bu e-postayı tarafınıza iletiyorum.
  
  Mailwise, teknik profillerin doğrudan doğru kişilere ulaşmasını ve başvuru sürecinin daha verimli ve etkili ilerlemesini hedeflemektedir.
  
  CV’m ekte yer almaktadır. Uygun görmeniz hâlinde sizinle daha detaylı bir görüşme gerçekleştirmekten memnuniyet duyarım.
  
  İyi çalışmalar dilerim.  
  Ömer Faruk Yılmaz  
  omer@omerfarukyilmaz.dev  
  https://omerfarukyilmaz.dev`;
}

async function sendMail(to, body, person) {
    const mailOptions = {
        from: `"Ömer Faruk Yılmaz" <omer@omerfarukyilmaz.dev>`,
        to,
        subject: 'İş Başvurusu: Yazılım Geliştirici',
        text: body,
        attachments: [
            {
                filename: 'Omer_Faruk_Yilmaz_CV.pdf',
                path: cvPath
            }
        ]
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Mail gönderildi: ${to}`);
        await MailLog.create({
            to,
            subject: mailOptions.subject,
            body,
            attachments: mailOptions.attachments.map(a => a.filename),
            sentAt: new Date(),
            personData: person
        });
    } catch (err) {
        console.error(`Mail gönderilemedi: ${to}`, err);
    }
}

// CSV'den kişileri oku ve mail gönder
async function processAndSendMails() {
    if (!fs.existsSync(csvFilePath)) {
        console.warn(`CSV dosyası bulunamadı: ${csvFilePath}`);
        return;
    }
    const people = await extractSelectedData();
    console.log('Toplam kişi:', people.length);
    for (const person of people) {
        const to = person['Email'];
        if (!to) continue;
        const body = createMailBody(person);
        await sendMail(to, body, person);
        await new Promise(resolve => setTimeout(resolve, 45000));
    }
}

async function processQueueAndSendMails() {
    const queue = await EmailQueue.find({ isSend: false });
    for (const item of queue) {
        const to = item.to;
        const person = item.personData;
        const body = createMailBody(person);
        await sendMail(to, body, person);
        await EmailQueue.updateOne({ _id: item._id }, { isSend: true });
        await new Promise(resolve => setTimeout(resolve, 45000));
    }
}

app.get('/', (req, res) => {
    res.json({
        message: 'Node.js Project Template API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

app.use('/cron', cron);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.use('/admin', adminRoutes);
app.use('/queue', emailQueueRoutes);
app.use('/user', userRoutes);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    // processAndSendMails(); // Otomatik başlatmak için yorumu kaldır
    // processQueueAndSendMails(); // Otomatik başlatmak için yorumu kaldır
});

export default app;
export { sendMail, createMailBody }; 