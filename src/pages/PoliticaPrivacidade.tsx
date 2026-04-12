/**
 * Política de Privacidade — LGPD (Lei 13.709/2018)
 * Texto-base para validação jurídica.
 */

import { Link } from 'react-router-dom';
import { Shield, ArrowRight } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';

const LAST_UPDATE = '06 de abril de 2026';

const SECTIONS = [
  {
    title: '1. Quem somos',
    content: `O Colégio Batista em Caruaru, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 01.873.279/0002-61, com sede na Rua Marcílio Dias, 99, São Francisco, Caruaru/PE, é a Controladora dos dados pessoais coletados neste site, nos termos da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).`,
  },
  {
    title: '2. Dados pessoais que coletamos',
    content: `Podemos coletar as seguintes categorias de dados pessoais, conforme a finalidade da interação:

• **Dados de identificação**: nome completo, e-mail, telefone/celular.
• **Dados do aluno**: série/turma pretendida, documentos acadêmicos (quando enviados via formulário de matrícula).
• **Dados de navegação**: endereço IP, tipo de navegador, páginas acessadas, data e horário de acesso (cookies e tecnologias similares).
• **Dados de agendamento de visitas**: nome, celular, e-mail, motivo da visita, nome de acompanhantes, data e horário selecionados.
• **Dados de depoimentos**: nome, avatar (via login social), e-mail, série do aluno matriculado, conteúdo do depoimento.
• **Dados sensíveis**: não coletamos dados sensíveis (origem racial ou étnica, convicção religiosa, opinião política, dado referente à saúde ou à vida sexual, dado genético ou biométrico) através deste site.`,
  },
  {
    title: '3. Finalidades do tratamento',
    content: `Utilizamos seus dados pessoais para as seguintes finalidades:

• **Contato e atendimento**: responder mensagens enviadas via formulário de contato ou WhatsApp.
• **Processo de matrícula**: avaliar e processar solicitações de matrícula, entrar em contato com responsáveis legais.
• **Agendamento de visitas**: confirmar e gerenciar visitas presenciais à escola.
• **Depoimentos**: publicar relatos de pais/responsáveis, mediante aprovação, para fins institucionais.
• **Melhoria do site**: analisar padrões de navegação para aprimorar a experiência do usuário.
• **Comunicação institucional**: enviar informações sobre eventos, matrículas e novidades da escola (apenas quando autorizado pelo titular).
• **Cumprimento de obrigações legais**: atender exigências legais, regulatórias ou judiciais.`,
  },
  {
    title: '4. Base legal para o tratamento',
    content: `O tratamento dos seus dados pessoais é realizado com fundamento nas seguintes bases legais previstas na LGPD:

• **Consentimento** (art. 7º, I): quando você preenche formulários, agenda visitas ou envia depoimentos voluntariamente.
• **Execução de contrato** (art. 7º, V): para viabilizar o processo de matrícula e a prestação de serviços educacionais.
• **Legítimo interesse** (art. 7º, IX): para melhoria do site e comunicação institucional, respeitando suas legítimas expectativas.
• **Cumprimento de obrigação legal** (art. 7º, II): para atender obrigações legais e regulatórias do setor educacional.`,
  },
  {
    title: '5. Compartilhamento de dados',
    content: `Seus dados pessoais podem ser compartilhados com:

• **Prestadores de serviço**: empresas que nos auxiliam na operação do site e sistemas (hospedagem, e-mail, armazenamento em nuvem), sempre mediante contrato que garanta a proteção dos dados.
• **Autoridades públicas**: quando exigido por lei, regulamento ou ordem judicial.

**Não vendemos, alugamos ou comercializamos** seus dados pessoais com terceiros para fins de marketing.`,
  },
  {
    title: '6. Armazenamento e segurança',
    content: `Seus dados são armazenados em servidores seguros com as seguintes medidas de proteção:

• Criptografia em trânsito (HTTPS/TLS).
• Controle de acesso baseado em função (RBAC).
• Backups periódicos.
• Monitoramento de acessos.

Os dados são mantidos pelo tempo necessário para cumprir as finalidades descritas nesta Política ou conforme exigido por lei. Dados de contato e matrícula são mantidos por no mínimo 5 anos após o encerramento da relação, conforme legislação educacional.`,
  },
  {
    title: '7. Cookies',
    content: `Este site utiliza cookies para:

• **Cookies essenciais**: necessários para o funcionamento do site (autenticação, preferências de sessão).
• **Cookies de desempenho**: para análise de uso e melhoria da experiência (ex.: Google Analytics, quando ativo).

Você pode configurar seu navegador para recusar cookies, mas algumas funcionalidades do site poderão ficar indisponíveis.`,
  },
  {
    title: '8. Direitos do titular',
    content: `Nos termos da LGPD, você tem direito a:

• **Confirmação e acesso**: saber se tratamos seus dados e acessar uma cópia.
• **Correção**: solicitar a correção de dados incompletos, inexatos ou desatualizados.
• **Anonimização, bloqueio ou eliminação**: de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD.
• **Portabilidade**: solicitar a transferência dos seus dados a outro fornecedor de serviço.
• **Eliminação**: dos dados tratados com base no consentimento, quando aplicável.
• **Informação**: sobre as entidades com as quais seus dados são compartilhados.
• **Revogação do consentimento**: a qualquer momento, sem prejuízo da legalidade do tratamento já realizado.
• **Oposição**: ao tratamento realizado com base em legítimo interesse, se aplicável.

Para exercer seus direitos, entre em contato pelo e-mail **privacidade@colegiobatistacaruaru.com.br** ou pelo telefone **(81) 3721-4787**.`,
  },
  {
    title: '9. Dados de menores',
    content: `Não coletamos dados pessoais diretamente de crianças e adolescentes através deste site. Os dados de alunos menores de idade são fornecidos exclusivamente por seus pais ou responsáveis legais durante o processo de matrícula, com o consentimento expresso destes.`,
  },
  {
    title: '10. Alterações nesta Política',
    content: `Esta Política de Privacidade pode ser atualizada periodicamente. Recomendamos que você a consulte regularmente. Alterações significativas serão comunicadas de forma destacada no site.`,
  },
  {
    title: '11. Contato e Encarregado (DPO)',
    content: `Para dúvidas, solicitações ou reclamações sobre o tratamento de dados pessoais:

• **E-mail**: privacidade@colegiobatistacaruaru.com.br
• **Telefone**: (81) 3721-4787
• **Endereço**: Rua Marcílio Dias, 99, São Francisco, Caruaru/PE

Caso não obtenha resposta satisfatória, você pode apresentar reclamação à **Autoridade Nacional de Proteção de Dados (ANPD)** em [gov.br/anpd](https://www.gov.br/anpd).`,
  },
];

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    const formatted = line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-brand-primary underline hover:text-brand-secondary">$1</a>');
    if (line.startsWith('•')) {
      return (
        <li
          key={i}
          className="ml-4 pl-2 relative before:content-[''] before:absolute before:left-[-12px] before:top-[10px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-brand-secondary"
          dangerouslySetInnerHTML={{ __html: formatted.replace('• ', '') }}
        />
      );
    }
    if (line.trim() === '') return <br key={i} />;
    return <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: formatted }} />;
  });
}

