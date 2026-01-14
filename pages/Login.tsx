
import React, { useState } from 'react';
import { useSchool, formatImageUrl } from '../context/SchoolContext';

const Login: React.FC = () => {
  console.log("LOGIN COMPONENT VERSION: 3.6.1 (Auth Enabled)");
  const { login, data, loading, dbError, createFirstAdmin, refreshData } = useSchool();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSetupLoading, setIsSetupLoading] = useState(false);
  const [error, setError] = useState('');

  const isSystemEmpty = !loading && !dbError && data.users.length === 0;

  // Obtém a logo do sistema das configurações ou usa a padrão definida no contexto
  const systemLogoUrl = formatImageUrl(data.settings.systemLogo);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSetupLoading(true);
    setError('');
    try {
      const success = await login(email, password);
      if (!success) {
        setError('Acesso negado. Verifique seu e-mail e senha.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login.');
    } finally {
      setIsSetupLoading(false);
    }
  };

  const handleFirstSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setIsSetupLoading(true);
    try {
      await createFirstAdmin({ name, email });
    } catch (err: any) {
      setError(err.message || 'Erro ao configurar administrador.');
    } finally {
      setIsSetupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Verificando Integridade do SEI...</p>
        </div>
      </div>
    );
  }

  // TELA DE DIAGNÓSTICO SQL (CASO TABELAS NÃO EXISTAM)
  if (dbError === 'MISSING_USERS_TABLE') {
    return (
      <div className="min-h-screen bg-[#0A1128] flex items-center justify-center p-6">
        <div className="w-full max-w-2xl bg-white rounded-[40px] shadow-2xl p-12 space-y-8 animate-in zoom-in-95 duration-500">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-500 text-4xl shadow-inner border border-amber-100">⚠️</div>
            <div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tighter">Banco de Dados Incompleto</h1>
              <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">A tabela 'users' não foi encontrada no Supabase.</p>
            </div>
          </div>

          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              Como estamos implementando um sistema de permissões, você precisa criar a tabela de usuários.
              Siga os passos abaixo:
            </p>
            <ol className="text-xs text-slate-500 space-y-2 list-decimal list-inside font-bold uppercase tracking-tight">
              <li>Acesse o seu projeto no <a href="https://supabase.com/dashboard" target="_blank" className="text-indigo-600 underline">Dashboard do Supabase</a></li>
              <li>Clique no menu <strong>SQL Editor</strong> na lateral esquerda</li>
              <li>Clique em <strong>New Query</strong> e cole o código abaixo:</li>
            </ol>

            <div className="relative group">
              <pre className="bg-slate-900 text-indigo-300 p-6 rounded-2xl text-[10px] font-mono overflow-x-auto shadow-inner select-all">
                {`CREATE TABLE IF NOT EXISTS public.users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin_ti', 'admin_dir', 'coord', 'prof', 'sec')),
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Habilitar acesso público para este projeto de demonstração
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso Total" ON public.users FOR ALL USING (true);`}
              </pre>
              <div className="absolute top-4 right-4 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-800 px-2 py-1 rounded">Script SQL</div>
            </div>

            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mt-4">
              Após clicar em "Run", clique no botão abaixo para tentar novamente.
            </p>
          </div>

          <button
            onClick={() => { refreshData(); }}
            className="w-full py-5 bg-[#0A1128] text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-slate-800 transition-all active:scale-95"
          >
            Já executei o SQL. Tentar Novamente!
          </button>
        </div>
      </div>
    );
  }

  if (isSystemEmpty) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-50 via-white to-slate-50">
        <div className="w-full max-w-md bg-white rounded-[48px] shadow-2xl border border-slate-100 p-12 space-y-10 animate-in zoom-in-95 duration-500">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-emerald-600 rounded-[28px] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-200">
              <span className="text-3xl">🛡️</span>
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tighter">Configuração Inicial</h1>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">Nenhum administrador detectado</p>
            </div>
          </div>

          <p className="text-sm text-slate-500 text-center leading-relaxed font-medium">
            O banco de dados está pronto. Por favor, cadastre seu e-mail para assumir o perfil de <strong>Administrador (TI)</strong>.
          </p>

          <form onSubmit={handleFirstSetup} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Seu Nome Completo</label>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="EX: JOÃO SILVA"
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white focus:border-emerald-300 transition-all shadow-inner uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Seu E-mail (Google/MS)</label>
              <input
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu-email@gmail.com"
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white focus:border-emerald-300 transition-all shadow-inner"
              />
            </div>

            {error && <p className="text-center text-red-500 text-[10px] font-bold uppercase bg-red-50 p-3 rounded-xl">{error}</p>}

            <button
              type="submit"
              disabled={isSetupLoading}
              className="w-full py-5 bg-emerald-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSetupLoading ? 'Configurando...' : 'Finalizar e Acessar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-50 via-white to-slate-50">
      <div className="w-full max-w-md bg-white rounded-[48px] shadow-2xl border border-slate-100 p-12 space-y-10 animate-in zoom-in-95 duration-500">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center mx-auto mb-4">
            {systemLogoUrl ? (
              <img src={systemLogoUrl} alt="Logo" className="h-32 w-auto object-contain" />
            ) : (
              <div className="w-24 h-24 bg-indigo-600 rounded-[32px] flex items-center justify-center text-white shadow-2xl shadow-indigo-200 font-black text-2xl">SEI</div>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter">Bem-vindo ao SEI</h1>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">Tecnologia a favor da Educação</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">E-mail de Acesso</label>
            <input
              required
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seuemail@provedor.com"
              className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] outline-none font-bold text-slate-700 focus:bg-white focus:border-indigo-300 transition-all shadow-inner"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Senha</label>
            <input
              required
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] outline-none font-bold text-slate-700 focus:bg-white focus:border-indigo-300 transition-all shadow-inner"
            />
          </div>

          {error && <p className="text-center text-red-500 text-[10px] font-bold uppercase bg-red-50 p-3 rounded-xl border border-red-100">{error}</p>}

          <button
            type="submit"
            disabled={isSetupLoading}
            className="w-full py-5 bg-[#0A1128] text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
          >
            {isSetupLoading ? 'Verificando...' : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-px bg-slate-100 flex-1"></div>
            <span className="text-[10px] font-black text-slate-300 uppercase">Ou acesse via</span>
            <div className="h-px bg-slate-100 flex-1"></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setEmail('professor@gmail.com')} className="flex items-center justify-center gap-3 py-4 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all shadow-sm">
              <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="w-5 h-5" alt="Google" />
              <span className="text-[10px] font-black text-slate-600 uppercase">Google</span>
            </button>
            <button onClick={() => setEmail('secretaria@outlook.com')} className="flex items-center justify-center gap-3 py-4 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all shadow-sm">
              <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" className="w-5 h-5" alt="MS" />
              <span className="text-[10px] font-black text-slate-600 uppercase">Microsoft</span>
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest leading-relaxed">
          Acesso restrito para colaboradores autorizados.<br />
          Caso não consiga entrar, procure o TI da escola.
        </p>
      </div>
    </div>
  );
};

export default Login;
