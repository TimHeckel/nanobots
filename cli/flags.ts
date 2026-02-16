export interface ParsedFlags {
  command: string;
  args: string[];
  bots?: string;
  bot?: string;
  fix: boolean;
  json: boolean;
  model?: string;
  verbose: boolean;
  help: boolean;
  version: boolean;
}

export function parseFlags(argv: string[]): ParsedFlags {
  const result: ParsedFlags = {
    command: "",
    args: [],
    fix: false,
    json: false,
    verbose: false,
    help: false,
    version: false,
  };

  const positional: string[] = [];
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--version" || arg === "-v") {
      result.version = true;
    } else if (arg === "--fix") {
      result.fix = true;
    } else if (arg === "--json") {
      result.json = true;
    } else if (arg === "--verbose") {
      result.verbose = true;
    } else if (arg === "--bots" && i + 1 < argv.length) {
      i++;
      result.bots = argv[i];
    } else if (arg === "--bot" && i + 1 < argv.length) {
      i++;
      result.bot = argv[i];
    } else if (arg === "--model" && i + 1 < argv.length) {
      i++;
      result.model = argv[i];
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }

    i++;
  }

  result.command = positional[0] ?? "";
  result.args = positional.slice(1);

  return result;
}
