import { redirect } from 'next/navigation';

// The AI Copilot is now exclusively the floating 3D robot widget.
// Anyone landing on this URL (bookmarks, old links) is sent to home.
export default function CopilotPage() {
  redirect('/home');
}
