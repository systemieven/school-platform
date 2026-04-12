
interface FontOption {
  family: string;
  category: 'Sans-serif' | 'Serif';
}

const FONT_OPTIONS: FontOption[] = [
  // Sans-serif
  { family: 'Inter', category: 'Sans-serif' },
  { family: 'Sora', category: 'Sans-serif' },
  { family: 'Poppins', category: 'Sans-serif' },
  { family: 'Nunito', category: 'Sans-serif' },
  { family: 'Lato', category: 'Sans-serif' },
  { family: 'Roboto', category: 'Sans-serif' },
  { family: 'Open Sans', category: 'Sans-serif' },
  { family: 'Montserrat', category: 'Sans-serif' },
  { family: 'Raleway', category: 'Sans-serif' },
  { family: 'Source Sans 3', category: 'Sans-serif' },
  { family: 'DM Sans', category: 'Sans-serif' },
  { family: 'Work Sans', category: 'Sans-serif' },
  // Serif
  { family: 'Playfair Display', category: 'Serif' },
  { family: 'Merriweather', category: 'Serif' },
  { family: 'Lora', category: 'Serif' },
  { family: 'Cormorant Garamond', category: 'Serif' },
  { family: 'Crimson Text', category: 'Serif' },
  { family: 'EB Garamond', category: 'Serif' },
];

export function buildGoogleFontsUrl(families: string[]): string {
  const unique = [...new Set(families)];
  const params = unique
    .map((f) => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

let fontsInjected = false;

function injectFonts() {
  if (fontsInjected) return;
  fontsInjected = true;

  const url = buildGoogleFontsUrl(FONT_OPTIONS.map((o) => o.family));
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

injectFonts();

interface FontPickerProps {
  value: string;
  onChange: (family: string) => void;
  label?: string;
}

export default function FontPicker({ value, onChange, label }: FontPickerProps) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          {label}
        </label>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {FONT_OPTIONS.map((font) => {
          const selected = value === font.family;
          return (
            <button
              key={font.family}
              type="button"
              onClick={() => onChange(font.family)}
              className={`rounded-xl border px-3 py-3 text-left transition-all duration-200 ${
                selected
                  ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20 ring-2 ring-brand-primary/30 border-brand-primary'
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-brand-primary/40 hover:bg-brand-primary/5 text-gray-700 dark:text-gray-300'
              }`}
            >
              <span
                className="text-sm font-medium block"
                style={{ fontFamily: font.family }}
              >
                {font.family}
              </span>
              <span
                className={`text-[10px] ${
                  selected ? 'text-white/60' : 'text-gray-400'
                }`}
              >
                {font.category}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
