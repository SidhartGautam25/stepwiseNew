// Build Your Own React (JS Starter)

export function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...(props || {}),
      children: children.map(child =>
        typeof child === 'object' && child !== null
          ? child
          : { type: 'TEXT_ELEMENT', props: { nodeValue: String(child), children: [] } }
      ),
    },
  };
}

export function render(element, container) {
  // Step 2 & 3
}

export function useState(initial) {
  return [initial, () => {}];
}

