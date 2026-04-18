/**
 * HtmlTemplateEditor — WYSIWYG reutilizavel para templates HTML com
 * interpolacao `{{variavel}}` (Sprint 12 TV-1).
 *
 * Usado pelos editores de `contract_templates` e `document_templates`.
 * Saida e HTML limpo, compativel com o renderer atual
 * (`dangerouslySetInnerHTML` em preview + regex no `generate-document`).
 *
 * - Toolbar: fonte, bold, italic, underline, H1/H2/H3, listas, alinhamento,
 *   recuo de parágrafo, cor da fonte (paleta de marca), link, clear formatting.
 * - Chips de variaveis: clicaveis, inserem `{{key}}` na posicao do cursor.
 * - As cores da paleta vêm de `useBranding()` → primary/primary_dark/secondary/
 *   secondary_light definidos em /admin/configuracoes > site > marca.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Extension } from '@tiptap/core';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle, FontFamily, Color } from '@tiptap/extension-text-style';
import { useBranding } from '../../contexts/BrandingContext';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  RemoveFormatting,
  Undo2,
  Redo2,
  Code2,
  IndentIncrease,
  IndentDecrease,
  Palette,
  ChevronDown,
} from 'lucide-react';

// ── Fontes padrão ────────────────────────────────────────────────────────────
// Stacks web-safe com fallback — mesmo não estando o arquivo da fonte carregado,
// o navegador do usuário usa a fonte de sistema equivalente.
const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Padrão',         value: '' },
  { label: 'Arial',          value: 'Arial, sans-serif' },
  { label: 'Helvetica',      value: 'Helvetica, Arial, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Georgia',        value: 'Georgia, serif' },
  { label: 'Garamond',       value: 'Garamond, serif' },
  { label: 'Courier New',    value: '"Courier New", Courier, monospace' },
  { label: 'Verdana',        value: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma',         value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Trebuchet MS',   value: '"Trebuchet MS", sans-serif' },
  { label: 'Calibri',        value: 'Calibri, "Segoe UI", sans-serif' },
  { label: 'Lato',           value: 'Lato, sans-serif' },
  { label: 'Roboto',         value: 'Roboto, sans-serif' },
  { label: 'Open Sans',      value: '"Open Sans", sans-serif' },
];

// ── Indent extension ─────────────────────────────────────────────────────────
// Adiciona atributo `indent` (0-8) em `paragraph` e `heading`, renderizando
// como `margin-left: N*32px`. Preserva o recuo na serialização HTML, garantindo
// que o template impresso mantenha a indentação quando renderizado via
// `dangerouslySetInnerHTML` no preview ou no generate-document.
const MAX_INDENT = 8;
const INDENT_STEP_PX = 32;
const IndentExtension = Extension.create({
  name: 'paragraphIndent',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => {
              const ml = (el as HTMLElement).style?.marginLeft || '';
              const match = ml.match(/(-?\d+)px/);
              return match ? Math.min(Math.max(Math.round(parseInt(match[1], 10) / INDENT_STEP_PX), 0), MAX_INDENT) : 0;
            },
            renderHTML: (attrs) => {
              const n = Number(attrs.indent) || 0;
              return n > 0 ? { style: `margin-left: ${n * INDENT_STEP_PX}px` } : {};
            },
          },
        },
      },
    ];
  },
});

export interface TemplateVariable {
  key: string;
  label?: string;
}

export interface HtmlTemplateEditorProps {
  value: string;
  onChange: (html: string) => void;
  variables?: TemplateVariable[];
  placeholder?: string;
  /**
   * Altura mínima do editor. Número = pixels; string = valor CSS literal
   * (útil pra `calc(100vh - …)` quando o drawer precisa preencher a tela).
   */
  minHeight?: number | string;
  /** Quando true esconde a seção de variáveis. */
  hideVariables?: boolean;
  /** Classes extras no wrapper. */
  className?: string;
}

