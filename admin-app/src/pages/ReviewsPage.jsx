import { useState, useEffect } from 'react';
import {
  Star, MessageSquare, Reply, ThumbsUp, Filter, Loader2,
  CheckCircle2, EyeOff, Flag, Clock, Search, X, MessageCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import Drawer from '../components/common/Drawer';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ overall: 0, food: 0, service: 0, ambience: 0, totalReviews: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedRating, setSelectedRating] = useState('ALL');

  // Replying state in Drawer
  const [replyingReview, setReplyingReview] = useState(null);
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

  const handleSendReply = async () => {
    if (!replyingReview || !replyText.trim()) {
      toast.error('Reply text cannot be empty');
      return;
    }

    setSubmittingReply(true);
    try {
      await api.post(`/reviews/${replyingReview._id}/reply`, { text: replyText.trim() });
      toast.success('Reply submitted to customer');
      setReplyingReview(null);
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
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={13}
            className={star <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-stone-300'}
          />
        ))}
      </div>
    );
  };

  const hasReviews = stats.totalReviews > 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Guest Reviews & Ratings"
        subtitle="Feedback submitted by guests after settling their QR dining bills."
        breadcrumbs={[
          { label: 'Growth', to: '/customers' },
          { label: 'Reviews' }
        ]}
      />

      {/* Rating Distribution & Overall Score KPI Banner (Fixes Bug #5) */}
      <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
          {/* Big Overall Star Badge */}
          <div className="flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-stone-100 pb-5 md:pb-0 md:pr-6 text-center">
            {hasReviews ? (
              <>
                <div className="font-display font-extrabold text-5xl text-espresso-950">
                  {Number(stats.overall).toFixed(1)}
                </div>
                <div className="flex items-center gap-1 mt-1.5 text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={18}
                      className={star <= Math.round(stats.overall) ? 'fill-amber-400' : 'text-stone-200'}
                    />
                  ))}
                </div>
                <p className="text-xs text-stone-500 font-medium mt-1">
                  Based on {stats.totalReviews} verified guest reviews
                </p>
              </>
            ) : (
              <>
                <div className="font-display font-bold text-2xl text-stone-400">
                  No ratings yet
                </div>
                <div className="flex items-center gap-1 mt-1.5 text-stone-300">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} size={18} />
                  ))}
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  Awaiting first guest review
                </p>
              </>
            )}
          </div>

          {/* Sub-factor Breakdown Progress Bars */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
              Category Satisfaction Breakdown
            </h4>

            {/* Food & Beverage */}
            <div className="flex items-center gap-4 text-xs">
              <span className="w-28 font-semibold text-stone-700">Food Quality</span>
              <div className="h-2 flex-1 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-600 transition-all duration-300"
                  style={{ width: hasReviews ? `${(stats.food / 5) * 100}%` : '0%' }}
                />
              </div>
              <span className="w-12 text-right font-bold text-stone-800">
                {hasReviews ? `${stats.food}/5` : '—'}
              </span>
            </div>

            {/* Service & Hospitality */}
            <div className="flex items-center gap-4 text-xs">
              <span className="w-28 font-semibold text-stone-700">Service Speed</span>
              <div className="h-2 flex-1 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-600 transition-all duration-300"
                  style={{ width: hasReviews ? `${(stats.service / 5) * 100}%` : '0%' }}
                />
              </div>
              <span className="w-12 text-right font-bold text-stone-800">
                {hasReviews ? `${stats.service}/5` : '—'}
              </span>
            </div>

            {/* Ambience & Music */}
            <div className="flex items-center gap-4 text-xs">
              <span className="w-28 font-semibold text-stone-700">Café Ambience</span>
              <div className="h-2 flex-1 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-600 transition-all duration-300"
                  style={{ width: hasReviews ? `${(stats.ambience / 5) * 100}%` : '0%' }}
                />
              </div>
              <span className="w-12 text-right font-bold text-stone-800">
                {hasReviews ? `${stats.ambience}/5` : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-3.5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mr-1">Filter Stars:</span>
          {['ALL', '5', '4', '3', '2', '1'].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setSelectedRating(star)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                selectedRating === star
                  ? 'bg-espresso-950 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              {star === 'ALL' ? 'All Reviews' : `${star} ★`}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-stone-100 border border-stone-200/60" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No guest reviews found"
          description="When guests complete a table session, their ratings and suggestions will appear here."
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review._id}
              className="rounded-2xl border border-stone-200/90 bg-white p-4.5 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-espresso-950 font-display text-sm font-bold text-white">
                    {review.customerName ? review.customerName.charAt(0).toUpperCase() : 'G'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-stone-900">
                        {review.customerName || 'Anonymous Guest'}
                      </span>
                      {review.tableNumber && (
                        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-600">
                          Table {review.tableNumber}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-400 mt-0.5">
                      {renderStars(review.rating || 5)}
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(review.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Moderation status */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingReview(review);
                      setReplyText(review.ownerReply?.text || '');
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition"
                  >
                    <Reply size={13} />
                    <span>{review.ownerReply ? 'Edit Reply' : 'Reply'}</span>
                  </button>
                </div>
              </div>

              {/* Review Text */}
              {review.comment && (
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed bg-stone-50/50 p-3 rounded-xl border border-stone-100">
                  "{review.comment}"
                </p>
              )}

              {/* Owner Reply bubble if already answered */}
              {review.ownerReply?.text && (
                <div className="ml-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
                    <MessageCircle size={13} />
                    <span>Response from Brewhaus Team:</span>
                  </div>
                  <p className="text-xs text-amber-800">
                    {review.ownerReply.text}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* REPLY DRAWER */}
      <Drawer
        isOpen={Boolean(replyingReview)}
        onClose={() => setReplyingReview(null)}
        title={replyingReview ? `Reply to ${replyingReview.customerName || 'Guest'}` : ''}
        subtitle={replyingReview ? `Rated ${replyingReview.rating} ★ on Table ${replyingReview.tableNumber || '-'}` : ''}
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setReplyingReview(null)}
              className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSendReply}
              disabled={submittingReply || !replyText.trim()}
              className="btn-primary rounded-xl px-5 py-2 text-xs font-semibold shadow-xs"
            >
              {submittingReply ? 'Sending...' : 'Publish Reply'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {replyingReview?.comment && (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3.5 text-xs text-stone-700 italic">
              "{replyingReview.comment}"
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Your Response *
            </label>
            <textarea
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Thank you so much for dining with us! We are thrilled you enjoyed the pour-over coffee..."
              className="w-full rounded-xl border border-stone-200 p-3 text-xs focus:border-amber-500 focus:outline-none leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Quick templates:</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Thank you for visiting! We look forward to welcoming you back.',
                'We appreciate your feedback and will share this with our kitchen team!',
                'Apologies for the delay during peak rush. We hope to serve you better next time.'
              ].map((template, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReplyText(template)}
                  className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] text-stone-600 hover:bg-stone-100 text-left"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
