import express from 'express';
import User from './userModel.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Tüm alanlar zorunlu.' });
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ error: 'Bu email zaten kayıtlı.' });
  const hashed = bcrypt.hashSync(password, 10);
  const user = await User.create({ email, password: hashed, name });
  res.json({ message: 'Kullanıcı oluşturuldu', user: { email: user.email, name: user.name } });
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Geçersiz email veya şifre' });
  }
  const token = jwt.sign(
    { id: user._id, email: user.email, name: user.name, role: 'user' },
    process.env.JWT_SECRET || 'supersecretkey',
    { expiresIn: '7d' }
  );
  res.json({ token, user: { email: user.email, name: user.name } });
});

export default router; 