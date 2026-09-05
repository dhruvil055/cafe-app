import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, X, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useCartStore from '../../context/cartStore';

const extractTableNumber = (value) => {
  try {
    const url = new URL(value);
    const table = url.searchParams.get('table');
    if (table) return table;
  } catch {
    // Allow a plain table number as a fallback.
  }

  const match = String(value || '').trim().match(/^\d+$/);
  return match ? match[0] : null;
};

export default function QrScannerModal({ onClose, onTableFound }) {
  const scannerRef = useRef(null);
  const [manualValue, setManualValue] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const { setTable, setDiningSession, closeScanner } = useCartStore();

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
      setError('Camera access is unavailable. Enter the table number below or grant camera permissions.');
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
      const currentToken = useCartStore.getState().diningSessionToken;
      const response = await api.post('/session', {
        tableNumber: Number(tableNumber),
        diningSessionToken: currentToken,
      });

      const num = Number(tableNumber);
      setTable(num);
      setDiningSession(response.data.diningSessionToken);
      toast.success(`Table ${String(num).padStart(2, '0')} connected! You can now order.`);

      if (onTableFound) {
        onTableFound(num);
      }
      handleClose();
    } catch (err) {
      setError('This table number is not active. Please scan a valid table QR code.');
    } finally {
      setChecking(false);
    }
  };

  const handleManualSubmit = (event) => {
    event.preventDefault();
    if (!manualValue.trim()) {
      setError('Please enter your table number.');
      return;
    }
    handleTableValue(manualValue);
  };

  const handleClose = () => {
    const activeScanner = scannerRef.current;
    if (activeScanner?.isScanning) {
      activeScanner.stop().catch(() => {});
    }
    closeScanner();
    if (onClose) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-espresso-950/75 p-4 backdrop-blur-md"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-[2rem] border border-foam bg-cream shadow-2xl text-espresso-900"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-foam bg-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brew-100 text-brew-700">
              <QrCode size={19} />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-espresso-950">Scan Table QR</h2>
              <p className="text-[11px] text-espresso-500">Required to add items & place orders</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close QR scanner"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-foam text-espresso-500 hover:bg-espresso-50 hover:text-espresso-900 transition"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-5 sm:p-6">
          <div id="qr-reader" className="overflow-hidden rounded-2xl bg-espresso-950 shadow-inner" />
          <p className="mt-3.5 text-center text-xs text-espresso-600">
            Point your camera at the QR code stand on your café table.
          </p>

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-center text-xs font-medium text-red-700">
              {error}
            </div>
          )}
          {checking && (
            <div className="mt-3 rounded-xl border border-brew-200 bg-brew-50 p-2.5 text-center text-xs font-medium text-brew-800">
              Validating table & starting dining session...
            </div>
          )}

          <div className="my-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-espresso-400">
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
              className="w-full rounded-xl border border-foam bg-white px-4 py-3 text-sm font-medium text-espresso-900 placeholder:text-espresso-400 focus:border-brew-500 focus:outline-none focus:ring-2 focus:ring-brew-200"
            />
            <button
              type="submit"
              disabled={checking}
              className="btn-primary whitespace-nowrap px-5 text-xs font-bold uppercase tracking-wider shadow-sm disabled:opacity-50"
            >
              Use Table
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
