import mongoose from 'mongoose';

const mailLogSchema = new mongoose.Schema({
    to: String,
    subject: String,
    body: String,
    attachments: [String],
    sentAt: { type: Date, default: Date.now }
});

export default mongoose.model('MailLog', mailLogSchema); 