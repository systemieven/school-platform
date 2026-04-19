import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import { Loader2 } from 'lucide-react';
import { useBranding } from './contexts/BrandingContext';
import MaintenancePage from './pages/MaintenancePage';

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
import TrabalheConosco   from './pages/TrabalheConosco';
import PoliticaPrivacidade from './pages/PoliticaPrivacidade';
import TermosUso         from './pages/TermosUso';
import Sobre             from './pages/Sobre';
import Estrutura         from './pages/Estrutura';
import NotFound          from './pages/NotFound';

// These two standalone pages are lazy: large + rarely accessed by site visitors
const AtendimentoPublico = lazy(() => import('./pages/AtendimentoPublico'));
const PainelAtendimento  = lazy(() => import('./pages/PainelAtendimento'));

// Fase 14 — Loja pública + Checkout próprio
const LojaPublicaPage      = lazy(() => import('./pages/loja/LojaPublicaPage'));
const PagarPage            = lazy(() => import('./pages/checkout/PagarPage'));
const CategoriaPage        = lazy(() => import('./pages/loja/CategoriaPage'));
const ProdutoPage          = lazy(() => import('./pages/loja/ProdutoPage'));
const CarrinhoPage         = lazy(() => import('./pages/loja/CarrinhoPage'));
const CheckoutPage         = lazy(() => import('./pages/loja/CheckoutPage'));
const ConfirmacaoPedidoPage = lazy(() => import('./pages/loja/ConfirmacaoPedidoPage'));

// Admin panel, student portal and guardian portal — lazy: large bundles.
// Portal do Professor foi migrado para /admin/area-professor (ver src/admin/routes.tsx).
const AdminRoutes      = lazy(() => import('./admin/routes'));
const PortalRoutes     = lazy(() => import('./portal/routes'));
const ResponsavelRoutes = lazy(() => import('./responsavel/routes'));

function FullPageFallback() {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
    </div>
  );
}

export default function App() {
  const { maintenanceMode } = useBranding();

  return (
    <Routes>
      {/* ── Public site ── */}
      {!maintenanceMode && (
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="educacao-infantil"    element={<EducacaoInfantil />} />
          <Route path="ensino-fundamental-1" element={<EnsinoFundamental1 />} />
          <Route path="ensino-fundamental-2" element={<EnsinoFundamental2 />} />
          <Route path="ensino-medio"         element={<EnsinoMedio />} />
          <Route path="matricula"            element={<Matricula />} />
          <Route path="contato"              element={<Contato />} />
          <Route path="agendar-visita"       element={<AgendarVisita />} />
          <Route path="trabalhe-conosco"     element={<TrabalheConosco />} />
          <Route path="politica-privacidade" element={<PoliticaPrivacidade />} />
          <Route path="termos-de-uso"        element={<TermosUso />} />
          <Route path="sobre"                element={<Sobre />} />
          <Route path="estrutura"            element={<Estrutura />} />

          {/* Fase 14 — Loja pública */}
          <Route path="loja"                    element={<Suspense fallback={<FullPageFallback />}><LojaPublicaPage /></Suspense>} />
          <Route path="loja/categoria/:slug"    element={<Suspense fallback={<FullPageFallback />}><CategoriaPage /></Suspense>} />
          <Route path="loja/produto/:slug"      element={<Suspense fallback={<FullPageFallback />}><ProdutoPage /></Suspense>} />
          <Route path="loja/carrinho"           element={<Suspense fallback={<FullPageFallback />}><CarrinhoPage /></Suspense>} />
          <Route path="loja/checkout"           element={<Suspense fallback={<FullPageFallback />}><CheckoutPage /></Suspense>} />
          <Route path="loja/pedido/:orderNumber" element={<Suspense fallback={<FullPageFallback />}><ConfirmacaoPedidoPage /></Suspense>} />

          <Route path="*"                    element={<NotFound />} />
        </Route>
      )}

      {/* ── Maintenance — standalone, no site chrome ── */}
      {maintenanceMode && (
        <Route path="*" element={<MaintenancePage />} />
      )}

      {/* ── Checkout próprio — sem nav, público, /pagar/:token ── */}
      <Route path="pagar/:token" element={<Suspense fallback={<FullPageFallback />}><PagarPage /></Suspense>} />

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

    </Routes>
  );
}
