#!/usr/bin/env node
/**
 * Zero-Dependency Model Context Protocol (MCP) Server for Jiangshan Historical Atlas (江山时序)
 *
 * Speaks standard MCP JSON-RPC 2.0 over stdio.
 * Exposes 3 tools for Claude Desktop, Cursor, Windsurf, Gemini CLI, and MCP clients:
 *   1. `inspect_place`  — Query historical polity, prefecture, 2,400-year lore & deep-link URL for (year, place)
 *   2. `inspect_person` — Query a historical figure or monarch's spatio-temporal chronicle & deep-link URL
 *   3. `search_atlas`   — Quick search across cities, passes, landmarks, figures, eras, and events
 */
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');

function createMcpRuntime() {
  const sandbox = {
    window: {},
    addEventListener: () => {},
    document: {
      addEventListener: () => {},
      getElementById: () => null,
      querySelectorAll: () => [],
      documentElement: { lang: 'zh-CN' },
    },
    localStorage: { getItem: () => null, setItem: () => {} },
    history: { replaceState: () => {} },
    location: {
      origin: 'https://deanchen.me',
      pathname: '/jiangshan-map/',
      search: '',
      hash: '',
    },
    navigator: { language: 'zh-CN' },
    performance: { now: () => 0 },
    requestAnimationFrame: () => {},
    URLSearchParams,
    setTimeout,
    clearTimeout,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);

  for (const file of [
    'china_geo_data.js',
    'atlas_boot.js',
    'atlas_snapshots.js',
    'map_data.js',
    'lore_data.js',
    'i18n_dict.js',
    'zh_hant.js',
    'app.js',
  ]) {
    const code = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
  }

  const ControllerClass = sandbox.HistoricalAtlasController;
  const dynasties = sandbox.DYNASTY_DATA;
  const ctrl = Object.create(ControllerClass.prototype);
  Object.assign(ctrl, {
    dynasties,
    provinces: sandbox.PROVINCE_OUTLINES || [],
    corridors: sandbox.CORRIDOR_DATA || [],
    snapshots: sandbox.ATLAS_SNAPSHOTS || {},
    enLocale: sandbox.EN_LOCALE || { dict: {} },
    locale: 'zh',
    year: -403,
    dynastyIdx: 0,
    minYear: dynasties[0].fromYear,
    maxYear: dynasties[dynasties.length - 1].toYear,
    camera: { x: 0, y: 0, w: 1000, h: 700, zoom: 1 },
    projector: new sandbox.MercatorProjector(1000, 700, {
      west: 66,
      east: 142,
      south: 14,
      north: 55,
    }),
    _fullSnapshotsLoaded: true,
    snapshotCache: {},
    searchIndex: null,
  });
  ctrl._hydrateSnapshots();
  return { ctrl, sandbox };
}

const MCP_TOOLS = [
  {
    name: 'inspect_place',
    description:
      'Query the historical and administrative context of a Chinese city, poem landmark, strategic pass, battlefield, or multi-stop route on the Jiangshan Historical Atlas (403 BCE – 2026 CE). Returns the reigning monarch/era, controlling regime (polity), macro-region (dao/lu/province), prefecture (jun/zhou/fu), modern province/city, 2,400-year city/pass lore, and a shareable deep-link URL.',
    inputSchema: {
      type: 'object',
      properties: {
        year: {
          type: ['integer', 'string'],
          description:
            'Historical year (-403 to 2026, negative for BCE, no year 0) or comma-separated years for multi-year trajectories (e.g. "1079,1080,1094,1097").',
        },
        place: {
          type: 'string',
          description:
            'Canonical ancient/modern place name in Chinese, English, or Pinyin (e.g. "长安", "蓝关", "浔阳", "Chang\'an"), or comma-separated route stops (e.g. "剑外,巴峡,巫峡,襄阳,洛阳").',
        },
        lang: {
          type: 'string',
          enum: ['zh', 'zh-tw', 'en'],
          description: 'Response and deep-link UI language (default: "zh").',
        },
      },
      required: ['year', 'place'],
    },
  },
  {
    name: 'inspect_person',
    description:
      'Query the spatio-temporal life & poetry chronicle (点人溯事) of a Chinese historical figure or reigning monarch on the Jiangshan Historical Atlas. Returns biographical summary, chronological geocoded stops across dynasties, and a shareable deep-link URL.',
    inputSchema: {
      type: 'object',
      properties: {
        person: {
          type: 'string',
          description:
            'Historical figure name or key in Chinese, English, or Pinyin (e.g. "sushi", "苏轼", "李白", "诸葛亮", "玄奘", "霍去病", "汉武帝").',
        },
        stop: {
          type: 'integer',
          description: 'Optional 0-based stop index to focus on a specific life event.',
        },
        lang: {
          type: 'string',
          enum: ['zh', 'zh-tw', 'en'],
          description: 'Response and deep-link UI language (default: "zh").',
        },
      },
      required: ['person'],
    },
  },
  {
    name: 'search_atlas',
    description:
      'Search the Jiangshan Historical Atlas across 1,753 ancient cities, 185 poetic/battlefield landmarks, 20 strategic mountain passes, 113+ historical figures, 351 imperial eras, and 471 chronological milestones.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search keyword in Chinese, English, or Pinyin (e.g. "长安", "安史之乱", "赤壁", "贞观", "苏轼").',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of results to return (default: 8, max: 20).',
        },
        lang: {
          type: 'string',
          enum: ['zh', 'zh-tw', 'en'],
          description: 'Response language (default: "zh").',
        },
      },
      required: ['query'],
    },
  },
];

