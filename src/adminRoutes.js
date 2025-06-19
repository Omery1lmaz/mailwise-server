import express from 'express';
import Admin from './adminModel.js';
import { generateToken, hashPassword, comparePassword, authMiddleware } from './auth.js';
import EmailQueue from './emailQueueModel.js';

const router = express.Router();

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
    const emails = await EmailQueue.find().skip(skip).limit(limit).sort({ createdAt: -1 });
    res.json({ total, page, limit, emails });
});

// GET /admin/processing-emails - isProcessing:true olanlar (sayfalandırmalı)
router.get('/processing-emails', authMiddleware, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const total = await EmailQueue.countDocuments({ isProcessing: true });
    const emails = await EmailQueue.find({ isProcessing: true }).skip(skip).limit(limit).sort({ createdAt: -1 });
    res.json({ total, page, limit, emails });
});

// GET /admin/not-sended-emails - isSend:false olanlar (sayfalandırmalı)
router.get('/not-sended-emails', authMiddleware, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const total = await EmailQueue.countDocuments({ isSend: false });
    const emails = await EmailQueue.find({ isSend: false }).skip(skip).limit(limit).sort({ createdAt: -1 });
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

export default router; 