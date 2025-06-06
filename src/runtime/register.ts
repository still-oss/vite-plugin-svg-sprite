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

  let root: SVGSVGElement;
  let containerRoot: Document | ShadowRoot;
  let symbolIds: Set<string>;

  const setup = () => {
    // This must be the only reference to document body, or else the Vite plugin will fail to
    // transform this module correctly.
    const container = document.body;
    const containerDoc = container.ownerDocument;
    const containerBody =
      container.shadowRoot?.querySelector('body') ?? container;

    containerRoot = container.shadowRoot ?? containerDoc;
    symbolIds = new Set();

    root = containerDoc.createElementNS('http://www.w3.org/2000/svg', 'svg');
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
  };

  return function registerSymbol(symbol: string, id: string) {
    let symbolElement: ChildNode | null = null;

    return {
      mount() {
        if (symbolElement?.isConnected) {
          return;
        }
        if (!root?.isConnected) {
          setup();
        }
        if (symbolIds.has(id) || containerRoot.getElementById(id)) {
          console.warn(
            `Icon #${id} was repeatedly registered. It must be globally unique.`,
          );
        }
        symbolIds.add(id);
        root.insertAdjacentHTML('beforeend', symbol);
        symbolElement = root.lastChild;
      },
      unmount() {
        if (symbolElement) {
          symbolElement.remove();
          symbolIds.delete(id);
        }
      },
    };
  };
}

export default createRegisterFunction();
