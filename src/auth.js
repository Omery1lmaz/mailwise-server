import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export function generateToken(admin) {
    return jwt.sign(
        { id: admin._id, email: admin.email, role: "admin" },
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
        console.log(decoded, "decoded test")
        if (decoded.role === 'admin') {
            req.admin = decoded;
        } else if (decoded.role === 'user') {
            req.user = decoded;
        }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Geçersiz token' });
    }
}

export function adminAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token gerekli' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
        if (decoded.name) return res.status(403).json({ error: 'Sadece admin erişebilir' });
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Geçersiz token' });
    }
}

export function userAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token gerekli' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
        if (!decoded.name) return res.status(403).json({ error: 'Sadece kullanıcı erişebilir' });
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Geçersiz token' });
    }
}