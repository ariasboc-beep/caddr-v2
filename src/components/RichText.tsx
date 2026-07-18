import React, { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Underline, Strikethrough, Smile, List, ListOrdered, ListChecks, Link2, Image as ImageIcon } from 'lucide-react';

const EMOJIS = ['😀','😄','😊','😍','🤔','😎','😇','🥳','😴','😅','🙌','👍','👏','💪','🙏','🔥','⚡','✨','🌟','⭐','🎯','✅','❌','⚠️','💡','📌','📈','📉','🚀','🌱','🌿','☕','🏃','🧘','💧','🍎','😤','😌','❤️','💛','💚','💙','💜','🧠','⏰','📅'];

const ALLOWED = new Set(['B','STRONG','I','EM','U','S','STRIKE','BR','DIV','P','SPAN','UL','OL','LI','A','IMG']);
const SKIP = new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED']);

const safeUrl = (u: string | null) => (u && /^https?:\/\//i.test(u.trim())) ? u.trim() : '';
const escAttr = (s: string) => s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// Assainit le HTML : liste blanche de balises ; seuls href/src en http(s) sont conservés.
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
        if (SKIP.has(tag)) return;
        if (!ALLOWED.has(tag)) { out += walk(el); return; }
        if (tag === 'BR') { out += '<br>'; return; }
        if (tag === 'IMG') {
          const src = safeUrl(el.getAttribute('src'));
          if (src) out += `<img src="${escAttr(src)}" />`;
          return;
        }
        if (tag === 'A') {
          const href = safeUrl(el.getAttribute('href'));
          if (href) out += `<a href="${escAttr(href)}" target="_blank" rel="noopener noreferrer">${walk(el)}</a>`;
          else out += walk(el);
          return;
        }
        out += `<${tag.toLowerCase()}>${walk(el)}</${tag.toLowerCase()}>`;
      }
    });
    return out;
  };
  return walk(doc.body);
}

// Retire toutes les balises → texte brut (aperçus tronqués).
export function stripHtml(html: string): string {
  return sanitizeHtml(html || '').replace(/<[^>]*>/g, '').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
}

