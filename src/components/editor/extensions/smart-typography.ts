/**
 * Live, locale-aware typography as Tiptap input rules.
 *
 * Every rule is an ordinary Tiptap InputRule, so it is undoable right after it fires:
 *  - Backspace runs `undoInputRule` (restores exactly what was typed),
 *  - Cmd/Ctrl+Z undoes the conversion as a separate history step (Tiptap closes history before the rule).
 * Rules never fire inside code blocks or inline code (Tiptap skips those).
 *
 * The heavier, whole-document cleanup (no-break spaces, quote normalization, dashes in ranges…) is the
 * "Типограф" command (./typograph.ts) — live rules are deliberately conservative.
 */
import { Extension, InputRule, type ExtendedRegExpMatchArray } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import type { TextLanguage } from "@/lib/i18n/config";
import {
  NBSP,
  NNBSP,
  isSentenceStart,
  smartDoubleQuote,
  smartSingleQuote,
} from "@/lib/content/typography";

type Range = { from: number; to: number };
type Compute = (match: ExtendedRegExpMatchArray, ctx: { state: EditorState; range: Range; before: string }) => string | null;

/**
 * Build a rule replacing the whole match with `compute(...)`. `before` is the block text preceding the match.
 * Returning null (or the unchanged text) lets the keystroke through untouched.
 */
function rule(find: RegExp, compute: Compute): InputRule {
  return new InputRule({
    find,
    handler: ({ state, range, match }) => {
      const input = match.input ?? "";
      const before = input.slice(0, input.length - match[0].length);
      const out = compute(match, { state, range, before });
      if (out === null || out === match[0]) return null;
      state.tr.insertText(out, range.from, range.to);
    },
  });
}

/** Text right after the cursor in the current block (to avoid touching the middle of words). */
function textAfter(state: EditorState, pos: number): string {
  const $pos = state.doc.resolve(pos);
  return $pos.parent.textBetween($pos.parentOffset, $pos.parent.content.size, undefined, " ");
}

/** Is the cursor inside a link? (no capitalization / quote magic in URLs) */
function inLink(state: EditorState, pos: number): boolean {
  return state.doc
    .resolve(pos)
    .marks()
    .some((m) => m.type.name === "link");
}

export type SmartTypographyOptions = {
  /** The post language, read at keystroke time so changing «Язык текста» takes effect without a reload. */
  getLanguage: () => TextLanguage;
};

export const SmartTypography = Extension.create<SmartTypographyOptions>({
  name: "smartTypography",

  addOptions() {
    return { getLanguage: () => "ru" };
  },

  addInputRules() {
    const { getLanguage } = this.options;
    /** Run `compute` only for the given languages (the rule list is built once; the language can change). */
    const only =
      (langs: TextLanguage[], compute: Compute): Compute =>
      (m, ctx) =>
        langs.includes(getLanguage()) ? compute(m, ctx) : null;
    const dashSpace = () => (getLanguage() === "ru" ? NBSP : " ");

    return [
      // ── Quotes & apostrophes ──
      rule(/"$/, (_m, { before, state, range }) => (inLink(state, range.from) ? null : smartDoubleQuote(before, getLanguage()))),
      rule(/'$/, (_m, { before, state, range }) => (inLink(state, range.from) ? null : smartSingleQuote(before, getLanguage()))),

      // ── Dashes ──
      // "--" → "—" (with a no-break space before it in ru/uk when preceded by a space).
      rule(/( ?)--$/, (m) => (m[1] ? `${dashSpace()}—` : "—")),
      // "word - " → "word — " (ru/uk: no-break space before the dash).
      rule(/(\S) - $/, (m) => `${m[1]}${dashSpace()}— `),

      // ── Symbols ──
      rule(/\.\.\.$/, () => "…"),
      rule(/\((?:c|с)\)$/i, () => "©"),
      rule(/\(r\)$/i, () => "®"),
      rule(/\(tm\)$/i, () => "™"),
      rule(/->$/, () => "→"),
      rule(/<-$/, () => "←"),
      rule(/\+-$/, () => "±"),
      rule(/<<$/, () => (getLanguage() === "fr" ? `«${NNBSP}` : "«")),
      rule(/>>$/, () => (getLanguage() === "fr" ? `${NNBSP}»` : "»")),

      // ── Spacing ──
      // No space before , . ! ? (":" and ";" are left alone live because of smileys like " :)").
      // (French keeps — and normalizes — the space before ! ? ; : see below.)
      rule(/(\S)[ \u00A0]([,.!?])$/, (m) => {
        if (getLanguage() === "fr" && (m[2] === "!" || m[2] === "?")) return null;
        // After other punctuation (": .", "— .") the space is intentional (e.g. an ellipsis is coming).
        if (/[\p{P}\p{S}]/u.test(m[1])) return null;
        return `${m[1]}${m[2]}`;
      }),
      // French: narrow no-break space before ; : ! ? — typed with a space ("Oui !") or, for ! and ?, without one.
      // (":" and ";" typed right after a word stay as they are: URLs, times, smileys.)
      rule(
        /(\S)([ \u00A0\u202F]?)([!?;:])$/u,
        only(["fr"], (m) => {
          const [, prev, space, mark] = m;
          if (/[\s!?;:…]/u.test(prev)) return null;
          if (!space && (mark === ":" || mark === ";")) return null;
          if (/[\p{P}\p{S}]/u.test(prev) && !/[)»”]/.test(prev)) return null;
          return `${prev}${NNBSP}${mark}`;
        }),
      ),
      // Collapse a second consecutive space.
      rule(/([ \u00A0\u202F]) $/, (m) => m[1]),
      // Missing space after a comma before a letter: "раз,два" → "раз, два" (not in URLs/numbers).
      rule(/(\S*),(\p{L})$/u, (m) => (/[/@.:=&?#]/.test(m[1]) || m[1] === "" ? null : `${m[1]}, ${m[2]}`)),

      // ── Capitalization ──
      // First letter of a block or a sentence. Never in the middle of a word or inside links.
      rule(/(\p{Ll})$/u, (m, { before, state, range }) => {
        if (inLink(state, range.from)) return null;
        const after = textAfter(state, range.to);
        if (/^[\p{L}\p{N}]/u.test(after)) return null; // editing inside an existing word
        if (/[\p{L}\p{N}]$/u.test(before)) return null; // not a word start
        const core = before.replace(/[«„“"‘(]+[\u202F\u00A0]?$/u, "");
        const blockStart = core.replace(/[\s\u00A0—–-]/g, "") === "";
        if (!blockStart && !(/[\s\u00A0]$/.test(core) && isSentenceStart(core))) return null;
        return m[1].toUpperCase();
      }),
      // English pronoun "i" → "I".
      rule(/(^|\s)i([\s,.!?’'])$/, only(["en"], (m) => `${m[1]}I${m[2]}`)),
    ];
  },
});
