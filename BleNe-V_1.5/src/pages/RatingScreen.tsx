import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { AccessibleButton } from '@/components/AccessibleButton';
import { StarRating } from '@/components/StarRating';
import { SkipLink } from '@/components/SkipLink';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSpeechSynthesis } from '@/hooks/useSpeech';

export default function RatingScreen() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthContext();
  const { speak, isSupported } = useSpeechSynthesis();

  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Announce on mount
  useEffect(() => {
    if (isSupported) {
      speak('Please rate your volunteer from 1 to 5 stars.');
    }
  }, [isSupported, speak]);

  const handleRatingChange = (newRating: number) => {
    setRating(newRating);
    if (isSupported) {
      speak(`${newRating} star${newRating !== 1 ? 's' : ''} selected`);
    }
  };

  const handleSubmit = () => {
    // Placeholder for API call
    console.log('Rating submitted:', { rating, feedback });
    
    setSubmitted(true);
    if (isSupported) {
      speak('Thank you for your feedback! Returning to home screen.');
    }

    setTimeout(() => {
      navigate('/user');
    }, 2000);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center animate-fade-in">
          <div className="w-24 h-24 mx-auto mb-6 bg-success/20 rounded-full flex items-center justify-center">
            <span className="text-5xl">✓</span>
          </div>
          <h1 className="text-accessible-2xl font-bold text-foreground mb-4">
            Thank You!
          </h1>
          <p className="text-accessible text-muted-foreground">
            Your feedback helps improve our community.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SkipLink targetId="rating-form" />

      {/* Header */}
      <header className="p-4 border-b border-border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/user')}
            className="p-3 rounded-xl hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" aria-hidden="true" />
          </button>
          <h1 className="text-accessible-lg font-bold text-foreground">
            Rate Your Experience
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main
        id="rating-form"
        className="flex-1 flex flex-col items-center justify-center p-6"
        role="main"
      >
        <div className="w-full max-w-md space-y-8">
          {/* Volunteer Info */}
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-primary/20 rounded-full flex items-center justify-center">
              <span className="text-3xl">👤</span>
            </div>
            <h2 className="text-accessible-xl font-bold text-foreground">
              How was your volunteer?
            </h2>
            <p className="text-accessible text-muted-foreground mt-2">
              Your rating helps recognize great volunteers
            </p>
          </div>

          {/* Star Rating */}
          <div className="py-6">
            <StarRating
              rating={rating}
              onRate={handleRatingChange}
              label="Rate your volunteer"
            />
            <p className="text-center mt-4 text-accessible text-muted-foreground">
              {rating === 0 && 'Tap a star to rate'}
              {rating === 1 && 'Poor experience'}
              {rating === 2 && 'Fair experience'}
              {rating === 3 && 'Good experience'}
              {rating === 4 && 'Great experience'}
              {rating === 5 && 'Excellent experience!'}
            </p>
          </div>

          {/* Optional Feedback */}
          <div className="space-y-2">
            <label
              htmlFor="feedback"
              className="block text-accessible font-semibold text-foreground"
            >
              Additional Feedback (Optional)
            </label>
            <textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Share your experience..."
              className="input-accessible w-full min-h-[120px] resize-none"
              aria-describedby="feedback-helper"
            />
            <p id="feedback-helper" className="text-muted-foreground text-base">
              Your feedback helps improve the service
            </p>
          </div>

          {/* Submit Button */}
          <AccessibleButton
            variant="primary"
            onClick={handleSubmit}
            disabled={rating === 0}
            className="w-full flex items-center justify-center gap-3"
            ariaLabel="Submit your rating"
          >
            <Send className="w-6 h-6" aria-hidden="true" />
            <span>Submit Rating</span>
          </AccessibleButton>
        </div>
      </main>
    </div>
  );
}
