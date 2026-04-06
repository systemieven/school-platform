import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import EducacaoInfantil from './pages/EducacaoInfantil';
import EnsinoFundamental1 from './pages/EnsinoFundamental1';
import EnsinoFundamental2 from './pages/EnsinoFundamental2';
import EnsinoMedio from './pages/EnsinoMedio';
import Matricula from './pages/Matricula';
import EmConstrucao from './pages/EmConstrucao';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="educacao-infantil" element={<EducacaoInfantil />} />
        <Route path="ensino-fundamental-1" element={<EnsinoFundamental1 />} />
        <Route path="ensino-fundamental-2" element={<EnsinoFundamental2 />} />
        <Route path="ensino-medio" element={<EnsinoMedio />} />
        <Route path="matricula" element={<Matricula />} />
        <Route path="sobre" element={<EmConstrucao />} />
        <Route path="estrutura" element={<EmConstrucao />} />
        <Route path="portal-aluno" element={<EmConstrucao />} />
        <Route path="biblioteca-virtual" element={<EmConstrucao />} />
        <Route path="area-professor" element={<EmConstrucao />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
