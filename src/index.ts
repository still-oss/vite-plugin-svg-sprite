import path from 'node:path';
import { dedent, pascal } from 'radashi';
import fs from 'node:fs';
import crypto from 'node:crypto';
import picomatch from 'picomatch';
import { optimize, Config as SvgoOptimizeOptions } from 'svgo';
import { Plugin } from 'vite';
import { svgToSymbol } from './svg-to-symbol.js';

const { stringify } = JSON;

const exportTypes = ['vanilla', 'react', 'preact', 'vue'] as const;

export type { SvgoOptimizeOptions };
export interface SvgSpriteOptions {
  include?: string[] | string;
  symbolId?: string;
  svgo?: SvgoOptimizeOptions;
  exportType?: (typeof exportTypes)[number];
  moduleSideEffects?: boolean;
  containerSelector?: string;
}

function getHash(content: string) {
  const h = crypto.createHash('sha256');
  h.update(content);
  return h.digest('hex');
}

export default (options?: SvgSpriteOptions) => {
  const exportType = options?.exportType ?? 'vanilla';
  if (!exportTypes.includes(exportType)) {
    throw new Error(`invalid export type: ${exportType}`);
  }

  const match = picomatch(options?.include ?? '**.svg', { dot: true });
  const containerSelector = options?.containerSelector
    ? stringify(options.containerSelector)
    : undefined;

  const specialIdRE = /[?#\0]/;

  const plugin: Plugin = {
    name: 'svg-sprite',
    enforce: 'pre',

    async load(id) {
      if (!specialIdRE.test(id) && match(id)) {
        const generatedCode = await generateSvgModule(id, exportType, options);

        return {
          code: generatedCode,
          moduleSideEffects: options?.moduleSideEffects ?? true,
          map: generateLineToLineSourceMap(generatedCode, id, id + '.js'),
        };
      }
    },

    async transform(code, id) {
      if (
        containerSelector &&
        /\/vite-plugin-svg-sprite\/.+\/register\.js/.test(id)
      ) {
        return {
          code: code.replace(
            'document.body',
            `document.querySelector(${containerSelector})`,
          ),
          map: generateLineToLineSourceMap(code, id),
        };
      }
    },
  };

  return plugin;
};

async function generateSvgModule(
  id: string,
  exportType: string,
  options?: SvgSpriteOptions,
) {
  const { name } = path.parse(id);

  const rawSvg = await fs.promises.readFile(id, 'utf-8');
  const svgHash = getHash(rawSvg).slice(0, 8);

  const svgoOptions = options?.svgo;
  const optimizedSvg = optimize(rawSvg, {
    ...svgoOptions,
    plugins: [
      {
        name: 'prefixIds',
        params: {
          prefix: svgHash,
        },
      },
      ...(svgoOptions?.plugins ?? []),
    ],
  }).data;

  const symbolId = (options?.symbolId ?? 'icon-[name]')
    .replace(/\[hash\]/g, svgHash)
    .replace(/\[name\]/g, name);

  const symbolResults = svgToSymbol(optimizedSvg, symbolId);

  if (!symbolResults) {
    throw new Error(`Invalid svg file: ${id}`);
  }

  const { symbolXml, attributes } = symbolResults;

  return dedent`
    import registerSymbol from 'vite-plugin-svg-sprite/runtime/register.js';
    import { adapter } from 'vite-plugin-svg-sprite/runtime/adapters/${exportType}.js';

    const id = ${stringify(symbolId)};
    const name = ${stringify(pascal(name))};
    const symbolXml = ${stringify(symbolXml)};
    const symbol = registerSymbol(symbolXml, id);

    export default adapter(id, name, symbol.mount);
    export const attributes = ${stringify(attributes)}

    if (import.meta.hot) {
      import.meta.hot.dispose(symbol.unmount);
      import.meta.hot.accept();
    }
  `;
}

function generateLineToLineSourceMap(
  code: string,
  fileName: string,
  sourceFileName = fileName,
) {
  return {
    version: 3,
    file: fileName,
    sources: [sourceFileName],
    sourcesContent: [code],
    names: [],
    mappings:
      'AAAA;' +
      Array(code.split('\n').length - 1)
        .fill('AACA')
        .join(';'),
  };
}
