import path from 'node:path';
import { dedent } from 'radashi';
import fs from 'node:fs';
import crypto from 'node:crypto';
import picomatch from 'picomatch';
import { optimize, Config as SvgoOptimizeOptions } from 'svgo';
import { Plugin } from 'vite';
import { svgToSymbol } from './svg-to-symbol.js';

const { stringify } = JSON;

const exportTypes = ['vanilla', 'react', 'vue'] as const;

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
  const svgoOptions = options?.svgo;
  const containerSelector = options?.containerSelector
    ? stringify(options.containerSelector)
    : undefined;

  const plugin: Plugin = {
    name: 'svg-sprite',

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
        };
      }

      if (!match(id)) {
        return undefined;
      }

      const rawSvg = await fs.promises.readFile(id, 'utf-8');

      const svgHash = getHash(rawSvg).slice(0, 8);

      const { name } = path.parse(id);

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
        throw new Error(`invalid svg file: ${id}`);
      }

      const { symbolXml, attributes } = symbolResults;

      const generatedCode = dedent`
        import registerSymbol from 'vite-plugin-svg-sprite/runtime/register.js';
        import { adapter } from 'vite-plugin-svg-sprite/runtime/adapters/${exportType}.js';

        const id = ${stringify(symbolId)};
        const name = ${stringify(capitalizeFirst(name))};
        const symbolXml = ${stringify(symbolXml)};
        const { mount, unmount } = registerSymbol(symbolXml, id);

        export default adapter(id, name, mount);
        export const attributes = ${stringify(attributes)}

        if (import.meta.hot) {
          import.meta.hot.dispose(unmount);
          import.meta.hot.accept();
        }
      `;

      return {
        code: generatedCode,
        moduleSideEffects: options?.moduleSideEffects ?? true,
        map: {
          version: 3,
          file: id,
          sources: [id + '.js'],
          sourcesContent: [generatedCode],
          names: [],
          mappings: 'AAAA',
        },
      };
    },
  };

  return plugin;
};

function capitalizeFirst(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
