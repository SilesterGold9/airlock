import { Suspense, forwardRef, lazy } from "react";
import type { ComponentProps } from "react";
import { useT } from "../lib/i18n";
import type { CodeEditorHandle } from "./CodeEditor";

export type { CodeEditorHandle };

// Monaco (~5MB with the bundled core) stays out of the initial bundle: it
// loads on first editor mount and is then shared by every page.
const EditorAsync = lazy(() => import("./CodeEditor"));

type Props = Omit<ComponentProps<typeof EditorAsync>, "ref">;

const LazyCodeEditor = forwardRef<CodeEditorHandle, Props>(function LazyCodeEditor(props, ref) {
  const t = useT();
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center text-xs text-muted-foreground bg-card rounded-lg">
          {t("editor.loading")}
        </div>
      }
    >
      <EditorAsync {...props} ref={ref} />
    </Suspense>
  );
});

export default LazyCodeEditor;
