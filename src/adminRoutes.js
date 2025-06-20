import express from 'express';
import Admin from './adminModel.js';
import { generateToken, hashPassword, comparePassword, authMiddleware } from './auth.js';
import EmailQueue from './emailQueueModel.js';
import MailLog from './mailLogModel.js';
import jwt from 'jsonwebtoken';
import MailAccount from './mailAccountModel.js';
import { fetchAllInboxes } from './mailListener.js';
import ReceivedMailLog from './receivedMailLogModel.js';

const router = express.Router();

// Masking function for sensitive data
const maskSensitive = (emails) => {
    return emails.map(email => {
        const emailObj = email.toObject();
        const response = {
            ...emailObj,
            email: emailObj.email ? emailObj.email.replace(/(?<=.{3}).*(?=@)/g, '*****').replace(/@(.{2})(.+)/, '@$1****') : '',
            firstName: emailObj.firstName ? emailObj.firstName.replace(/(?<=.).(?=.*$)/g, '*') : '',
            lastName: emailObj.lastName ? emailObj.lastName.replace(/(?<=.).(?=.*$)/g, '*') : '',
            company: emailObj.company ? emailObj.company.replace(/(?<=.{2}).(?=.*$)/g, '*') : '',
            to: emailObj.to ? emailObj.to.replace(/(?<=.{3}).*(?=@)/g, '*****').replace(/@(.{2})(.+)/, '@$1****') : '',
        }
        console.log(response)
        return response
    });
};

// Admin kayıt (ilk defa veya manuel ekleme için)
router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email ve şifre gerekli' });

    const exists = await Admin.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Bu email zaten kayıtlı' });

    const admin = await Admin.create({ email, password: hashPassword(password) });
    res.json({ message: 'Admin oluşturuldu', admin: { email: admin.email } });
});

// Admin login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin || !comparePassword(password, admin.password)) {
        return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }
    const token = generateToken(admin);
    res.json({ token });
});

// Korumalı örnek endpoint
router.get('/me', authMiddleware, async (req, res) => {
    const admin = await Admin.findById(req.admin.id).select('-password');
    res.json({ admin });
});

// GET /admin/queue-emails - Tüm queue'daki emailler (sayfalandırmalı)
router.get('/queue-emails', authMiddleware, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const total = await EmailQueue.countDocuments();
    let emails = await EmailQueue.find().skip(skip).limit(limit).sort({ createdAt: -1 });
    console.log(req.admin, "req admin")
    if (!req.admin || req.admin.role !== 'admin') emails = maskSensitive(emails);
    res.json({ total, page, limit, emails });
});

// GET /admin/processing-emails - isProcessing:true olanlar (sayfalandırmalı)
router.get('/processing-emails', authMiddleware, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const total = await EmailQueue.countDocuments({ isProcessing: true });
    let emails = await EmailQueue.find({ isProcessing: true }).skip(skip).limit(limit).sort({ createdAt: -1 });
    if (!req.admin || req.admin.role !== 'admin') emails = maskSensitive(emails);
    res.json({ total, page, limit, emails });
});

// GET /admin/not-sended-emails - isSend:false olanlar (sayfalandırmalı)
router.get('/not-sended-emails', authMiddleware, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const total = await EmailQueue.countDocuments({ isSend: false });
    let emails = await EmailQueue.find({ isSend: false }).skip(skip).limit(limit).sort({ createdAt: -1 });
    if (!req.admin || req.admin.role !== 'admin') emails = maskSensitive(emails);
    res.json({ total, page, limit, emails });
});

// GET /admin/email-stats-by-date - Son 7 gün için günlük email istatistikleri
router.get('/email-stats-by-date', authMiddleware, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const stats = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

            const sent = await EmailQueue.countDocuments({
                isSend: true,
                createdAt: { $gte: startOfDay, $lt: endOfDay }
            });

            const notSent = await EmailQueue.countDocuments({
                isSend: false,
                createdAt: { $gte: startOfDay, $lt: endOfDay }
            });

            stats.push({
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                sent,
                notSent
            });
        }

        res.json({ stats });
    } catch (error) {
        res.status(500).json({ error: 'İstatistik hesaplama hatası', details: error.message });
    }
});

