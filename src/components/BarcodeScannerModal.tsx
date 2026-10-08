'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from './ui/Modal';
import { isValidBarcode } from '@/lib/openFoodFacts';

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
  /** Optional addition used to expose a manual lookup after a camera/security failure. */
  onManualLookup?: (barcode: string) => void;
  onCameraUnavailable?: (message: string) => void;
}

const SCANNER_ELEMENT_ID = 'barcode-scanner-region';

type ScannerInstance = {
  start: (...args: any[]) => Promise<unknown>;
  stop: () => Promise<void>;
  clear: () => Promise<void>;
};

async function stopAndClear(scanner: ScannerInstance): Promise<void> {
  try {
    await scanner.stop();
  } catch {
    // A scanner can be stopped before start resolves; clear still releases its DOM/camera state when possible.
  }
  try {
    await scanner.clear();
  } catch {
    // Teardown must never make closing the modal fail.
  }
}

export default function BarcodeScannerModal({ open, onClose, onDetected, onManualLookup, onCameraUnavailable }: BarcodeScannerModalProps) {
  const scannerRef = useRef<ScannerInstance | null>(null);
  const detectedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    let scanner: ScannerInstance | null = null;
    detectedRef.current = false;
    setError(null);
    setManualError(null);

    const reportCameraIssue = (message: string) => {
      if (!active) return;
      setError(message);
      onCameraUnavailable?.(message);
    };

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      reportCameraIssue('Camera access requires HTTPS and a supported browser. Enter the barcode manually below.');
      return () => { active = false; };
    }

    void (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!active) return;
        scanner = new Html5Qrcode(SCANNER_ELEMENT_ID) as unknown as ScannerInstance;
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText: string) => {
            if (!active || detectedRef.current) return;
            detectedRef.current = true;
            onDetected(decodedText);
          },
          () => {
            // Per-frame scan misses are expected and intentionally silent.
          },
        );
        // If close/unmount happened while start was awaiting permission, stop again
        // after start resolves so no late camera stream survives the modal.
        if (!active) await stopAndClear(scanner);
      } catch {
        if (scanner && !active) await stopAndClear(scanner);
        else reportCameraIssue('Unable to access the camera. Check permissions, or enter the barcode manually below.');
      }
    })();

    return () => {
      active = false;
      const activeScanner = scannerRef.current ?? scanner;
      scannerRef.current = null;
      if (activeScanner) void stopAndClear(activeScanner);
    };
  }, [open, onCameraUnavailable, onDetected]);

  const handleManualLookup = (event: React.FormEvent) => {
    event.preventDefault();
    const barcode = manualBarcode.trim();
    if (!isValidBarcode(barcode)) {
      setManualError('Enter an 8–14 digit UPC or EAN barcode before looking it up.');
      return;
    }
    setManualError(null);
    onManualLookup?.(barcode);
  };

  return (
    <Modal open={open} onClose={onClose} title="Scan Barcode">
      <div className="space-y-3">
        <div id={SCANNER_ELEMENT_ID} className="overflow-hidden rounded-xl bg-black" />
        {error && <p role="alert" className="rounded-lg bg-accent-red/10 px-3 py-2 text-sm text-accent-red">{error}</p>}
        <p className="text-xs text-slate-400">Point your camera at a product barcode. Camera access is optional.</p>
        <form onSubmit={handleManualLookup} className="border-t border-surface-border pt-3" noValidate>
          <label htmlFor="manual-barcode" className="mb-1.5 block text-sm font-medium text-slate-200">Enter barcode manually</label>
          <div className="flex gap-2">
            <input
              id="manual-barcode"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              className="input min-w-0 flex-1"
              value={manualBarcode}
              onChange={(event) => { setManualBarcode(event.target.value.replace(/\D/g, '')); setManualError(null); }}
              placeholder="8–14 digits"
              aria-invalid={Boolean(manualError)}
              aria-describedby={manualError ? 'manual-barcode-error' : undefined}
            />
            <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent/90">Lookup</button>
          </div>
          {manualError && <p id="manual-barcode-error" role="alert" className="mt-1 text-xs text-accent-red">{manualError}</p>}
        </form>
      </div>
    </Modal>
  );
}
