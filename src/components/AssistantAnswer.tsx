import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const plugins = [remarkGfm];

export function AssistantAnswer({ text }: { text: string }) {
  return <div className="min-w-0 break-words leading-relaxed [&>:first-child]:mt-0 [&>:last-child]:mb-0 [&_p]:my-2 [&_h1]:text-base [&_h2]:text-base [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h4]:font-semibold [&_h5]:font-semibold [&_h6]:font-semibold [&_h1]:my-3 [&_h2]:my-3 [&_h3]:my-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_strong]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-pen [&_blockquote]:pl-3 [&_blockquote]:text-ink-soft [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-card [&_pre]:p-3 [&_code]:rounded [&_code]:bg-card [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_th]:border [&_th]:border-line-strong [&_th]:p-2 [&_th]:font-semibold [&_td]:border [&_td]:border-line-strong [&_td]:p-2 [&_hr]:my-3 [&_hr]:border-line-strong">
    <Markdown remarkPlugins={plugins} skipHtml disallowedElements={["img"]} components={{
      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-pen underline underline-offset-2">{children}</a>,
      table: ({ children }) => <div className="my-3 max-w-full overflow-x-auto"><table className="w-full border-collapse text-left text-xs">{children}</table></div>,
    }}>{text}</Markdown>
  </div>;
}