export default function HtmlTemplateEditor({
  value,
  onChange,
  variables,
  placeholder,
  minHeight = 320,
  hideVariables,
  className,
}: HtmlTemplateEditorProps) {
  const { colors } = useBranding();
  const [colorOpen, setColorOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement | null>(null);

  // Paleta: preto + brand colors + cinzas neutros. Fecha ao clicar fora.
  const colorSwatches = useMemo(
    () => [
      { label: 'Preto',             value: '#000000' },
      { label: 'Cinza escuro',      value: '#374151' },
      { label: 'Cinza',             value: '#6B7280' },
      { label: 'Branco',            value: '#FFFFFF' },
      { label: 'Primária',          value: colors.primary },
      { label: 'Primária escura',   value: colors.primary_dark },
      { label: 'Secundária',        value: colors.secondary },
      { label: 'Secundária clara',  value: colors.secondary_light },
    ],
    [colors.primary, colors.primary_dark, colors.secondary, colors.secondary_light],
  );

  useEffect(() => {
    if (!colorOpen) return;
    const handler = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setColorOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorOpen]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Escreva o conteúdo do template…',
      }),
      // TextStyle precede Color e FontFamily — ambos dependem do mark
      // `textStyle` pra aplicar `style` inline em spans.
      TextStyle,
      FontFamily.configure({ types: ['textStyle'] }),
      Color.configure({ types: ['textStyle'] }),
      IndentExtension,
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none px-4 py-3',
        style: `min-height:${typeof minHeight === 'number' ? `${minHeight}px` : minHeight}`,
      },
    },
  });

  // Sincroniza value externo quando o editor está montado e o conteudo diverge.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const chips = useMemo(
    () => (variables ?? []).filter((v) => v && v.key),
    [variables],
  );

  const insertVariable = (key: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(`{{${key}}}`).run();
  };

  const promptLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL do link', previous ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  // ── Indent helpers ──
  const bumpIndent = (delta: 1 | -1) => {
    if (!editor) return;
    const nodeType = editor.isActive('heading') ? 'heading' : 'paragraph';
    const current = Number(editor.getAttributes(nodeType).indent) || 0;
    const next = Math.min(Math.max(current + delta, 0), MAX_INDENT);
    editor.chain().focus().updateAttributes(nodeType, { indent: next }).run();
  };

  if (!editor) return null;

  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden ${className ?? ''}`}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
        {/* Font family */}
        <select
          value={(editor.getAttributes('textStyle').fontFamily as string) || ''}
          onChange={(e) => {
            const v = e.target.value;
            if (v) editor.chain().focus().setFontFamily(v).run();
            else editor.chain().focus().unsetFontFamily().run();
          }}
          title="Fonte"
          className="h-8 px-2 pr-6 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 hover:border-brand-primary focus:outline-none focus:border-brand-primary appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%239ca3af%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-no-repeat bg-[right_0.35rem_center] bg-[length:12px_12px]"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.label} value={f.value} style={{ fontFamily: f.value || undefined }}>
              {f.label}
            </option>
          ))}
        </select>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Negrito (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Itálico (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Sublinhado (Ctrl+U)"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Título 1"
        >
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Título 2"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Título 3"
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Lista"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Lista numerada"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          title="Alinhar à esquerda"
        >
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          title="Centralizar"
        >
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
          title="Alinhar à direita"
        >
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Indent */}
        <ToolbarButton
          onClick={() => bumpIndent(-1)}
          title="Diminuir recuo"
        >
          <IndentDecrease className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => bumpIndent(1)}
          title="Aumentar recuo"
        >
          <IndentIncrease className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Cor da fonte */}
        <div className="relative" ref={colorRef}>
          <button
            type="button"
            onClick={() => setColorOpen((o) => !o)}
            title="Cor da fonte"
            className="flex items-center gap-0.5 h-8 px-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Palette className="w-4 h-4" />
            {/* Faixinha da cor ativa abaixo do ícone */}
            <span
              className="w-3 h-1 rounded-sm border border-gray-200 dark:border-gray-700"
              style={{ background: (editor.getAttributes('textStyle').color as string) || '#000000' }}
              aria-hidden
            />
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
          {colorOpen && (
            <div className="absolute top-full left-0 mt-1 z-30 w-56 p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-1 pb-1.5">
                Cor da fonte
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {colorSwatches.map((s) => {
                  const active = (editor.getAttributes('textStyle').color as string | undefined)?.toLowerCase() === s.value.toLowerCase();
                  return (
                    <button
                      key={s.value}
                      type="button"
                      title={s.label}
                      onClick={() => {
                        editor.chain().focus().setColor(s.value).run();
                        setColorOpen(false);
                      }}
                      className={`group relative w-full aspect-square rounded-md border transition-all ${
                        active
                          ? 'border-brand-primary ring-2 ring-brand-primary/30'
                          : 'border-gray-200 dark:border-gray-600 hover:scale-110'
                      }`}
                      style={{ background: s.value }}
                    />
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetColor().run();
                  setColorOpen(false);
                }}
                className="mt-2 w-full py-1.5 text-[11px] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                Remover cor
              </button>
            </div>
          )}
        </div>

        <Divider />

        <ToolbarButton onClick={promptLink} active={editor.isActive('link')} title="Link">
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="Bloco de código"
        >
          <Code2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          title="Limpar formatação"
        >
          <RemoveFormatting className="w-4 h-4" />
        </ToolbarButton>

        <div className="flex-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Desfazer (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Refazer (Ctrl+Shift+Z)"
        >
          <Redo2 className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Variable chips */}
      {!hideVariables && chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/40">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mr-1">
            Variáveis
          </span>
          {chips.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(v.key)}
              title={`Inserir {{${v.key}}} no cursor`}
              className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-primary/10 dark:bg-brand-secondary/20 text-[11px] font-medium text-brand-primary dark:text-brand-secondary hover:bg-brand-primary/20 dark:hover:bg-brand-secondary/30 transition-colors"
            >
              {`{{${v.key}}}`}
              {v.label && (
                <span className="ml-1 text-gray-500 dark:text-gray-400 font-normal">
                  · {v.label}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
        active
          ? 'bg-brand-primary/15 text-brand-primary dark:bg-brand-secondary/25 dark:text-brand-secondary'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 w-px h-5 bg-gray-200 dark:bg-gray-700" aria-hidden />;
}
