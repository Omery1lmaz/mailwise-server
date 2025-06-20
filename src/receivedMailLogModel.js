import mongoose from 'mongoose';

const receivedMailLogSchema = new mongoose.Schema({
  from: String,
  to: String,
  subject: String,
  body: String,
  date: Date,
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'MailAccount' },
  raw: Object,
  attachments: [Object]
});

export default mongoose.model('ReceivedMailLog', receivedMailLogSchema); 