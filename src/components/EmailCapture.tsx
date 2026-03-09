import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Props {
    context?: string; // e.g. "unit-circle" or "math"
}

export default function EmailCapture({ context }: Props) {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || status === 'sending') return;
        setStatus('sending');
        try {
            await addDoc(collection(db, 'newsletter'), {
                email: email.trim().toLowerCase(),
                context: context || 'general',
                createdAt: serverTimestamp(),
            });
            setStatus('done');
            setEmail('');
        } catch {
            setStatus('error');
        }
    };

    if (status === 'done') {
        return (
            <div className="email-capture">
                <p className="email-capture-thanks">You're in! We'll send you new tools and tutorials.</p>
            </div>
        );
    }

    return (
        <form className="email-capture" onSubmit={submit}>
            <p className="email-capture-label">Get notified when we add new tools and tutorials</p>
            <div className="email-capture-row">
                <input
                    type="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="email-capture-input"
                />
                <button type="submit" className="btn-primary email-capture-btn" disabled={status === 'sending'}>
                    {status === 'sending' ? 'Joining...' : 'Subscribe'}
                </button>
            </div>
            {status === 'error' && <p className="email-capture-error">Something went wrong. Try again.</p>}
        </form>
    );
}