// GET /admin/email-stats-by-country - Ülkeye göre email dağılımı
router.get('/email-stats-by-country', authMiddleware, async (req, res) => {
    try {
        const stats = await EmailQueue.aggregate([
            {
                $group: {
                    _id: '$country',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: 10 // En çok email'e sahip 10 ülke
            },
            {
                $project: {
                    name: '$_id',
                    value: '$count',
                    _id: 0
                }
            }
        ]);

        // "Other" kategorisi için kalan ülkeleri topla
        const topCountries = stats.map(s => s.name);
        const otherCount = await EmailQueue.countDocuments({
            country: { $nin: topCountries }
        });

        if (otherCount > 0) {
            stats.push({ name: 'Other', value: otherCount });
        }

        res.json({ stats });
    } catch (error) {
        res.status(500).json({ error: 'Ülke istatistiği hesaplama hatası', details: error.message });
    }
});

// GET /admin/recent-emails - Son 5 gönderilen email
router.get('/recent-emails', authMiddleware, async (req, res) => {
    try {
        const emails = await MailLog.find().sort({ sentAt: -1 }).limit(5);
        console.log(emails, typeof emails, "test deneme emails")
        // Mask data if user is not admin
        const maskedEmails = !req.admin || req.admin.role !== 'admin' ? maskSensitive(emails) : emails;

        res.json({ emails: maskedEmails });
    } catch (error) {
        console.log(error, "error test")
        res.status(500).json({ error: 'Son email listesi alınamadı', details: error.message });
    }
});

// GET /admin/top-companies - En çok mail gönderilen 5 şirket
router.get('/top-companies', authMiddleware, async (req, res) => {
    try {
        const companies = await EmailQueue.aggregate([
            { $match: { isSend: true, company: { $ne: null, $ne: '' } } },
            { $group: { _id: '$company', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            { $project: { name: '$_id', value: '$count', _id: 0 } }
        ]);

        // Mask company names if user is not admin
        const maskedCompanies = !req.admin || req.admin.role !== 'admin'
            ? companies.map(company => ({
                ...company,
                name: company.name.replace(/(?<=.{2}).(?=.*$)/g, '*')
            }))
            : companies;

        res.json({ companies: maskedCompanies });
    } catch (error) {
        console.log(error, "error test")
        res.status(500).json({ error: 'Şirket istatistiği alınamadı', details: error.message });
    }
});

// List all mail accounts
router.get('/mail-accounts', authMiddleware, async (req, res) => {
    try {
        const accounts = await MailAccount.find();
        res.json({ accounts });
    } catch (error) {
        res.status(500).json({ error: 'Mail hesapları listelenemedi', details: error.message });
    }
});

// Add a new mail account
router.post('/mail-accounts', authMiddleware, async (req, res) => {
    try {
        const { user, pass, from, dailyLimit, active } = req.body;
        const account = await MailAccount.create({ user, pass, from, dailyLimit, active });
        res.json({ account });
    } catch (error) {
        res.status(500).json({ error: 'Mail hesabı eklenemedi', details: error.message });
    }
});

// Update a mail account
router.put('/mail-accounts/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const update = req.body;
        const account = await MailAccount.findByIdAndUpdate(id, update, { new: true });
        res.json({ account });
    } catch (error) {
        res.status(500).json({ error: 'Mail hesabı güncellenemedi', details: error.message });
    }
});

// Delete a mail account
router.delete('/mail-accounts/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        await MailAccount.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Mail hesabı silinemedi', details: error.message });
    }
});

// Gelen kutusunu tetikleyen endpoint
router.post('/fetch-inbox', authMiddleware, async (req, res) => {
    try {
        await fetchAllInboxes();
        res.status(200).json({ message: 'Tüm hesapların gelen kutuları kontrol edildi.' })
    } catch (error) {
        res.status(500).json({ error: 'Gelen kutusu kontrol hatası', details: error.message });
    }
});

// Gelen mailleri listeleyen endpoint (pagination destekli)
router.get('/inbox', authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const total = await ReceivedMailLog.countDocuments();
        const mails = await ReceivedMailLog.find()
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit)
            .populate('account', 'user from');
        res.json({ total, page, limit, mails });
    } catch (error) {
        res.status(500).json({ error: 'Gelen mailler listelenemedi', details: error.message });
    }
});

export default router; 