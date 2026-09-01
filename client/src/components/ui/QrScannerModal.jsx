import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, X } from 'lucide-react';
import api from '../../services/api';

const extractTableNumber = (value) => {
  try {
    const url = new URL(value);
    const table = url.searchParams.get('table');
    if (table) return table;
  } catch {
    // Allow a plain table number as a fallback.
  }

  const match = value.trim().match(/^\d+$/);
  return match ? match[0] : null;
};

export default function QrScannerModal({ onClose, onTableFound }) {
  const scannerRef = useRef(null);
  const [manualValue, setManualValue] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      async (decodedText) => {
        await handleTableValue(decodedText);
      },
      () => {}
    ).catch(() => {
      setError('Camera access is unavailable. Enter the table number or allow camera access.');
    });

    return () => {
      const activeScanner = scannerRef.current;
      if (activeScanner?.isScanning) {
        activeScanner.stop().catch(() => {});
      }
    };
  }, []);

  const handleTableValue = async (value) => {
    const tableNumber = extractTableNumber(value);
    if (!tableNumber) {
      setError('That QR code is not a Brewhaus table code.');
      return;
    }

    setChecking(true);
    setError('');
    try {
      await api.get(`/tables/${tableNumber}/validate`);
      onTableFound(tableNumber);
    } catch {
      setError('This table number is not active. Please scan a valid table QR code.');
    } finally {
      setChecking(false);
    }
  };

  const handleManualSubmit = (event) => {
    event.preventDefault();
    handleTableValue(manualValue);
  };

  const handleClose = () => {
    const activeScanner = scannerRef.current;
    if (activeScanner?.isScanning) {
      activeScanner.stop().catch(() => {});
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-espresso-950/70 p-4 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-cream shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-foam px-5 py-4">
          <div className="flex items-center gap-2">
            <QrCode size={20} className="text-brew-600" />
            <h2 className="font-display text-xl font-bold text-espresso-900">Scan Table QR</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close QR scanner"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-foam text-espresso-500 hover:bg-white"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-5">
          <div id="qr-reader" className="overflow-hidden rounded-2xl bg-espresso-950" />
          <p className="mt-3 text-center text-sm text-espresso-500">
            Point your camera at the QR code on your table.
          </p>

          {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
          {checking && <p className="mt-3 text-center text-sm text-brew-600">Checking table...</p>}

          <div className="my-5 flex items-center gap-3 text-xs text-espresso-400">
            <span className="h-px flex-1 bg-foam" />
            OR ENTER TABLE NUMBER
            <span className="h-px flex-1 bg-foam" />
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              value={manualValue}
              onChange={event => setManualValue(event.target.value)}
              inputMode="numeric"
              placeholder="e.g. 3"
              aria-label="Table number"
              className="input-field"
            />
            <button type="submit" disabled={checking} className="btn-primary whitespace-nowrap px-4">
              Use Table
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
