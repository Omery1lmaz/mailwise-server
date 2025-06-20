import mongoose from 'mongoose';

const mailLogSchema = new mongoose.Schema({
    email: String,
    from: String,
    firstName: String,
    lastName: String,
    company: String,
    status: String,
    attachments: [String],
    sentAt: { type: Date, default: Date.now },
    // Eski alanlar backward compatibility için
    to: String,
    subject: String,
    body: String
});

export default mongoose.model('MailLog', mailLogSchema); 