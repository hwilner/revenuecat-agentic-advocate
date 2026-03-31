'use client';

import { useState } from 'react';

/**
 * FeedbackWidget — A reusable thumbs up/down feedback component.
 *
 * This client component can be embedded on any page to collect visitor
 * feedback. When a user votes, the feedback is sent to the
 * /api/page-feedback endpoint, which stores it in the database and
 * feeds it into the agent's self-learning system.
 *
 * Props:
 * - page: The current page path (e.g., "/portfolio")
 * - itemId: Optional specific item identifier
 * - itemType: Optional item type (e.g., "blog-post", "feedback-entry")
 * - label: Optional custom label text (defaults to "Was this helpful?")
 */
export default function FeedbackWidget({
  page,
  itemId,
  itemType,
  label = 'Was this helpful?',
}: {
  page: string;
  itemId?: string;
  itemType?: string;
  label?: string;
}) {
  const [state, setState] = useState<'idle' | 'voted' | 'commenting' | 'submitted' | 'error'>('idle');
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  const [comment, setComment] = useState('');

  /**
   * Sends the feedback to the API endpoint.
   * On success, transitions to 'submitted' state.
   * On failure, transitions to 'error' state.
   */
  async function submitFeedback(selectedVote: 'up' | 'down', commentText?: string) {
    try {
      const res = await fetch('/api/page-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page,
          item_id: itemId,
          item_type: itemType,
          vote: selectedVote,
          comment: commentText || undefined,
        }),
      });
      if (res.ok) {
        setState('submitted');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  /**
   * Handles the initial thumbs up/down click.
   * For thumbs up: submits immediately.
   * For thumbs down: opens the comment box for optional feedback.
   */
  function handleVote(selectedVote: 'up' | 'down') {
    setVote(selectedVote);
    if (selectedVote === 'up') {
      setState('voted');
      submitFeedback(selectedVote);
    } else {
      /* For thumbs down, offer a comment box before submitting */
      setState('commenting');
    }
  }

  /**
   * Submits the thumbs-down vote with the optional comment.
   */
  function handleCommentSubmit() {
    if (vote) {
      submitFeedback(vote, comment);
    }
  }

  /* ---- Submitted state ---- */
  if (state === 'submitted' || state === 'voted') {
    return (
      <div style={containerStyle}>
        <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>
          Thank you for your feedback!
        </span>
      </div>
    );
  }

  /* ---- Error state ---- */
  if (state === 'error') {
    return (
      <div style={containerStyle}>
        <span style={{ fontSize: 13, color: '#ef4444' }}>
          Failed to submit feedback. Please try again.
        </span>
      </div>
    );
  }

  /* ---- Comment input state (after thumbs down) ---- */
  if (state === 'commenting') {
    return (
      <div style={{ ...containerStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          What could be improved?
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional: tell us what could be better..."
          style={{
            padding: 8,
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 13,
            resize: 'vertical',
            minHeight: 60,
            fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleCommentSubmit}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: '#6366f1',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Submit
          </button>
          <button
            onClick={() => { submitFeedback('down'); }}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              color: '#6b7280',
              background: 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  /* ---- Default idle state: thumbs up / thumbs down buttons ---- */
  return (
    <div style={containerStyle}>
      <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => handleVote('up')}
          title="Helpful"
          style={buttonStyle}
          aria-label="Thumbs up"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 10v12" />
            <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
          </svg>
        </button>
        <button
          onClick={() => handleVote('down')}
          title="Not helpful"
          style={buttonStyle}
          aria-label="Thumbs down"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 14V2" />
            <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared Styles                                                      */
/* ------------------------------------------------------------------ */

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 14px',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  background: '#f9fafb',
  marginTop: 8,
};

const buttonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  background: '#fff',
  cursor: 'pointer',
  transition: 'background 0.15s, border-color 0.15s',
};
