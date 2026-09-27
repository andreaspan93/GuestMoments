import QRCode from "qrcode";

export const QR_ERROR_CORRECTION = "H" as const;

export async function renderEventQr(url: string) {
  return QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: QR_ERROR_CORRECTION,
    margin: 2,
    width: 512,
  });
}
