export type CodeLanguage = "cpp" | "java";
export type TemplateSet = "standard" | "analysis";

export const TEMPLATES: Record<CodeLanguage, string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    // your solution here

    return 0;
}
`,
  java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));

        // your solution here
    }
}
`,
};

// Same boilerplate, but the solution slot is replaced with the analysis
// scaffold: state what is asked, separate signal from noise, write the
// observation before any code. Both languages use line comments.
export const ANALYSIS_TEMPLATES: Record<CodeLanguage, string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    // What is the problem asking?
    //
    // What info actually matters? What is noise?
    //
    // OBS:
    //

    return 0;
}
`,
  java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));

        // What is the problem asking?
        //
        // What info actually matters? What is noise?
        //
        // OBS:
        //
    }
}
`,
};

export function templateFor(language: CodeLanguage, set: TemplateSet): string {
  return set === "analysis" ? ANALYSIS_TEMPLATES[language] : TEMPLATES[language];
}
