import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';
import { systemSettingsRepository } from '../repositories/system_settings.js';

export class PromptPayConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromptPayConfigError';
  }
}

export type PromptPayQrResult = {
  payload: string;
  data_url: string;
  receiver_id: string;
  receiver_name: string;
  amount_thb: number;
};

const sanitizePromptPayId = (raw: string): string => raw.replace(/[^0-9]/g, '');

export const getPromptPayConfig = (): {
  id: string;
  name: string;
  configured: boolean;
} => {
  const id = sanitizePromptPayId(systemSettingsRepository.getString('promptpay_id'));
  const name = systemSettingsRepository.getString('promptpay_receiver_name');
  return { id, name, configured: id.length > 0 };
};

export const generatePromptPayQr = async (
  amountSatang: number
): Promise<PromptPayQrResult> => {
  const cfg = getPromptPayConfig();
  if (!cfg.configured) {
    throw new PromptPayConfigError(
      'PromptPay receiver ID not configured. Set it in admin settings.'
    );
  }

  const amountThb = amountSatang / 100;
  if (!Number.isFinite(amountThb) || amountThb <= 0) {
    throw new PromptPayConfigError(`Invalid amount: ${amountSatang} satang`);
  }

  const payload = generatePayload(cfg.id, { amount: amountThb });
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 8,
  });

  return {
    payload,
    data_url: dataUrl,
    receiver_id: cfg.id,
    receiver_name: cfg.name,
    amount_thb: amountThb,
  };
};
