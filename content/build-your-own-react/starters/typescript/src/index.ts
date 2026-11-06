// Build Your Own React - Starter Template

export interface VNode {
  type: string | Function;
  props: {
    [key: string]: any;
    children: (VNode | any)[];
  };
}

export function createElement(
  type: string | Function,
  props: Record<string, any> | null,
  ...children: any[]
): VNode {
  // TODO: Step 1 - Construct element descriptors and normalize text nodes
  return {
    type,
    props: {
      ...(props || {}),
      children: children.map((child) =>
        typeof child === 'object' && child !== null
          ? child
          : { type: 'TEXT_ELEMENT', props: { nodeValue: String(child), children: [] } },
      ),
    },
  };
}

export function render(element: VNode, container: any): void {
  // TODO: Step 2 & 3 - Render to DOM / Fiber work loop
}

export function useState<T>(initial: T): [T, (action: T | ((prev: T) => T)) => void] {
  // TODO: Step 4 - Implement state hook
  return [initial, () => {}];
}