export default function PoliticaPrivacidade() {
  const bodyRef = useScrollReveal();

  return (
    <div className="min-h-screen">

      {/* ── Hero ── */}
      <section className="relative h-[40vh] min-h-[300px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary via-brand-primary to-brand-primary-dark" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-[var(--surface)] [clip-path:polygon(0_100%,100%_0,100%_100%)] z-10" />

        <div className="relative z-[5] container mx-auto px-4 h-full flex items-center">
          <div className="max-w-3xl">
            <div className="hero-badge inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-8">
              <Shield className="w-3.5 h-3.5 text-brand-secondary" />
              <span className="text-white/90 text-sm font-medium tracking-wide">LGPD</span>
            </div>
            <h1 className="hero-text-1 font-display text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-[0.95] mb-6 tracking-tight">
              Política de{' '}
              <span className="italic text-brand-secondary">Privacidade</span>
            </h1>
            <div className="hero-accent-line h-[3px] bg-gradient-to-r from-brand-secondary to-brand-secondary-light rounded-full mb-8" />
            <p className="hero-text-2 text-base md:text-lg text-white/70">
              Última atualização: {LAST_UPDATE}
            </p>
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <section className="py-16 bg-[var(--surface)]">
        <div ref={bodyRef} className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">

            <div
              className="bg-white rounded-2xl shadow-lg shadow-brand-primary/5 border border-gray-100 p-8 md:p-12"
              data-reveal="up"
            >
              <p className="text-gray-600 text-sm leading-relaxed mb-10 pb-8 border-b border-gray-100">
                O Colégio Batista em Caruaru respeita a sua privacidade e está comprometido
                com a proteção dos seus dados pessoais. Esta Política descreve como coletamos,
                utilizamos, armazenamos e protegemos suas informações, em conformidade com a
                Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018).
              </p>

              <div className="space-y-10">
                {SECTIONS.map(({ title, content }) => (
                  <div key={title}>
                    <h2 className="font-display text-xl font-bold text-brand-primary mb-4">
                      {title}
                    </h2>
                    <div className="text-gray-600 text-sm leading-relaxed space-y-1">
                      {renderMarkdown(content)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="text-center mt-12" data-reveal="up" style={{ '--delay': '0.1s' } as React.CSSProperties}>
              <p className="text-gray-400 text-sm mb-4">
                Tem alguma dúvida sobre seus dados?
              </p>
              <Link
                to="/contato"
                className="inline-flex items-center gap-2 bg-brand-primary text-white px-8 py-4 rounded-full font-bold text-sm hover:bg-brand-primary-dark transition-all duration-300 hover:shadow-lg hover:shadow-brand-primary/25"
              >
                Fale conosco
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
