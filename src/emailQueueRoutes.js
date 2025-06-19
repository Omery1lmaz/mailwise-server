import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import EmailQueue from './emailQueueModel.js';
import { sendMail, createMailBody } from './index.js';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const SELECTED_FIELDS = [
    'First Name', 'Last Name', 'Title', 'Company', 'Company Name for Emails', 'Email',
    'Seniority', 'Departments', 'Work Direct Phone', 'Mobile Phone', 'Industry',
    'Person Linkedin Url', 'Company Linkedin Url', 'City', 'State', 'Country',
    'Company Address', 'Company Phone', 'Website', 'Annual Revenue', 'Total Funding',
    'Email Status', 'Email Confidence', 'Replied', 'Email Open', 'Email Bounced',
    'Secondary Email', 'Tertiary Email', 'Technologies'
];

router.post('/upload', upload.single('file'), async (req, res) => {
    const filePath = req.file.path;
    const results = [];

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            const filtered = {};
            SELECTED_FIELDS.forEach((field) => {
                filtered[field] = row[field] || null;
            });
            results.push(filtered);
        })
        .on('end', async () => {
            // Sadece yeni emailleri ekle
            const emails = results.map(r => r.Email).filter(Boolean);
            const existingDocs = await EmailQueue.find({ to: { $in: emails } }, { to: 1 });
            const existingEmails = new Set(existingDocs.map(doc => doc.to));

            const queueDocs = results
                .filter(r => r.Email && !existingEmails.has(r.Email))
                .map(r => ({
                    to: r.Email,
                    firstName: r['First Name'],
                    lastName: r['Last Name'],
                    title: r['Title'],
                    company: r['Company'],
                    companyNameForEmails: r['Company Name for Emails'],
                    email: r['Email'],
                    seniority: r['Seniority'],
                    departments: r['Departments'],
                    workDirectPhone: r['Work Direct Phone'],
                    mobilePhone: r['Mobile Phone'],
                    industry: r['Industry'],
                    personLinkedinUrl: r['Person Linkedin Url'],
                    companyLinkedinUrl: r['Company Linkedin Url'],
                    city: r['City'],
                    state: r['State'],
                    country: r['Country'],
                    companyAddress: r['Company Address'],
                    companyPhone: r['Company Phone'],
                    website: r['Website'],
                    annualRevenue: r['Annual Revenue'],
                    totalFunding: r['Total Funding'],
                    emailStatus: r['Email Status'],
                    emailConfidence: r['Email Confidence'],
                    replied: r['Replied'],
                    emailOpen: r['Email Open'],
                    emailBounced: r['Email Bounced'],
                    secondaryEmail: r['Secondary Email'],
                    tertiaryEmail: r['Tertiary Email'],
                    technologies: r['Technologies'],
                    personData: r,
                    isSend: false
                }));

            await EmailQueue.insertMany(queueDocs);
            fs.unlinkSync(filePath);
            res.json({ message: 'Yalnızca yeni emailler kuyruğa eklendi', count: queueDocs.length });
        })
        .on('error', (err) => {
            res.status(500).json({ error: 'CSV okuma hatası', details: err });
        });
});

router.post('/send-batch', async (req, res) => {
    const batch = await EmailQueue.find({ isSend: false, isProcessing: false }).limit(80);
    const ids = batch.map(item => item._id);
    await EmailQueue.updateMany({ _id: { $in: ids } }, { isProcessing: true });

    // Worker başlat
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const worker = new Worker(path.join(__dirname, 'emailWorker.js'), {
        workerData: { batch: batch.map(item => item.toObject()) }
    });
    worker.on('message', (msg) => {
        if (msg.done) {
            console.log('Batch mail gönderimi tamamlandı.');
        }
    });
    worker.on('error', (err) => {
        console.error('Worker error:', err);
    });

    res.json({ message: '80 email gönderimi worker ile başlatıldı', count: batch.length });
});

export default router; 