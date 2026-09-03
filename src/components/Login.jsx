
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const ALLOWED_DOMAIN = '@starktech.com';

export default function Login({ initialError }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState(initialError || '');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setInfo('');

    if (mode === 'signup') {
      if (!email.toLowerCase().trim().endsWith(ALLOWED_DOMAIN)) {
        setError(`Please use your company email address (must end in ${ALLOWED_DOMAIN}).`);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-type them.');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName } }
        });
        if (error) throw error;
        setInfo('Account created. An administrator needs to grant you permissions before you can view inventory.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(''); setInfo('');
    setPassword(''); setConfirmPassword('');
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <h2>{mode === 'signin' ? 'Sign In' : 'Create Account'}</h2>
        {mode === 'signup' && (
          <div className="field">
            <label>Full name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} required />
          </div>
        )}
        <div className="field">
          <label>Email{mode === 'signup' ? ` (must end in ${ALLOWED_DOMAIN})` : ''}</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
        </div>
        {mode === 'signup' && (
          <div className="field">
            <label>Confirm password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
          </div>
        )}
        {error && <div className="error-text">{error}</div>}
        {info && <div style={{ color: '#4ade80', fontSize: 13 }}>{info}</div>}
        <button type="submit" disabled={busy}>
          {mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </button>
        <button type="button" className="secondary" onClick={switchMode}>
          {mode === 'signin' ? 'Create a new account' : 'I already have an account'}
        </button>
      </form>
    </div>
  );
}