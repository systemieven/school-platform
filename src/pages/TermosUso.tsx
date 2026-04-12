/**
 * Termos de Uso — Texto-base para validação jurídica.
 */

import { Link } from 'react-router-dom';
import { FileText, ArrowRight } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';

const LAST_UPDATE = '06 de abril de 2026';

const SECTIONS = [
  {
    title: '1. Aceitação dos termos',
    content: `Ao acessar e utilizar o site do Colégio Batista em Caruaru ("Site"), você declara que leu, compreendeu e concorda com estes Termos de Uso. Caso não concorde com qualquer disposição, solicitamos que interrompa imediatamente o uso do Site.

O uso continuado do Site após a publicação de alterações nestes Termos constitui aceitação tácita das modificações.`,
  },
  {
    title: '2. Sobre o site',
    content: `Este Site é mantido pelo **Colégio Batista em Caruaru**, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 01.873.279/0002-61, com sede na Rua Marcílio Dias, 99, São Francisco, Caruaru/PE.

O Site tem como finalidade:

• Apresentar informações institucionais sobre o Colégio e seus segmentos educacionais.
• Disponibilizar formulários de contato e pré-matrícula.
• Permitir o agendamento de visitas presenciais.
• Publicar depoimentos de pais e responsáveis previamente aprovados.
• Divulgar eventos, projetos pedagógicos e comunicados institucionais.`,
  },
  {
    title: '3. Propriedade intelectual',
    content: `Todo o conteúdo disponível neste Site — incluindo, mas não se limitando a textos, imagens, fotografias, logotipos, marcas, vídeos, layouts, design gráfico, ícones e código-fonte — é de propriedade exclusiva do Colégio Batista em Caruaru ou de seus licenciadores, sendo protegido pela legislação brasileira de propriedade intelectual (Lei nº 9.610/1998 — Direitos Autorais; Lei nº 9.279/1996 — Propriedade Industrial).

É expressamente proibido, sem autorização prévia e por escrito:

• Reproduzir, copiar, distribuir ou modificar qualquer conteúdo do Site.
• Utilizar a marca, logotipo ou identidade visual do Colégio para fins comerciais ou não autorizados.
• Realizar engenharia reversa, descompilar ou extrair o código-fonte do Site.
• Criar obras derivadas com base no conteúdo do Site.`,
  },
  {
    title: '4. Uso permitido',
    content: `O usuário está autorizado a:

• Acessar o Site para consulta de informações institucionais.
• Utilizar os formulários disponíveis (contato, pré-matrícula, agendamento de visitas) para as finalidades a que se destinam.
• Compartilhar links de páginas do Site em redes sociais, desde que sem alteração do conteúdo.

O uso do Site deve respeitar a legislação vigente, a moral, os bons costumes e a ordem pública.`,
  },
  {
    title: '5. Responsabilidades do usuário',
    content: `Ao utilizar o Site, o usuário se compromete a:

• Fornecer informações verdadeiras, completas e atualizadas nos formulários disponíveis.
• Não utilizar o Site para fins ilícitos, fraudulentos ou que violem direitos de terceiros.
• Não enviar conteúdo ofensivo, difamatório, discriminatório, ilegal ou que viole direitos de privacidade.
• Não tentar acessar áreas restritas do Site sem autorização.
• Não utilizar robôs, scrapers ou mecanismos automatizados para extrair dados do Site.
• Não praticar qualquer ação que possa comprometer a segurança, estabilidade ou disponibilidade do Site.

O Colégio reserva-se o direito de bloquear ou restringir o acesso de qualquer usuário que descumpra estes Termos.`,
  },
  {
    title: '6. Depoimentos e conteúdo gerado pelo usuário',
    content: `Os depoimentos enviados por pais e responsáveis através do Site passam por um processo de moderação antes da publicação. Ao enviar um depoimento, o usuário:

• Declara que o conteúdo é de sua autoria e representa sua opinião pessoal.
• Autoriza o Colégio a publicar, reproduzir e utilizar o depoimento para fins institucionais, sem limite de tempo ou território.
• Compreende que o Colégio pode, a seu critério, não publicar ou remover o depoimento a qualquer momento.
• Garante que o conteúdo não viola direitos de terceiros, não contém informações falsas e não possui caráter ofensivo ou discriminatório.

O Colégio não se responsabiliza pelo conteúdo dos depoimentos publicados, que representam exclusivamente a opinião de seus autores.`,
  },
  {
    title: '7. Agendamento de visitas',
    content: `O serviço de agendamento de visitas disponível no Site está sujeito às seguintes condições:

• Os horários disponíveis são apresentados em tempo real e estão sujeitos a alterações sem aviso prévio.
• O agendamento não garante a realização da visita, podendo o Colégio reagendar ou cancelar por motivos operacionais, mediante comunicação prévia ao visitante.
• O visitante deve apresentar documento de identificação com foto no ato da visita.
• Acompanhantes devem ser informados no momento do agendamento e estão limitados a 3 (três) pessoas.
• O Colégio reserva-se o direito de suspender temporariamente o serviço de agendamento online.`,
  },
  {
    title: '8. Limitação de responsabilidade',
    content: `O Colégio Batista em Caruaru empenha-se para manter as informações do Site atualizadas e precisas, mas **não garante** que:

• O conteúdo do Site esteja livre de erros, omissões ou desatualizações.
• O Site esteja disponível de forma ininterrupta e livre de falhas técnicas.
• O Site esteja imune a vírus ou outros componentes prejudiciais.

O Colégio **não se responsabiliza** por:

• Danos diretos, indiretos, incidentais ou consequenciais decorrentes do uso ou impossibilidade de uso do Site.
• Decisões tomadas com base exclusivamente nas informações disponíveis no Site.
• Conteúdo de sites de terceiros acessados por meio de links disponíveis no Site.
• Problemas de conexão, equipamento ou software do usuário.`,
  },
  {
    title: '9. Links para sites de terceiros',
    content: `Este Site pode conter links para sites de terceiros (redes sociais, órgãos públicos, parceiros). Esses links são disponibilizados apenas para conveniência do usuário.

O Colégio não controla, endossa ou se responsabiliza pelo conteúdo, políticas de privacidade ou práticas de sites de terceiros. Recomendamos a leitura dos termos de uso e políticas de privacidade de cada site que você acessar.`,
  },
  {
    title: '10. Disponibilidade e modificações do site',
    content: `O Colégio reserva-se o direito de, a qualquer momento e sem aviso prévio:

• Modificar, suspender ou descontinuar qualquer funcionalidade do Site.
• Alterar o design, layout ou estrutura do Site.
• Atualizar estes Termos de Uso.

Alterações significativas nestes Termos serão comunicadas de forma destacada no Site. O uso continuado após as alterações constitui aceitação dos novos termos.`,
  },
  {
    title: '11. Privacidade e proteção de dados',
    content: `O tratamento de dados pessoais coletados por meio deste Site é regido pela nossa [Política de Privacidade](/politica-privacidade), que integra estes Termos de Uso e descreve detalhadamente como seus dados são coletados, utilizados, armazenados e protegidos, em conformidade com a LGPD (Lei nº 13.709/2018).`,
  },
  {
    title: '12. Legislação aplicável e foro',
    content: `Estes Termos de Uso são regidos pela legislação da República Federativa do Brasil.

Fica eleito o foro da Comarca de Caruaru, Estado de Pernambuco, para dirimir quaisquer questões oriundas destes Termos, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`,
  },
  {
    title: '13. Contato',
    content: `Para dúvidas, sugestões ou reclamações sobre estes Termos de Uso:

• **E-mail**: contato@colegiobatistacaruaru.com.br
• **Telefone**: (81) 3721-4787
• **Endereço**: Rua Marcílio Dias, 99, São Francisco, Caruaru/PE`,
  },
];

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    const formatted = line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(
        /\[(.+?)\]\((.+?)\)/g,
        '<a href="$2" class="text-brand-primary underline hover:text-brand-secondary">$1</a>',
      );
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

export default function TermosUso() {
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
              <FileText className="w-3.5 h-3.5 text-brand-secondary" />
              <span className="text-white/90 text-sm font-medium tracking-wide">LEGAL</span>
            </div>
            <h1 className="hero-text-1 font-display text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-[0.95] mb-6 tracking-tight">
              Termos de{' '}
              <span className="italic text-brand-secondary">Uso</span>
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
                Estes Termos de Uso regulam o acesso e a utilização do site do Colégio Batista em
                Caruaru. Ao navegar pelo site, você concorda com as condições aqui estabelecidas.
                Leia atentamente antes de prosseguir.
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
                Tem alguma dúvida sobre nossos termos?
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
