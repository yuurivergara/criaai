import { useState } from 'react';
import { useAuth } from './AuthContext';

type Tab = 'login' | 'signup';

/**
 * Single-screen entry point with two tabs (login/signup). Used by the
 * top-level AuthGate when no session is present.
 */
export function AuthScreen() {
  const { login, signup } = useAuth();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (tab === 'signup') {
        await signup(email, password, name || undefined);
      } else {
        await login(email, password);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <header className="auth-header">
          <h1>cria.ai</h1>
          <p>Clone, edite, gere e publique páginas em minutos.</p>
        </header>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'login'}
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setTab('login');
              setError(null);
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'signup'}
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setTab('signup');
              setError(null);
            }}
          >
            Criar conta
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {tab === 'signup' && (
            <label className="auth-field">
              <span>Nome (opcional)</span>
              <input
                type="text"
                placeholder="Como prefere ser chamado"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </label>
          )}
          <label className="auth-field">
            <span>E-mail</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="voce@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </label>
          <label className="auth-field">
            <span>Senha</span>
            <input
              type="password"
              autoComplete={
                tab === 'signup' ? 'new-password' : 'current-password'
              }
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              minLength={6}
              required
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading || !email || !password}
          >
            {(() => {
              if (loading) return 'Aguarde…';
              return tab === 'signup' ? 'Criar conta' : 'Entrar';
            })()}
          </button>
        </form>

        <footer className="auth-footer">
          {tab === 'login' ? (
            <span>
              Não tem conta?{' '}
              <button type="button" onClick={() => setTab('signup')}>
                Crie agora
              </button>
            </span>
          ) : (
            <span>
              Já tem conta?{' '}
              <button type="button" onClick={() => setTab('login')}>
                Entrar
              </button>
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
