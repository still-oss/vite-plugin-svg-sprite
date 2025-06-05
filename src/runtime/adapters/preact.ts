import { createElement } from 'preact';
import { memo } from 'preact/compat';
import { type Adapter } from '../types.js';

export const adapter: Adapter = (id, name, mount) => {
  const Icon = memo((props) => {
    mount();
    return createElement(
      'svg',
      {
        width: '1em',
        height: '1em',
        ...props,
      },
      createElement('use', { xlinkHref: `#${id}` }),
    );
  });

  Icon.displayName = `Icon${name}`;

  return Icon;
};
