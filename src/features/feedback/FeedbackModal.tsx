import { Modal } from '@/components/Modal';
import { FeedbackForm } from './FeedbackForm';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Quick-access feedback popup (opened from the user menu). The form itself lives
 * in {@link FeedbackForm}, shared with the full Feedback page so they can't drift.
 */
export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      accent="aurora"
      title="Share your thoughts"
      description="Tell us what you love, what is missing, or what to build next."
    >
      <FeedbackForm onCancel={onClose} onDone={onClose} />
    </Modal>
  );
}
