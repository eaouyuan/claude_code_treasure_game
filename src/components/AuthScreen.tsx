import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { signIn, signUp } from '../api';

interface AuthScreenProps {
  onSignedIn: (username: string) => void;
  onGuest: () => void;
}

export function AuthScreen({ onSignedIn, onGuest }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === 'signup';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const name = isSignUp ? await signUp(username, password) : await signIn(username, password);
      onSignedIn(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl mb-4 text-amber-900 text-center">🏴‍☠️ Treasure Hunt Game 🏴‍☠️</h1>
      <p className="text-amber-800 mb-8 text-center">
        {isSignUp ? 'Create an account to keep your scores' : 'Sign in to save your scores'}
      </p>

      <motion.form
        key={mode}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onSubmit={handleSubmit}
        className="w-full max-w-sm p-6 bg-amber-200/80 backdrop-blur-sm rounded-xl shadow-lg border-2 border-amber-400 flex flex-col gap-4"
      >
        <h2 className="text-2xl text-amber-900 text-center">{isSignUp ? 'Sign Up' : 'Sign In'}</h2>

        <div className="flex flex-col gap-2">
          <Label htmlFor="username" className="text-amber-900">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            style={{ backgroundColor: '#fffbeb' }}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password" className="text-amber-900">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ backgroundColor: '#fffbeb' }}
            required
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white">
          {loading ? 'Please wait…' : isSignUp ? 'Create Account' : 'Sign In'}
        </Button>

        <p className="text-sm text-amber-800 text-center">
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <button
            type="button"
            className="underline text-amber-900 cursor-pointer"
            onClick={() => {
              setMode(isSignUp ? 'signin' : 'signup');
              setError('');
            }}
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </motion.form>

      <button type="button" onClick={onGuest} className="mt-4 text-amber-700 underline cursor-pointer">
        Play as Guest (scores won't be saved)
      </button>
    </div>
  );
}