function normalizeLang(lang) {
  const raw = String(lang || 'zh').toLowerCase().trim();
  if (raw === 'en') return 'en';
  if (/^(zh-tw|zh_tw|tw|hk|zh-hk|zh-hant|hant)$/.test(raw)) return 'zh-tw';
  return 'zh';
}

function executeMcpTool(runtime, name, args = {}) {
  const { ctrl } = runtime;
  ctrl.locale = normalizeLang(args.lang);

  if (name === 'inspect_place') {
    if (args.year === undefined || args.year === null || args.year === '') {
      throw new Error('Missing required parameter: year');
    }
    if (!args.place || !String(args.place).trim()) {
      throw new Error('Missing required parameter: place');
    }
    const res = ctrl.inspect({
      year: args.year,
      place: String(args.place).trim(),
    });
    if (!res.coord && (!res.route || !res.route.length)) {
      throw new Error(
        `Could not resolve place "${args.place}" in the atlas gazetteer. Try a canonical ancient or modern city/landmark name.`
      );
    }
    return res;
  }

  if (name === 'inspect_person') {
    if (!args.person || !String(args.person).trim()) {
      throw new Error('Missing required parameter: person');
    }
    const res = ctrl.inspect({
      person: String(args.person).trim(),
      stop: typeof args.stop === 'number' ? args.stop : undefined,
    });
    if (!res.person) {
      throw new Error(
        `Could not resolve historical figure "${args.person}". Try a canonical name or key such as "sushi", "苏轼", "李白", "诸葛亮", or a monarch title.`
      );
    }
    return res;
  }

  if (name === 'search_atlas') {
    if (!args.query || !String(args.query).trim()) {
      throw new Error('Missing required parameter: query');
    }
    const maxHits = Math.max(1, Math.min(20, Number(args.limit) || 8));
    const hits = ctrl._queryQuickSearch(String(args.query).trim()).slice(0, maxHits);
    return {
      query: String(args.query).trim(),
      locale: ctrl.locale,
      count: hits.length,
      results: hits.map((h) => ({
        kind: h.kind,
        titleZh: h.titleZh,
        titleEn: h.titleEn,
        subZh: h.subZh || '',
        subEn: h.subEn || '',
        year: h.year !== undefined ? h.year : h.dynasty ? h.dynasty.focusYear : undefined,
        dynasty: h.dynasty ? h.dynasty.key : undefined,
        personKey: h.personKey || undefined,
        coord: h.coord || undefined,
      })),
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

function handleJsonRpcRequest(runtime, msg) {
  if (!msg || typeof msg !== 'object') return null;
  const { id, method, params } = msg;

  // Notifications have no id and expect no response
  if (id === undefined || id === null) {
    return null;
  }

  try {
    if (method === 'initialize') {
      const clientVersion = (params && params.protocolVersion) || '2024-11-05';
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: clientVersion,
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'jiangshan-atlas-mcp',
            version: '1.0.0',
          },
        },
      };
    }

    if (method === 'ping') {
      return { jsonrpc: '2.0', id, result: {} };
    }

    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS,
        },
      };
    }

    if (method === 'tools/call') {
      const toolName = params && params.name;
      const toolArgs = (params && params.arguments) || {};
      try {
        const data = executeMcpTool(runtime, toolName, toolArgs);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(data, null, 2),
              },
            ],
          },
        };
      } catch (toolErr) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [
              {
                type: 'text',
                text: String(toolErr && toolErr.message ? toolErr.message : toolErr),
              },
            ],
          },
        };
      }
    }

    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`,
      },
    };
  } catch (err) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: String(err && err.message ? err.message : err),
      },
    };
  }
}

if (require.main === module) {
  let runtime = null;
  const ensureRuntime = () => {
    if (!runtime) runtime = createMcpRuntime();
    return runtime;
  };
  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg = JSON.parse(trimmed);
      const resp = handleJsonRpcRequest(ensureRuntime(), msg);
      if (resp) {
        process.stdout.write(`${JSON.stringify(resp)}\n`);
      }
    } catch (_) {}
  });
}

module.exports = {
  MCP_TOOLS,
  createMcpRuntime,
  executeMcpTool,
  handleJsonRpcRequest,
};
