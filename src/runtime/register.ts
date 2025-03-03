import { noop } from 'radashi';

type RegisterFunction = (
  symbol: string,
  id: string,
) => {
  mount: () => void;
  unmount: () => void;
};

function createRegisterFunction(): RegisterFunction {
  if (typeof document === 'undefined') {
    const ssrFallback = {
      mount: noop,
      unmount: noop,
    };

    return () => ssrFallback;
  }

  // This must be the only reference to document body, or else the Vite plugin will fail to
  // transform this module correctly.
  const container = document.body;
  const containerDoc = container.ownerDocument;
  const containerRoot = container.shadowRoot ?? containerDoc;
  const containerBody =
    container.shadowRoot?.querySelector('body') ?? container;

  const idSet: Set<string> =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((container as any)._SVG_SPRITE_IDS_ ||= new Set());

  const root = containerDoc.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg',
  );
  root.style.position = 'absolute';
  root.style.width = '0';
  root.style.height = '0';
  root.style.overflow = 'hidden';
  root.ariaHidden = 'true';

  // DO NOT SET THIS
  // root.style.visibility = 'hidden';

  function insertRoot() {
    containerBody.insertBefore(root, containerBody.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertRoot);
  } else {
    insertRoot();
  }

  return function registerSymbol(symbol: string, id: string) {
    if (idSet.has(id) || containerRoot.getElementById(id)) {
      console.warn(
        `Icon #${id} was repeatedly registered. It must be globally unique.`,
      );
    }

    idSet.add(id);

    let symbolElement: ChildNode | null = null;

    return {
      mount() {
        if (!symbolElement) {
          root.insertAdjacentHTML('beforeend', symbol);
          symbolElement = root.lastChild;
        }
      },
      unmount() {
        idSet.delete(id);
        symbolElement?.remove();
      },
    };
  };
}

export default createRegisterFunction();
