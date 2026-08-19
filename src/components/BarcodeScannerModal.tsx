'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from './ui/Modal';

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

const SCANNER_ELEMENT_ID = 'barcode-scanner-region';

export default function BarcodeScannerModal({ open, onClose, onDetected }: BarcodeScannerModalProps) {
  // html5-qrcode's Html5Qrcode instance, typed loosely since it's dynamically imported
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Camera access requires a secure (HTTPS) connection. Please use HTTPS or localhost.');
      return;
    }

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText: string) => {
            onDetected(decodedText);
          },
          () => {
            // per-frame scan misses are expected and ignored
          },
        );
      } catch {
        if (!cancelled) setError('Unable to access camera. Check permissions and try again.');
      }
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
  }, [open, onDetected]);

  return (
    <Modal open={open} onClose={onClose} title="Scan Barcode">
      <div className="space-y-3">
        <div id={SCANNER_ELEMENT_ID} className="overflow-hidden rounded-xl bg-black" />
        {error && <p className="text-sm text-accent-red">{error}</p>}
        <p className="text-xs text-slate-400">Point your camera at a product barcode.</p>
      </div>
    </Modal>
  );
}
