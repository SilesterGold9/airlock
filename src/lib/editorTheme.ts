import type { BeforeMount } from "@monaco-editor/react";

// Warm-black editor to sit flush inside card surfaces (#262626).
export const handleEditorBeforeMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("airlock-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#262626",
      "editorGutter.background": "#262626",
      "editor.lineHighlightBackground": "#ffffff08",
      "editorLineNumber.foreground": "#6e7681",
      "editorLineNumber.activeForeground": "#c9d1d9",
      "editorCursor.foreground": "#ffffff",
      "editor.selectionBackground": "#ffffff1a",
      "editor.inactiveSelectionBackground": "#ffffff10",
      "editorWidget.background": "#333333",
      "editorSuggestWidget.background": "#333333",
      "editorHoverWidget.background": "#333333",
    },
  });
};
