declare module '*.svg' {
  import { ComponentClass, JSX } from 'preact';

  const Component: ComponentClass<JSX.SVGAttributes>;
  export default Component;
  export const attributes: {
    width?: string;
    height?: string;
    viewBox?: string;
  };
}
