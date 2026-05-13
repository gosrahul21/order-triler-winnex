import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IConfig extends Document {
  pairs: string[];
  emaPeriod: number;
  dropThreshold: number;
  autoOrderEnabled: boolean;
  telegramEnabled: boolean;
  desktopNotificationsEnabled: boolean;
  orderPercentage: number;
  leverage: number;
  quoteCurrencies: string[]; // Changed to array to support multiple
  telegramChatId: string;
}

const ConfigSchema: Schema = new Schema({
  pairs: { type: [String], required: true, default: [] },
  emaPeriod: { type: Number, required: true, default: 15 },
  dropThreshold: { type: Number, required: true, default: 1 },
  autoOrderEnabled: { type: Boolean, required: true, default: false },
  telegramEnabled: { type: Boolean, required: true, default: true },
  desktopNotificationsEnabled: { type: Boolean, required: true, default: true },
  orderPercentage: { type: Number, required: true, default: 25 },
  leverage: { type: Number, required: true, default: 1.0 },
  quoteCurrencies: { type: [String], required: true, default: ['USDT'] },
  telegramChatId: { type: String, default: '' },
}, { timestamps: true });

const Config: Model<IConfig> = mongoose.models.Config || mongoose.model<IConfig>('Config', ConfigSchema);

export default Config;
