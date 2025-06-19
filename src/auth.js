import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export function generateToken(admin) {
    return jwt.sign(
        { id: admin._id, email: admin.email },
        process.env.JWT_SECRET || 'supersecretkey',
        { expiresIn: '7d' }
    );
}

export function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}

export function comparePassword(password, hash) {
    return bcrypt.compareSync(password, hash);
}

export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token gerekli' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Geçersiz token' });
    }
} 