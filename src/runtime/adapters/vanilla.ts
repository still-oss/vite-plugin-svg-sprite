import { type Adapter } from '../types.js';

export const adapter: Adapter = (id, _name, mount) => {
  mount();
  return id;
};
