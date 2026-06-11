import { useSession } from '../state/session.js';
import { ChatSection } from '../components/ChatSection.js';
import { isPremium as computeIsPremium } from '../lib/premium.js';

export const ChatPage = () => {
  const { status } = useSession();
  if (status.kind !== 'authenticated') return null;
  const isPremium = computeIsPremium(status.user);
  return (
    <div className="space-y-4">
      <ChatSection isPremium={isPremium} />
    </div>
  );
};
