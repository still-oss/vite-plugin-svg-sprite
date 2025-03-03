import { defineComponent, h } from 'vue';
import { type Adapter } from '../types.js';

export const adapter: Adapter = (id, name, mount) =>
  defineComponent({
    name: `Icon${name}`,
    setup(_props, { attrs }) {
      mount();
      return () =>
        h(
          'svg',
          {
            width: '1em',
            height: '1em',
            ...attrs,
          },
          [h('use', { 'xlink:href': `#${id}` })],
        );
    },
  });
