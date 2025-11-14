import React from 'react';
import InterviewSchedulerGlobty from './InterviewSchedulerGlobty';
import { AvailabilityPanel } from './AvailabilityPanel';

export default function App() {
  const env = typeof window !== 'undefined' && window.__ENV ? window.__ENV : {};
  return (
    <div>
      <InterviewSchedulerGlobty clientId={env.REACT_APP_GOOGLE_CLIENT_ID} apiKey={env.REACT_APP_GOOGLE_API_KEY} availabilityApiUrl={env.AVAILABILITY_API_URL} />
    </div>
  );
}
