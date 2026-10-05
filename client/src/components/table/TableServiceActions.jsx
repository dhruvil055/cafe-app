import { useState } from 'react';
import { BellRing, FileText, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useCartStore from '../../context/cartStore';

export default function TableServiceActions() {
  const diningSessionToken = useCartStore((state) => state.diningSessionToken);
  const [requesting, setRequesting] = useState('');

  const requestService = async (type) => {
    if (!diningSessionToken || requesting) return;
    setRequesting(type);
    try {
      const { data } = await api.post('/session/request', { diningSessionToken, type });
      toast.success(data.alreadyOpen
        ? (type === 'waiter' ? 'A waiter is already on the way.' : 'Your bill has already been requested.')
        : (type === 'waiter' ? 'A waiter has been notified.' : 'The bill has been requested.'));
    } catch (error) {
      toast.error(error.message || 'Unable to send your request.');
    } finally {
      setRequesting('');
    }
  };

  if (!diningSessionToken) return null;

  return (
    <div className="mx-auto flex max-w-2xl gap-2 px-4 py-3 sm:px-6">
      <button type="button" onClick={() => requestService('waiter')} disabled={Boolean(requesting)} className="btn-secondary flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm">
        {requesting === 'waiter' ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />}
        Call waiter
      </button>
      <button type="button" onClick={() => requestService('bill')} disabled={Boolean(requesting)} className="btn-primary flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm">
        {requesting === 'bill' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
        Request bill
      </button>
    </div>
  );
}
