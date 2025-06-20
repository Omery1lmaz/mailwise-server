import mongoose from 'mongoose';

const mailAccountSchema = new mongoose.Schema({
  user: { type: String, required: true },
  pass: { type: String, required: true },
  from: { type: String, required: true },
  dailyLimit: { type: Number, default: 100 },
  sentToday: { type: Number, default: 0 },
  lastSentDate: { type: Date, default: null },
  active: { type: Boolean, default: true },
  imapHost: { type: String },
  imapPort: { type: Number },
  imapSecure: { type: Boolean, default: true },
  imapUser: { type: String },
  imapPass: { type: String }
});

export default mongoose.model('MailAccount', mailAccountSchema); 