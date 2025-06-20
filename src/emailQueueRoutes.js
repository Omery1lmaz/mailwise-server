import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import EmailQueue from './emailQueueModel.js';
import { sendMail, createMailBody } from './index.js';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { adminAuthMiddleware } from './auth.js';
import { Parser as Json2csvParser } from 'json2csv';
import nodemailer from 'nodemailer';
import MailLog from './mailLogModel.js';
import stream from 'stream';

const router = express.Router();

// ES modules için __dirname alternatifi
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer'ı memoryStorage ile başlat (Vercel uyumlu)
const upload = multer({ storage: multer.memoryStorage() });

const SELECTED_FIELDS = [
    'First Name', 'Last Name', 'Title', 'Company', 'Company Name for Emails', 'Email',
    'Seniority', 'Departments', 'Work Direct Phone', 'Mobile Phone', 'Industry',
    'Person Linkedin Url', 'Company Linkedin Url', 'City', 'State', 'Country',
    'Company Address', 'Company Phone', 'Website', 'Annual Revenue', 'Total Funding',
    'Email Status', 'Email Confidence', 'Replied', 'Email Open', 'Email Bounced',
    'Secondary Email', 'Tertiary Email', 'Technologies'
];

router.post('/upload', adminAuthMiddleware, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Dosya yüklenemedi' });
    }
    const results = [];
    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    bufferStream
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
            res.json({ message: 'Yalnızca yeni emailler kuyruğa eklendi', count: queueDocs.length });
        })
        .on('error', (err) => {
            res.status(500).json({ error: 'CSV okuma hatası', details: err });
        });
});

router.post('/send-batch', adminAuthMiddleware, async (req, res) => {
    try {
        await EmailQueue.updateMany({}, { isSend: false, isProcessing: false }).limit(80);
        const batch = await EmailQueue.find({ isSend: false, isProcessing: false }).limit(80);
        const ids = batch.map(item => item._id);
        await EmailQueue.updateMany({ _id: { $in: ids } }, { isProcessing: true });

        // ObjectId'leri string'e çevir
        const serializedBatch = batch.map(item => {
            const obj = item.toObject();
            obj._id = obj._id.toString();
            return obj;
        });

        // Worker thread başlat
        const worker = new Worker(path.join(__dirname, 'batchWorker.js'), {
            workerData: { batch: serializedBatch }
        });

        worker.on('message', (msg) => {
            if (msg.done) {
                console.log(`Batch mail gönderimi tamamlandı. İşlenen: ${msg.processed}/${msg.total}`);
            } else if (msg.error) {
                console.error('Worker error:', msg.error);
            }
        });

        worker.on('error', (err) => {
            console.error('Worker error:', err);
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`Worker stopped with exit code ${code}`);
            }
        });

        res.json({ 
            message: 'Batch mail gönderimi worker ile başlatıldı', 
            count: batch.length,
            status: 'processing'
        });
    } catch (error) {
        console.error('Batch processing error:', error);
        res.status(500).json({ error: 'Batch işleme hatası', details: error.message });
    }
});

// Tekil e-posta gönder
router.post('/send/:id', adminAuthMiddleware, async (req, res) => {
    try {
        const email = await EmailQueue.findById(req.params.id);
        if (!email) return res.status(404).json({ error: 'Email bulunamadı' });
        if (email.isSend) return res.status(400).json({ error: 'Zaten gönderilmiş' });
        const body = createMailBody(email.personData || email);
        await sendMail(email.to, body, email.personData || email);
        email.isSend = true;
        await email.save();
        res.json({ message: 'E-posta başarıyla gönderildi' });
    } catch (err) {
        res.status(500).json({ error: 'Tekil gönderim hatası', details: err.message });
    }
});

// Kuyruktan sil
router.delete('/:id', adminAuthMiddleware, async (req, res) => {
    try {
        const email = await EmailQueue.findByIdAndDelete(req.params.id);
        if (!email) return res.status(404).json({ error: 'Email bulunamadı' });
        res.json({ message: 'Kuyruktan silindi' });
    } catch (err) {
        res.status(500).json({ error: 'Silme hatası', details: err.message });
    }
});

// Kuyruğu CSV olarak dışa aktar
router.get('/export', adminAuthMiddleware, async (req, res) => {
    try {
        const emails = await EmailQueue.find();
        const fields = Object.keys(EmailQueue.schema.paths).filter(f => f !== '__v' && f !== '_id');
        const parser = new Json2csvParser({ fields });
        const csv = parser.parse(emails.map(e => e.toObject()));
        res.header('Content-Type', 'text/csv');
        res.attachment('queue_export.csv');
        return res.send(csv);
    } catch (err) {
        res.status(500).json({ error: 'Export hatası', details: err.message });
    }
});

export default router; 