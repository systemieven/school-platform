import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import { Loader2 } from 'lucide-react';

// Public pages — eager imports for instant transitions (no Suspense delay)
// Vendor libs (react, supabase, etc.) already split via manualChunks in vite.config.ts
import Home              from './pages/Home';
import EducacaoInfantil  from './pages/EducacaoInfantil';
import EnsinoFundamental1 from './pages/EnsinoFundamental1';
import EnsinoFundamental2 from './pages/EnsinoFundamental2';
import EnsinoMedio       from './pages/EnsinoMedio';
import Matricula         from './pages/Matricula';
import Contato           from './pages/Contato';
import AgendarVisita     from './pages/AgendarVisita';
import PoliticaPrivacidade from './pages/PoliticaPrivacidade';
import TermosUso         from './pages/TermosUso';
import Sobre             from './pages/Sobre';
import Estrutura         from './pages/Estrutura';
import EmConstrucao      from './pages/EmConstrucao';
import NotFound          from './pages/NotFound';

// These two standalone pages are lazy: large + rarely accessed by site visitors
const AtendimentoPublico = lazy(() => import('./pages/AtendimentoPublico'));
const PainelAtendimento  = lazy(() => import('./pages/PainelAtendimento'));

// Admin panel, student portal, guardian portal and teacher portal — lazy: large bundles
const AdminRoutes      = lazy(() => import('./admin/routes'));
const PortalRoutes     = lazy(() => import('./portal/routes'));
const ResponsavelRoutes = lazy(() => import('./responsavel/routes'));
const ProfessorRoutes   = lazy(() => import('./professor/routes'));

function FullPageFallback() {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* ── Public site ── */}
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="educacao-infantil"    element={<EducacaoInfantil />} />
        <Route path="ensino-fundamental-1" element={<EnsinoFundamental1 />} />
        <Route path="ensino-fundamental-2" element={<EnsinoFundamental2 />} />
        <Route path="ensino-medio"         element={<EnsinoMedio />} />
        <Route path="matricula"            element={<Matricula />} />
        <Route path="contato"              element={<Contato />} />
        <Route path="agendar-visita"       element={<AgendarVisita />} />
        <Route path="politica-privacidade" element={<PoliticaPrivacidade />} />
        <Route path="termos-de-uso"        element={<TermosUso />} />
        <Route path="sobre"                element={<Sobre />} />
        <Route path="estrutura"            element={<Estrutura />} />
        <Route path="area-professor"       element={<EmConstrucao />} />
        <Route path="*"                    element={<NotFound />} />
      </Route>

      {/* ── Public attendance (QR code, no site chrome) ── */}
      <Route path="atendimento" element={<Suspense fallback={<FullPageFallback />}><AtendimentoPublico /></Suspense>} />

      {/* ── Public call panel (TV display, no site chrome) ── */}
      <Route path="painel-atendimento" element={<Suspense fallback={<FullPageFallback />}><PainelAtendimento /></Suspense>} />

      {/* ── Admin panel (lazy-loaded) ── */}
      <Route
        path="admin/*"
        element={
          <Suspense fallback={<FullPageFallback />}>
            <AdminRoutes />
          </Suspense>
        }
      />

      {/* ── Student portal (lazy-loaded) ── */}
      <Route
        path="portal/*"
        element={
          <Suspense fallback={<FullPageFallback />}>
            <PortalRoutes />
          </Suspense>
        }
      />

      {/* ── Guardian portal (lazy-loaded) ── */}
      <Route
        path="responsavel/*"
        element={
          <Suspense fallback={<FullPageFallback />}>
            <ResponsavelRoutes />
          </Suspense>
        }
      />

      {/* ── Teacher portal (lazy-loaded) ── */}
      <Route
        path="professor/*"
        element={
          <Suspense fallback={<FullPageFallback />}>
            <ProfessorRoutes />
          </Suspense>
        }
      />
    </Routes>
  );
}
