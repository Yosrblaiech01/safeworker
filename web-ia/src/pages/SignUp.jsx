import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, UserPlus, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/auth/AuthLayout';

export default function SignUp() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setConfirmOpen(false);

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const result = await signup({
      name,
      email,
      password,
      role: 'Superviseur',
    });
    setLoading(false);

    if (result.success) {
      setConfirmMessage(result.message);
      setConfirmOpen(true);
    } else {
      setError(result.error);
    }
  }

  function handleCloseConfirm() {
    setConfirmOpen(false);
    navigate('/login');
  }

  return (
    <AuthLayout title="Créer un compte" subtitle="Rejoignez la plateforme de surveillance industrielle">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

        <Field label="Nom complet" icon={<User className="h-4 w-4" />}>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom complet"
            className="auth-input"
          />
        </Field>

        <Field label="Email" icon={<Mail className="h-4 w-4" />}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="superviseur@usine.com"
            className="auth-input"
          />
        </Field>

        <Field label="Mot de passe" icon={<Lock className="h-4 w-4" />}>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 caractères"
              className="auth-input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <Field label="Confirmer le mot de passe" icon={<Lock className="h-4 w-4" />}>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="auth-input"
          />
        </Field>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UserPlus className="h-5 w-5" />
          {loading ? 'Création...' : 'Créer mon compte'}
        </button>

        <p className="pt-2 text-center text-sm text-slate-400">
          Déjà un compte ?{' '}
          <Link to="/login" className="font-medium text-amber-400 hover:text-amber-300">
            Se connecter
          </Link>
        </p>
      </form>

      {confirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="panel w-full max-w-md overflow-hidden rounded-2xl">
            <div className="hazard-stripe h-1.5 w-full" />
            <div className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Compte créé</h3>
                  <p className="mt-1 text-sm text-slate-400">Confirmation</p>
                </div>
              </div>
              <button type="button" onClick={handleCloseConfirm} className="btn-ghost rounded-xl p-2" aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 pb-5">
              <p className="text-sm leading-relaxed text-slate-200">{confirmMessage}</p>
              <div className="mt-5 flex justify-end">
                <button type="button" onClick={handleCloseConfirm} className="btn-primary rounded-xl px-4 py-2 font-bold">
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

function Field({ label, icon, children }) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
        {icon && <span className="text-slate-400">{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}