const RichText: React.FC<Props> = ({ value, onChange, onBlur, placeholder, className = '', minHeight = 120 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const lastEmitted = useRef<string>('');

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

  const cmd = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const insertEmoji = (emoji: string) => {
    ref.current?.focus();
    document.execCommand('insertText', false, emoji);
    setShowEmoji(false);
    emit();
  };

  const addLink = () => {
    const url = window.prompt('Adresse du lien (https://…)');
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { window.alert('Le lien doit commencer par http:// ou https://'); return; }
    ref.current?.focus();
    const sel = window.getSelection();
    if (sel && sel.toString()) {
      document.execCommand('createLink', false, url);
    } else {
      document.execCommand('insertHTML', false, `<a href="${escAttr(url)}">${escAttr(url)}</a>&nbsp;`);
    }
    emit();
  };

  const addImage = () => {
    const url = window.prompt('URL de l\u2019image (https://…)');
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { window.alert('L\u2019image doit \u00eatre une URL http:// ou https://'); return; }
    ref.current?.focus();
    document.execCommand('insertImage', false, url);
    emit();
  };

  const addChecklist = () => {
    ref.current?.focus();
    document.execCommand('insertText', false, '\u2610 ');
    emit();
  };

  // Clic sur une case ☐/☑ → bascule
  const onEditorClick = () => {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || sel.anchorNode.nodeType !== 3) return;
    const node = sel.anchorNode as Text;
    const text = node.textContent || '';
    const off = sel.anchorOffset;
    for (const i of [off - 1, off]) {
      if (i >= 0 && i < text.length && (text[i] === '\u2610' || text[i] === '\u2611')) {
        node.textContent = text.slice(0, i) + (text[i] === '\u2610' ? '\u2611' : '\u2610') + text.slice(i + 1);
        emit();
        return;
      }
    }
  };

  const isEmpty = !value || value === '<br>' || value.replace(/<[^>]*>/g, '').trim() === '';
  const btn = "p-2 rounded-lg text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:bg-accent hover:text-white transition-all";
  const sep = <span className="w-px h-5 bg-[#18181B]/10 dark:bg-[#E6E8E6]/10 mx-0.5" />;

  return (
    <div className={`bg-[#18181B]/5 dark:bg-[#080708] rounded-[1.5rem] border border-[#18181B]/5 dark:border-[#E6E8E6]/5 focus-within:border-accent ${className}`}>
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-[#18181B]/5 dark:border-[#E6E8E6]/5 relative">
        <button type="button" onMouseDown={(e)=>{e.preventDefault();cmd('bold');}} className={btn} title="Gras"><Bold size={15}/></button>
        <button type="button" onMouseDown={(e)=>{e.preventDefault();cmd('italic');}} className={btn} title="Italique"><Italic size={15}/></button>
        <button type="button" onMouseDown={(e)=>{e.preventDefault();cmd('underline');}} className={btn} title="Souligné"><Underline size={15}/></button>
        <button type="button" onMouseDown={(e)=>{e.preventDefault();cmd('strikeThrough');}} className={btn} title="Barré"><Strikethrough size={15}/></button>
        {sep}
        <button type="button" onMouseDown={(e)=>{e.preventDefault();cmd('insertUnorderedList');}} className={btn} title="Liste à puces"><List size={15}/></button>
        <button type="button" onMouseDown={(e)=>{e.preventDefault();cmd('insertOrderedList');}} className={btn} title="Liste numérotée"><ListOrdered size={15}/></button>
        <button type="button" onMouseDown={(e)=>{e.preventDefault();addChecklist();}} className={btn} title="Case à cocher (cliquez la case pour la cocher)"><ListChecks size={15}/></button>
        {sep}
        <button type="button" onMouseDown={(e)=>{e.preventDefault();addLink();}} className={btn} title="Lien"><Link2 size={15}/></button>
        <button type="button" onMouseDown={(e)=>{e.preventDefault();addImage();}} className={btn} title="Image (URL)"><ImageIcon size={15}/></button>
        <button type="button" onMouseDown={(e)=>{e.preventDefault();setShowEmoji(v=>!v);}} className={btn} title="Émoji"><Smile size={15}/></button>

        {showEmoji && (
          <div className="absolute top-full left-0 mt-1 z-30 bg-white dark:bg-[#111] rounded-2xl shadow-2xl border border-[#18181B]/10 dark:border-[#E6E8E6]/10 p-2 grid grid-cols-8 gap-1 w-64 max-h-40 overflow-y-auto custom-scrollbar">
            {EMOJIS.map((e)=>(<button key={e} type="button" onMouseDown={(ev)=>{ev.preventDefault();insertEmoji(e);}} className="text-lg hover:bg-accent/10 rounded-lg p-0.5 transition-all">{e}</button>))}
          </div>
        )}
      </div>

      <div className="relative">
        {isEmpty && placeholder && (
          <div className="absolute top-3 left-4 text-sm text-[#18181B]/30 dark:text-[#E6E8E6]/30 font-medium pointer-events-none">{placeholder}</div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onClick={onEditorClick}
          onBlur={()=>{emit();onBlur?.();}}
          className="px-4 py-3 text-sm font-medium text-[#18181B] dark:text-[#E6E8E6] outline-none leading-relaxed overflow-y-auto [&_b]:font-black [&_strong]:font-black [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-accent [&_a]:underline [&_img]:max-w-full [&_img]:rounded-xl [&_img]:my-2"
          style={{ minHeight, maxHeight: minHeight * 3 }}
        />
      </div>
    </div>
  );
};

export const RichTextView: React.FC<{ html: string; className?: string }> = ({ html, className = '' }) => (
  <div
    className={`whitespace-pre-wrap break-words [&_b]:font-black [&_strong]:font-black [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-accent [&_a]:underline [&_img]:max-w-full [&_img]:rounded-xl [&_img]:my-2 ${className}`}
    dangerouslySetInnerHTML={{ __html: sanitizeHtml(html || '') }}
  />
);

export default RichText;
