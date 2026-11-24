"use client";
/**
 * The Tiptap body editor (client-only; loaded with next/dynamic ssr:false by ./post-editor.tsx).
 * Assembles schema extensions from @/lib/content with the UI-only ones: placeholder, live typography,
 * Типограф, LanguageTool, smart paste, uploads, slash menu, shortcuts — plus toolbar, bubble, menus and status bar.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import type { CoverImage } from "@/db/schema";
import { getExtensions } from "@/lib/content/extensions";
import { countWords, readingMinutesFor } from "@/lib/content/stats";
import { TEXT_LANGUAGE_HTML, siteLocale, type TextLanguage } from "@/lib/i18n/config";
import { useToast } from "@/components/admin/toast";
import { SmartTypography } from "./extensions/smart-typography";
import { Typograph } from "./extensions/typograph";
import {
  LanguageTool,
  readLanguageToolEnabled,
  type LTIssue,
  type LTStatus,
} from "./extensions/language-tool";
import { SmartPaste } from "./extensions/paste";
import { ImageUpload, insertImageFiles, insertImageFilesSmart } from "./extensions/image-upload";
import { SlashCommand } from "./extensions/slash-command";
import { EditorUi, setEditorUiHandler } from "./extensions/editor-ui";
import { EditorImage } from "./image-view";
import { EditorGallery } from "./gallery-view";
import { GalleryDialog } from "./gallery-dialog";
import { coverToImageAttrs, insertGallery } from "./gallery";
import { EditorToolbar } from "./toolbar";
import { EditorBubbleMenu } from "./bubble-menu";
import { PlusMenu, SlashMenu } from "./slash-menu";
import { LanguageToolPopover } from "./lt-popover";
import { UnsplashPicker } from "./unsplash-picker";
import { ACCEPTED_IMAGE_ACCEPT } from "./upload";
import type { BlockContext } from "./block-commands";
import "./editor.css";

export type BodyEditorProps = {
  initialContent: JSONContent;
  /** Called on every document change (debounce on the caller's side). */
  onChange: (editor: Editor) => void;
  /** Called once the editor exists (and with null on unmount). */
  onReady: (editor: Editor | null) => void;
  onSaveShortcut: () => void;
  onBlur?: () => void;
  /** Used to seed the Unsplash search. */
  title: string;
  /** Save status element shown in the status bar. */
  saveStatus: ReactNode;
  /** The language the post is written in: spellcheck `lang`, typography rules and LanguageTool follow it live. */
  language: TextLanguage;
};

type Stats = { words: number; chars: number; minutes: number };

