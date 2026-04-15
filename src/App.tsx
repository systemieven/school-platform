import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import { Loader2 } from 'lucide-react';

// Lazy-load: public pages loaded on demand
const EducacaoInfantil   = lazy(() => import('./pages/EducacaoInfantil'));
const EnsinoFundamental1 = lazy(() => import('./pages/EnsinoFundamental1'));
const EnsinoFundamental2 = lazy(() => import('./pages/EnsinoFundamental2'));
const EnsinoMedio        = lazy(() => import('./pages/EnsinoMedio'));
const Matricula          = lazy(() => import('./pages/Matricula'));
const Contato            = lazy(() => import('./pages/Contato'));
const AgendarVisita      = lazy(() => import('./pages/AgendarVisita'));
const PoliticaPrivacidade = lazy(() => import('./pages/PoliticaPrivacidade'));
const TermosUso          = lazy(() => import('./pages/TermosUso'));
const Sobre              = lazy(() => import('./pages/Sobre'));
const Estrutura          = lazy(() => import('./pages/Estrutura'));
const EmConstrucao       = lazy(() => import('./pages/EmConstrucao'));
const AtendimentoPublico = lazy(() => import('./pages/AtendimentoPublico'));
const PainelAtendimento  = lazy(() => import('./pages/PainelAtendimento'));

// Lazy-load admin panel and student portal as separate bundle chunks
const AdminRoutes  = lazy(() => import('./admin/routes'));
const PortalRoutes = lazy(() => import('./portal/routes'));

function FullPageFallback() {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
    </div>
  );
}

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
    </div>
  );
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      {/* ── Public site ── */}
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="educacao-infantil" element={<Lazy><EducacaoInfantil /></Lazy>} />
        <Route path="ensino-fundamental-1" element={<Lazy><EnsinoFundamental1 /></Lazy>} />
        <Route path="ensino-fundamental-2" element={<Lazy><EnsinoFundamental2 /></Lazy>} />
        <Route path="ensino-medio" element={<Lazy><EnsinoMedio /></Lazy>} />
        <Route path="matricula" element={<Lazy><Matricula /></Lazy>} />
        <Route path="contato" element={<Lazy><Contato /></Lazy>} />
        <Route path="agendar-visita" element={<Lazy><AgendarVisita /></Lazy>} />
        <Route path="politica-privacidade" element={<Lazy><PoliticaPrivacidade /></Lazy>} />
        <Route path="termos-de-uso" element={<Lazy><TermosUso /></Lazy>} />
        <Route path="sobre" element={<Lazy><Sobre /></Lazy>} />
        <Route path="estrutura" element={<Lazy><Estrutura /></Lazy>} />
        <Route path="area-professor" element={<Lazy><EmConstrucao /></Lazy>} />
        <Route path="*" element={<NotFound />} />
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
    </Routes>
  );
}
