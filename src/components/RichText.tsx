import React, { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Underline, Strikethrough, Smile } from 'lucide-react';

const EMOJIS = ['😀','😄','😊','😍','🤔','😎','😇','🥳','😴','😅','🙌','👍','👏','💪','🙏','🔥','⚡','✨','🌟','⭐','🎯','✅','❌','⚠️','💡','📌','📈','📉','🚀','🌱','🌿','☕','🏃','🧘','💧','🍎','😤','😌','❤️','💛','💚','💙','💜','🧠','⏰','📅'];

const ALLOWED = new Set(['B','STRONG','I','EM','U','S','STRIKE','BR','DIV','P','SPAN']);

// Assainit le HTML : ne garde qu'une liste blanche de balises, sans aucun attribut.
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = (node: Node): string => {
    let out = '';
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += (child.textContent || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName;
        if (ALLOWED.has(tag)) {
          if (tag === 'BR') { out += '<br>'; }
          else { out += `<${tag.toLowerCase()}>${walk(el)}</${tag.toLowerCase()}>`; }
        } else {
          out += walk(el); // balise interdite : on garde le contenu, pas la balise
        }
      }
    });
    return out;
  };
  return walk(doc.body);
}

// Retire toutes les balises → texte brut (pour les aperçus tronqués).
export function stripHtml(html: string): string {
  return sanitizeHtml(html || '').replace(/<[^>]*>/g, '');
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
}

const RichText: React.FC<Props> = ({ value, onChange, onBlur, placeholder, className = '', minHeight = 80 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const lastEmitted = useRef<string>('');

  // Synchronise le contenu seulement quand la valeur externe change (évite le saut de curseur)
  useEffect(() => {
    if (ref.current && value !== lastEmitted.current) {
      ref.current.innerHTML = sanitizeHtml(value || '');
      lastEmitted.current = value || '';
    }
  }, [value]);

  const emit = () => {
    if (!ref.current) return;
    const clean = sanitizeHtml(ref.current.innerHTML);
    lastEmitted.current = clean;
    onChange(clean);
  };

  const cmd = (command: string) => {
    ref.current?.focus();
    document.execCommand(command, false);
    emit();
  };

  const insertEmoji = (emoji: string) => {
    ref.current?.focus();
    document.execCommand('insertText', false, emoji);
    setShowEmoji(false);
    emit();
  };

  const isEmpty = !value || value === '<br>' || value.replace(/<[^>]*>/g, '').trim() === '';

  const btn = "p-2 rounded-lg text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:bg-accent hover:text-white transition-all";

  return (
    <div className={`bg-[#18181B]/5 dark:bg-[#080708] rounded-[1.5rem] border border-[#18181B]/5 dark:border-[#E6E8E6]/5 focus-within:border-accent ${className}`}>
      {/* Barre d'outils */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[#18181B]/5 dark:border-[#E6E8E6]/5 relative">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd('bold'); }} className={btn} title="Gras"><Bold size={15} /></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd('italic'); }} className={btn} title="Italique"><Italic size={15} /></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd('underline'); }} className={btn} title="Souligné"><Underline size={15} /></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd('strikeThrough'); }} className={btn} title="Barré"><Strikethrough size={15} /></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); setShowEmoji(v => !v); }} className={btn} title="Émoji"><Smile size={15} /></button>

        {showEmoji && (
          <div className="absolute top-full left-0 mt-1 z-30 bg-white dark:bg-[#111] rounded-2xl shadow-2xl border border-[#18181B]/10 dark:border-[#E6E8E6]/10 p-2 grid grid-cols-8 gap-1 w-64 max-h-40 overflow-y-auto custom-scrollbar">
            {EMOJIS.map((e) => (
              <button key={e} type="button" onMouseDown={(ev) => { ev.preventDefault(); insertEmoji(e); }} className="text-lg hover:bg-accent/10 rounded-lg p-0.5 transition-all">{e}</button>
            ))}
          </div>
        )}
      </div>

      {/* Zone éditable */}
      <div className="relative">
        {isEmpty && placeholder && (
          <div className="absolute top-3 left-4 text-sm text-[#18181B]/30 dark:text-[#E6E8E6]/30 font-medium pointer-events-none">{placeholder}</div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={() => { emit(); onBlur?.(); }}
          className="px-4 py-3 text-sm font-medium text-[#18181B] dark:text-[#E6E8E6] outline-none leading-relaxed [&_b]:font-black [&_strong]:font-black"
          style={{ minHeight }}
        />
      </div>
    </div>
  );
};

// Affichage en lecture seule du contenu enrichi (assaini).
export const RichTextView: React.FC<{ html: string; className?: string }> = ({ html, className = '' }) => (
  <div
    className={`whitespace-pre-wrap break-words [&_b]:font-black [&_strong]:font-black ${className}`}
    dangerouslySetInnerHTML={{ __html: sanitizeHtml(html || '') }}
  />
);

export default RichText;
