import { codeToHtml } from "shiki";

export async function CodeBlock({ code, lang = "typescript" }: { code: string; lang?: string }) {
  const html = await codeToHtml(code, { lang, theme: "github-dark" });

  return (
    <div
      className="overflow-x-auto rounded-2xl text-sm [&_pre]:p-4"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
