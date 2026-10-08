import { useState, useEffect } from 'react';
import {
  Star, MessageSquare, Reply, ThumbsUp, Filter, Loader2,
  CheckCircle2, EyeOff, Flag, Clock, Search, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ overall: 5, food: 5, service: 5, ambience: 5, totalReviews: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedRating, setSelectedRating] = useState('ALL');

  // Replying state
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedRating !== 'ALL') params.set('minRating', selectedRating);
      const { data } = await api.get(`/reviews?${params.toString()}`);
      setReviews(data.reviews || []);
      if (data.stats) setStats(data.stats);
    } catch (error) {
      toast.error(error.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [selectedRating]);

  const handleSendReply = async (reviewId) => {
    if (!replyText.trim()) {
      toast.error('Reply text cannot be empty');
      return;
    }

    setSubmittingReply(true);
    try {
      await api.post(`/reviews/${reviewId}/reply`, { text: replyText.trim() });
      toast.success('Reply submitted to customer');
      setReplyingToId(null);
      setReplyText('');
      fetchReviews();
    } catch (error) {
      toast.error(error.message || 'Failed to submit reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleModerateStatus = async (reviewId, newStatus) => {
    try {
      await api.patch(`/reviews/${reviewId}/status`, { status: newStatus });
      toast.success(`Review visibility updated to ${newStatus}`);
      fetchReviews();
    } catch (error) {
      toast.error(error.message || 'Failed to update review status');
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            size={13}
            className={star <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-stone-300'}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 3-Factor Overall Rating KPI Banner */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
        {/* Big Overall Star Badge */}
        <div className="flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-stone-100 pb-4 md:pb-0 md:pr-4">
          <div className="font-display font-extrabold text-5xl text-espresso-950">
            {stats.overall}
          </div>
          <div className="flex items-center gap-1 mt-1 text-amber-400">
            {[1, 2, 3, 4, 5].map(star => (
              <Star key={star} size={18} className="fill-amber-400" />
            ))}
          </div>
          <div className="text-xs text-stone-400 font-medium mt-1">
            Based on {stats.totalReviews} verified reviews
          </div>
        </div>

        {/* 3-Factor Sub-scores */}
        <div className="md:col-span-3 grid grid-cols-3 gap-4">
          <div className="bg-stone-50/80 border border-stone-200/60 rounded-2xl p-4 text-center">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Food & Taste</span>
            <div className="font-display font-bold text-2xl text-espresso-900 mt-1">
              {stats.food} <span className="text-xs text-stone-400 font-normal">/ 5.0</span>
            </div>
            <div className="mt-1 flex justify-center">{renderStars(stats.food)}</div>
          </div>

          <div className="bg-stone-50/80 border border-stone-200/60 rounded-2xl p-4 text-center">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Service Speed</span>
            <div className="font-display font-bold text-2xl text-espresso-900 mt-1">
              {stats.service} <span className="text-xs text-stone-400 font-normal">/ 5.0</span>
            </div>
            <div className="mt-1 flex justify-center">{renderStars(stats.service)}</div>
          </div>

          <div className="bg-stone-50/80 border border-stone-200/60 rounded-2xl p-4 text-center">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Ambience & Cleanliness</span>
            <div className="font-display font-bold text-2xl text-espresso-900 mt-1">
              {stats.ambience} <span className="text-xs text-stone-400 font-normal">/ 5.0</span>
            </div>
            <div className="mt-1 flex justify-center">{renderStars(stats.ambience)}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">Filter Stars:</span>
          {['ALL', '5', '4', '3', '2', '1'].map(r => (
            <button
              key={r}
              onClick={() => setSelectedRating(r)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                selectedRating === r
                  ? 'bg-espresso-900 text-white shadow-sm'
                  : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200/60'
              }`}
            >
              {r === 'ALL' ? 'All Reviews' : `${r}★ & above`}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List Cards */}
      {loading ? (
        <div className="flex min-h-[250px] items-center justify-center text-stone-400">
          <Loader2 className="animate-spin text-brew-500" size={30} />
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-white py-20 text-center text-stone-500">
          <MessageSquare size={44} className="mx-auto text-stone-300 mb-3" />
          <p className="text-base font-semibold text-stone-700">No reviews found matching this filter</p>
          <p className="text-xs text-stone-400 mt-1">Customer feedback submitted from the QR bill will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(rev => (
            <div
              key={rev._id}
              className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-soft space-y-3.5 hover:shadow-md transition"
            >
              {/* Header: Customer, Order, Overall Star */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-stone-900 text-sm">
                      {rev.customerName || 'Café Guest'}
                    </span>
                    {rev.orderNumber && (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-stone-100 text-stone-700 border border-stone-200">
                        {rev.orderNumber}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-400 mt-0.5">
                    {new Date(rev.createdAt).toLocaleDateString()} at {new Date(rev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl">
                    <Star size={13} className="text-amber-500 fill-amber-500" />
                    <span className="text-xs font-bold text-amber-900">{rev.overallRating || 5}</span>
                  </div>
                  {rev.status !== 'published' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-500 uppercase">
                      {rev.status}
                    </span>
                  )}
                </div>
              </div>

              {/* 3-Factor Mini Pill Breakdown */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-600">
                <span className="px-2 py-0.5 bg-stone-50 rounded-lg border border-stone-200/80">
                  Food: <strong>{rev.foodRating}★</strong>
                </span>
                <span className="px-2 py-0.5 bg-stone-50 rounded-lg border border-stone-200/80">
                  Service: <strong>{rev.serviceRating}★</strong>
                </span>
                <span className="px-2 py-0.5 bg-stone-50 rounded-lg border border-stone-200/80">
                  Ambience: <strong>{rev.ambienceRating}★</strong>
                </span>
              </div>

              {/* Comment */}
              {rev.comment && (
                <p className="text-xs text-stone-800 leading-relaxed font-normal bg-stone-50/50 p-3 rounded-xl border border-stone-100">
                  "{rev.comment}"
                </p>
              )}

              {/* Management Reply Display */}
              {rev.reply?.text && (
                <div className="bg-brew-50/40 border border-brew-200/60 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-brew-800 font-bold">
                    <span>Café Management Response:</span>
                    <span className="text-stone-400 font-normal">
                      {new Date(rev.reply.repliedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-stone-700 italic">"{rev.reply.text}"</p>
                </div>
              )}

              {/* Reply Form */}
              {replyingToId === rev._id ? (
                <div className="pt-2 space-y-2">
                  <textarea
                    rows={2}
                    placeholder="Type polite, appreciative management response..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 p-2.5 text-xs text-stone-800 focus:outline-none focus:border-brew-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setReplyingToId(null)}
                      className="btn-secondary rounded-xl px-3 py-1 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSendReply(rev._id)}
                      disabled={submittingReply}
                      className="btn-primary rounded-xl px-3.5 py-1 text-xs font-semibold flex items-center gap-1"
                    >
                      {submittingReply && <Loader2 size={12} className="animate-spin" />}
                      <span>Publish Reply</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-1 flex items-center justify-between text-xs border-t border-stone-100">
                  <button
                    onClick={() => {
                      setReplyingToId(rev._id);
                      setReplyText(rev.reply?.text || '');
                    }}
                    className="text-brew-700 hover:text-brew-900 font-semibold flex items-center gap-1 text-[11px]"
                  >
                    <Reply size={12} /> {rev.reply?.text ? 'Edit Management Reply' : 'Reply to Guest'}
                  </button>

                  <div className="flex items-center gap-2 text-stone-400 text-[11px]">
                    <button
                      onClick={() => handleModerateStatus(rev._id, rev.status === 'hidden' ? 'published' : 'hidden')}
                      className="hover:text-stone-700"
                    >
                      {rev.status === 'hidden' ? 'Publish' : 'Hide'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