function computeStats(editor: Editor): Stats {
  const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, "\n\n", " ");
  let images = 0;
  editor.state.doc.descendants((n) => {
    if (n.type.name === "image") images++;
  });
  return { words: countWords(text), chars: text.replace(/\n/g, "").length, minutes: readingMinutesFor(text, siteLocale, images) };
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** The post body. Spellcheck, typography rules and LanguageTool follow the post language (`language`, changeable live). */
export default function BodyEditor({
  initialContent,
  onChange,
  onReady,
  onSaveShortcut,
  onBlur,
  title,
  saveStatus,
  language,
}: BodyEditorProps) {
  const toast = useToast();
  const [ltEnabled, setLtEnabled] = useState(() => readLanguageToolEnabled());
  const [ltStatus, setLtStatus] = useState<LTStatus>({ state: "off" });
  const [ltIssue, setLtIssue] = useState<{ issue: LTIssue; rect: { left: number; top: number; bottom: number } } | null>(null);
  const [unsplashOpen, setUnsplashOpen] = useState(false);
  /** When set, the next Unsplash pick goes to this callback (e.g. a gallery adding a photo) instead of the body. */
  const unsplashTarget = useRef<((cover: CoverImage) => void) | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [stats, setStats] = useState<Stats>({ words: 0, chars: 0, minutes: 1 });
  const fileInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  // Extensions are created once, so they read the current post language through this ref.
  const languageRef = useRef<TextLanguage>(language);

  // Latest callbacks for extension options (extensions are created once).
  const cb = useRef({ onChange, onSaveShortcut, onBlur, toast });
  useEffect(() => {
    cb.current = { onChange, onSaveShortcut, onBlur, toast };
  }, [onChange, onSaveShortcut, onBlur, toast]);

  // Created once on purpose (Tiptap extensions must stay stable); the parent remounts the editor via `key` when it
  // replaces the content. The compiler can't keep this memo because the handlers read refs at event time.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const extensions = useMemo(() => {
    const onError = (message: string) => cb.current.toast.error("Изображение не добавлено", { description: message });
    return [
      ...getExtensions().filter((e) => e.name !== "image" && e.name !== "gallery"),
      EditorImage,
      EditorGallery,
      Placeholder.configure({
        placeholder: ({ node, editor }) => {
          if (node.type.name === "heading") return node.attrs.level === 2 ? "Заголовок" : "Подзаголовок";
          return editor.isEmpty ? "Расскажите свою историю… «/» — вставить фото, заголовок, цитату" : "Пишите… или нажмите «/»";
        },
      }),
      // eslint-disable-next-line react-hooks/refs -- read at keystroke time, never during render
      SmartTypography.configure({ getLanguage: () => languageRef.current }),
      // eslint-disable-next-line react-hooks/refs -- read at keystroke time, never during render
      Typograph.configure({ getLanguage: () => languageRef.current }),
      // eslint-disable-next-line react-hooks/refs -- read at keystroke time, never during render
      LanguageTool.configure({
        enabled: readLanguageToolEnabled(),
        endpoint: "/api/languagetool",
        getLanguage: () => languageRef.current,
        onStatus: (status) => setLtStatus(status),
        onOpen: (issue, rect) => setLtIssue({ issue, rect }),
      }),
      // Handlers below run on user events (never during render); they read the latest refs then.
      // eslint-disable-next-line react-hooks/refs
      ImageUpload.configure({ onError }),
      // eslint-disable-next-line react-hooks/refs
      SmartPaste.configure({
        onImageFiles: (files, pos) => {
          const editor = editorRef.current;
          // 2–3 files dropped/pasted together become one gallery.
          if (editor) insertImageFilesSmart(editor, files, pos, onError);
        },
      }),
      SlashCommand,
      EditorUi,
    ];
  }, []);

  const editor = useEditor({
    extensions,
    content: initialContent,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      // A function, so ProseMirror re-reads the current post language on every update (a static object
      // would put the initial `lang` back after a live language change).
      attributes: () => ({
        class: "prose-sara editor-body",
        lang: TEXT_LANGUAGE_HTML[languageRef.current],
        spellcheck: "true",
        autocapitalize: "sentences",
        autocorrect: "on",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Текст записи",
      }),
    },
    onCreate: ({ editor: e }) => {
      setStats(computeStats(e));
    },
    onUpdate: ({ editor: e }) => {
      cb.current.onChange(e);
    },
    onBlur: () => cb.current.onBlur?.(),
  });

  // «Язык текста» changed: native spellcheck, then LanguageTool (typography rules read the ref on each keystroke).
  // Runs only on a real change — the initial language is already applied when the editor is created.
  // The LanguageTool controller is called directly, NOT through `editor.commands`: a command's transaction is
  // dispatched after the command returns, so a controller that dispatches its own transaction inside a command
  // makes the command's (now stale) transaction fail with "Applying a mismatched transaction" (editor crash).
  const appliedLanguage = useRef(language);
  useEffect(() => {
    languageRef.current = language;
    if (!editor || editor.isDestroyed || appliedLanguage.current === language) return;
    appliedLanguage.current = language;
    editor.view.dom.setAttribute("lang", TEXT_LANGUAGE_HTML[language]);
    editor.storage.languageTool?.controller?.languageChanged();
  }, [editor, language]);

  useEffect(() => {
    editorRef.current = editor;
    onReady(editor);
    return () => onReady(null);
  }, [editor, onReady]);

  // Debounced stats.
  useEffect(() => {
    if (!editor) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => setStats(computeStats(editor)), 300);
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
      if (t) clearTimeout(t);
    };
  }, [editor]);

  // Shortcuts → UI.
  useEffect(() => {
    if (!editor) return;
    setEditorUiHandler(editor, "save", () => cb.current.onSaveShortcut());
    setEditorUiHandler(editor, "pickUnsplashImage", (onSelect) => {
      unsplashTarget.current = onSelect;
      setUnsplashOpen(true);
    });
    setEditorUiHandler(editor, "openLink", () => {
      if (editor.state.selection.empty) setLinkOpen(true);
      else editor.storage.editorUi.openBubbleLink?.();
    });
    return () => {
      setEditorUiHandler(editor, "save", null);
      setEditorUiHandler(editor, "openLink", null);
      setEditorUiHandler(editor, "pickUnsplashImage", null);
    };
  }, [editor]);

  const blockCtx = useMemo<BlockContext>(
    () => ({
      pickImage: () => fileInput.current?.click(),
      pickUnsplash: () => {
        unsplashTarget.current = null;
        setUnsplashOpen(true);
      },
      pickGallery: () => setGalleryOpen(true),
    }),
    [],
  );

  if (!editor) return <BodySkeleton />;

  const runTypograph = () => {
    editor.chain().focus().runTypograph().run();
    const n = editor.storage.typograph.lastFixes;
    if (n > 0) {
      toast.success(`Типограф: ${n} ${plural(n, "исправление", "исправления", "исправлений")}`, {
        description: "Кавычки, тире, пробелы. Отменить — ⌘Z / Ctrl+Z.",
        action: { label: "Отменить", onClick: () => editor.chain().focus().undo().run() },
      });
    } else {
      toast.info("Типограф: всё уже аккуратно ✨");
    }
  };

  const toggleLt = () => {
    const next = !ltEnabled;
    setLtEnabled(next);
    editor.commands.setLanguageToolEnabled(next);
    if (!next) setLtIssue(null);
  };

  return (
    <div className="editor-shell">
      <div className="editor-toolbar-wrap" data-chrome>
        <EditorToolbar
          editor={editor}
          ltEnabled={ltEnabled}
          ltStatus={ltStatus}
          onToggleLt={toggleLt}
          onTypograph={runTypograph}
          onPickImage={() => fileInput.current?.click()}
          onPickUnsplash={() => {
            unsplashTarget.current = null;
            setUnsplashOpen(true);
          }}
          onPickGallery={() => setGalleryOpen(true)}
          linkOpen={linkOpen}
          setLinkOpen={setLinkOpen}
        />
      </div>

      <EditorContent editor={editor} className="editor-content" />

      <EditorBubbleMenu editor={editor} />
      <SlashMenu editor={editor} ctx={blockCtx} />
      <PlusMenu editor={editor} ctx={blockCtx} />
      <LanguageToolPopover
        editor={editor}
        issue={ltIssue?.issue ?? null}
        rect={ltIssue?.rect ?? null}
        onClose={() => setLtIssue(null)}
      />

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_IMAGE_ACCEPT}
        multiple
        hidden
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length)
            insertImageFiles(editor, files, null, (m) => toast.error("Изображение не добавлено", { description: m }));
        }}
      />

      <UnsplashPicker
        open={unsplashOpen}
        onClose={() => setUnsplashOpen(false)}
        initialQuery={title}
        width={1600}
        title="Фото в текст"
        onSelect={(cover) => {
          const target = unsplashTarget.current;
          unsplashTarget.current = null;
          if (target) {
            target(cover);
            return;
          }
          // The picker has already pinged /api/unsplash/download; src is hotlinked from images.unsplash.com.
          editor.chain().focus().insertContent({ type: "image", attrs: coverToImageAttrs(cover) }).run();
        }}
      />

      <GalleryDialog
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        initialQuery={title}
        onInsert={(images) => insertGallery(editor, images)}
      />

      <div className="editor-statusbar" data-chrome>
        <span>
          {stats.words.toLocaleString("ru-RU")} {plural(stats.words, "слово", "слова", "слов")}
        </span>
        <span aria-hidden>·</span>
        <span>{stats.minutes} мин чтения</span>
        <span aria-hidden className="hidden sm:inline">
          ·
        </span>
        <span className="hidden sm:inline">
          {stats.chars.toLocaleString("ru-RU")} {plural(stats.chars, "символ", "символа", "символов")}
        </span>
        <span className="ml-auto">{saveStatus}</span>
      </div>
    </div>
  );
}

export function BodySkeleton() {
  return (
    <div aria-hidden className="space-y-4 pt-16">
      <div className="admin-skeleton h-5 w-11/12" />
      <div className="admin-skeleton h-5 w-full" />
      <div className="admin-skeleton h-5 w-4/5" />
      <div className="admin-skeleton h-5 w-2/3" />
    </div>
  );
}
