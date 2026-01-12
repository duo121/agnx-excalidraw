type ParseMermaidFn = (definition: string, config?: Record<string, any>) => Promise<any>;

let parseMermaidToExcalidrawCache: ParseMermaidFn | null = null;

export async function loadParseMermaidToExcalidraw(): Promise<ParseMermaidFn> {
  if (parseMermaidToExcalidrawCache) {
    return parseMermaidToExcalidrawCache;
  }

  const module: any = await import("./excalidraw-mermaid-entry");
  const candidates = [
    module?.parseMermaidToExcalidraw,
    module?.default?.parseMermaidToExcalidraw,
    module?.default,
    module?.default?.default
  ];
  const parseFn = candidates.find((fn) => typeof fn === "function");

  if (typeof parseFn !== "function") {
    throw new Error(
      "[Excalidraw] 无法加载 parseMermaidToExcalidraw（可能是打包器重写了默认导出）"
    );
  }

  parseMermaidToExcalidrawCache = parseFn;
  return parseFn;
}
