import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import Editor, { loader, type Monaco, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { Select } from "./ui/select";
import { useT } from "../lib/i18n";
import { handleEditorBeforeMount } from "../lib/editorTheme";
import { templateFor, type CodeLanguage, type TemplateSet } from "../lib/templates";

// Bundle Monaco locally instead of the CDN default: the app is
// offline-first and the editor must mount with no network. Workers are
// emitted to dist by the local-monaco-workers Vite plugin (vite.config.ts).
// This module is loaded lazily (see LazyCodeEditor) so the editor chunk
// stays out of the initial bundle.
loader.config({ monaco });

export interface CodeEditorHandle {
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
}

interface CodeEditorProps {
  language: CodeLanguage;
  // Content seed, applied on mount and whenever editorKey changes (the
  // inner editor remounts). Typing never touches parent state, so
  // keystrokes do not re-render the page.
  initialValue: string;
  editorKey: string | number;
  onLanguageChange: (language: CodeLanguage) => void;
  // Practice mode seeds the analysis scaffold (what is asked / signal vs noise / OBS)
  // instead of the bare template. Contest and Stress keep "standard".
  templateSet?: TemplateSet;
  // Stress drives one shared language from its toolbar: hide the per-editor
  // dropdown so there is a single control for the shared state.
  showLanguageSelect?: boolean;
  // Scope for per-language drafts (usually the problem id). Drafts clear
  // when the scope changes so code never leaks across problems.
  draftScope?: string;
  // Optional per-language fallback templates. Stress passes its candidate /
  // brute / generator templates so a language toggle restores the right
  // scaffold instead of the generic one.
  languageTemplates?: Record<CodeLanguage, string>;
  // Fired on every content change (typing included). For autosave-style
  // side effects only: it must not set React state upstream, or keystrokes
  // re-render the page again.
  onContentChange?: (value: string) => void;
  // Panel focus mode (LeetCode-style expand). When provided, an expand
  // button appears next to reset; `focused` swaps the icon to restore.
  onToggleFocus?: () => void;
  focused?: boolean;
}

interface Snippet {
  label: string;
  doc: string;
  code: string;
}

const CPP_SNIPPETS: Snippet[] = [
  { label: "fori", doc: "Indexed for loop", code: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n\t$0\n}" },
  { label: "fore", doc: "Range for loop", code: "for (auto &${1:x} : ${2:v}) {\n\t$0\n}" },
  { label: "yn", doc: "Print YES / NO", code: "cout << (${1:ok} ? \"YES\" : \"NO\") << '\\n';" },
];

const JAVA_SNIPPETS: Snippet[] = [
  { label: "fori", doc: "Indexed for loop", code: "for (int ${1:i} = 0; ${1:i} < ${2:n}; i++) {\n\t$0\n}" },
  { label: "sout", doc: "Print line", code: "System.out.println(${1:x});" },
];

let snippetsRegistered = false;

function registerCpSnippets(m: Monaco) {
  if (snippetsRegistered) return;
  snippetsRegistered = true;
  const providers: { language: string; snippets: Snippet[] }[] = [
    { language: "cpp", snippets: CPP_SNIPPETS },
    { language: "java", snippets: JAVA_SNIPPETS },
  ];
  for (const { language, snippets } of providers) {
    m.languages.registerCompletionItemProvider(language, {
      provideCompletionItems(model: monaco.editor.ITextModel, position: monaco.Position) {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        return {
          suggestions: snippets.map((s) => ({
            label: s.label,
            kind: m.languages.CompletionItemKind.Snippet,
            documentation: s.doc,
            insertText: s.code,
            insertTextRules: m.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          })),
        };
      },
    });
  }
}

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  {
    language,
    initialValue,
    editorKey,
    onLanguageChange,
    templateSet = "standard",
    showLanguageSelect = true,
    draftScope = "default",
    languageTemplates,
    onContentChange,
    onToggleFocus,
    focused = false,
  },
  ref
) {
  const t = useT();
  const tpl = (lang: CodeLanguage): string =>
    languageTemplates?.[lang] ?? templateFor(lang, templateSet);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  // Per-language drafts: toggling cpp/java stashes the current buffer and
  // restores what was there before, so a language switch never destroys code.
  const draftsRef = useRef<Partial<Record<CodeLanguage, string>>>({});
  const prevLangRef = useRef<CodeLanguage>(language);
  const scopeRef = useRef<string>(draftScope);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });

  useImperativeHandle(ref, () => ({
    getValue: () => editorRef.current?.getValue() ?? "",
    setValue: (v: string) => editorRef.current?.setValue(v),
    focus: () => editorRef.current?.focus(),
  }));
  const contentCbRef = useRef(onContentChange);
  contentCbRef.current = onContentChange;

  useEffect(() => {
    if (scopeRef.current !== draftScope) {
      scopeRef.current = draftScope;
      draftsRef.current = {};
      prevLangRef.current = language;
    }
  }, [draftScope, language]);

  useEffect(() => {
    if (prevLangRef.current === language) return;
    const from = prevLangRef.current;
    prevLangRef.current = language;
    const editor = editorRef.current;
    if (editor) {
      draftsRef.current[from] = editor.getValue();
      editor.setValue(draftsRef.current[language] ?? tpl(language));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  function switchLanguage(lang: CodeLanguage) {
    if (lang === language) return;
    const current = editorRef.current?.getValue() ?? "";
    const dirty = current !== "" && current !== tpl(language);
    // Switching never destroys code (the buffer is stashed), but confirm the
    // first time so the template swap does not surprise. Returning to a
    // language with a saved draft restores silently.
    if (dirty && draftsRef.current[lang] === undefined) {
      if (!window.confirm(t("editor.switchConfirm"))) return;
    }
    onLanguageChange(lang);
  }

  function resetTemplate() {
    const editor = editorRef.current;
    if (!editor) return;
    const current = editor.getValue();
    if (current !== "" && current !== tpl(language)) {
      if (!window.confirm(t("editor.resetConfirm"))) return;
    }
    editor.setValue(tpl(language));
  }

  const handleMount: OnMount = (editor, m) => {
    editorRef.current = editor;
    registerCpSnippets(m);
    editor.onDidChangeCursorPosition((e) =>
      setCursor({ line: e.position.lineNumber, column: e.position.column })
    );
  };

  return (
    <div className="flex flex-col h-full rounded-lg overflow-hidden bg-card">
      <div className="flex items-center gap-2 bg-card px-3 h-10 border-b border-border shrink-0">
        <span className="text-ac font-mono text-sm font-semibold select-none">{"</>"}</span>
        <span className="text-sm font-medium">{t("editor.code")}</span>
        {showLanguageSelect && (
          <div className="w-24 ml-1">
            <Select size="sm" value={language} onChange={(e) => switchLanguage(e.target.value as CodeLanguage)}>
              <option value="cpp">C++17</option>
              <option value="java">Java</option>
            </Select>
          </div>
        )}
        {onToggleFocus && (
          <button
            className="ml-auto w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors duration-150"
            onClick={onToggleFocus}
            title={focused ? t("editor.unfocusPanel") : t("editor.focusPanel")}
            aria-label={focused ? t("editor.unfocusPanel") : t("editor.focusPanel")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {focused ? (
                <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M16 21v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              ) : (
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              )}
            </svg>
          </button>
        )}
        <button
          className={`${onToggleFocus ? "" : "ml-auto "}w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors duration-150`}
          onClick={resetTemplate}
          title={t("editor.resetTemplate")}
          aria-label={t("editor.resetTemplate")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 2.6-6.4" />
            <path d="M3 4v5h5" />
          </svg>
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          key={editorKey}
          height="100%"
          theme="airlock-dark"
          language={language === "cpp" ? "cpp" : "java"}
          defaultValue={initialValue}
          beforeMount={handleEditorBeforeMount}
          onMount={handleMount}
          onChange={(v) => contentCbRef.current?.(v ?? "")}
          loading={
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              {t("editor.loading")}
            </div>
          }
          options={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 14,
            lineHeight: 20,
            fontLigatures: true,
            minimap: { enabled: false },
            tabSize: 4,
            insertSpaces: true,
            detectIndentation: false,
            trimAutoWhitespace: true,
            wordWrap: "on",
            padding: { top: 8 },
            scrollBeyondLastLine: false,
            renderLineHighlight: "all",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            renderWhitespace: "selection",
            matchBrackets: "always",
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            autoClosingBrackets: "always",
            autoClosingQuotes: "always",
            autoSurround: "languageDefined",
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: { other: true, comments: false, strings: false },
            tabCompletion: "on",
            acceptSuggestionOnEnter: "on",
            wordBasedSuggestions: "currentDocument",
            parameterHints: { enabled: true },
            occurrencesHighlight: "singleFile",
            selectionHighlight: true,
            codeLens: false,
            folding: true,
            mouseWheelZoom: true,
            multiCursorModifier: "alt",
            stickyScroll: { enabled: false },
            scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
            fixedOverflowWidgets: true,
          }}
        />
      </div>
      <div className="flex items-center justify-between px-3 h-7 border-t border-border shrink-0 text-[11px] text-muted-foreground select-none">
        <span>{t("editor.spaces")}</span>
        <span className="tabular-nums">
          Ln {cursor.line}, Col {cursor.column}
        </span>
      </div>
    </div>
  );
});

export default CodeEditor;
