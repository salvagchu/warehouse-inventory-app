import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blockedMessage, setBlockedMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(async ({ data }) => {
        if (data?.disabled) {
          await supabase.auth.signOut();
          setBlockedMessage('Account not found. Please check your email and password.');
          setProfile(null);
          return;
        }
        setProfile(data);
      });
  }, [session]);

  if (loading) return null;
  if (!session) return <Login initialError={blockedMessage} />;
  if (!profile) return <div style={{ padding: 20 }}>Loading profile...</div>;

  return <Dashboard session={session} profile={profile} />;
}