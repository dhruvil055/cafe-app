import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, X, AlertTriangle } from 'lucide-react';
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
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  // Pending-confirm state for different-table detection
  const [pendingTable, setPendingTable] = useState(null);
  const { setTable, tableNumber, items, clearCart } = useCartStore();

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
      setError('Camera access is unavailable. Please grant camera permissions and try again.');
    });

    return () => {
      const activeScanner = scannerRef.current;
      if (activeScanner?.isScanning) {
        activeScanner.stop().catch(() => {});
      }
    };
  }, []);

  const handleTableValue = async (value) => {
    const tableNum = extractTableNumber(value);
    if (!tableNum) {
      setError('That QR code is not a Brewhaus table code.');
      return;
    }
    const num = Number(tableNum);

    // If customer already has items for a different table, ask for confirmation
    if (tableNumber && tableNumber !== num && items.length > 0) {
      setPendingTable(num);
      return;
    }

    await connectToTable(num);
  };

  const connectToTable = async (num) => {
    setChecking(true);
    setError('');
    try {
      await api.get(`/tables/${num}/validate`);

      setTable(num);
      toast.success(`Table ${String(num).padStart(2, '0')} connected!`, {
        icon: '✅',
        duration: 4000,
      });

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

  const handleConfirmNewTable = async () => {
    if (!pendingTable) return;
    clearCart();
    setPendingTable(null);
    await connectToTable(pendingTable);
  };

  const handleCancelNewTable = () => {
    setPendingTable(null);
    setError('');
  };

  const handleClose = () => {
    const activeScanner = scannerRef.current;
    if (activeScanner?.isScanning) {
      activeScanner.stop().catch(() => {});
    }
    if (typeof onClose === 'function') {
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
          {/* Different-table confirmation dialog */}
          {pendingTable && (
            <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900 text-sm">Switch to Table {String(pendingTable).padStart(2, '0')}?</p>
                  <p className="text-xs text-amber-700 mt-1">
                    You have {items.length} item{items.length !== 1 ? 's' : ''} in your cart for Table {String(tableNumber).padStart(2, '0')}.
                    Switching tables will <strong>clear your current cart</strong>.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={handleCancelNewTable}
                      className="flex-1 rounded-xl border border-amber-300 bg-white py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmNewTable}
                      disabled={checking}
                      className="flex-1 rounded-xl bg-amber-600 py-2 text-xs font-bold text-white hover:bg-amber-700 transition disabled:opacity-50"
                    >
                      Switch to Table {String(pendingTable).padStart(2, '0')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!pendingTable && (
            <>
              <div id="qr-reader" className="overflow-hidden rounded-2xl bg-espresso-950 shadow-inner" />
              <p className="mt-3.5 text-center text-xs text-espresso-600">
                Point your camera at the QR code stand on your cafe table.
              </p>
            </>
          )}

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
        </div>
      </div>
    </div>
  );
}
