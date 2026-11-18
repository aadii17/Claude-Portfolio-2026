// Stand-in for the three things FoldfolioDevice.tsx imports from "framer", so the component
// runs unchanged in a plain React/Vite site. vite.config.ts and tsconfig.app.json point the
// "framer" import here.

type Controls = Record<string, unknown>

/** In Framer this registers editor controls. Here it just remembers them, so Foldfolio.tsx can
 *  read each control's `defaultValue` and pass the same defaults Framer would. */
export function addPropertyControls(component: unknown, controls: Controls) {
  ;(component as { propertyControls?: Controls }).propertyControls = controls
}

export const ControlType = {
  Array: 'array',
  Boolean: 'boolean',
  Color: 'color',
  Enum: 'enum',
  Number: 'number',
  Object: 'object',
  ResponsiveImage: 'responsiveimage',
  Slot: 'slot',
  String: 'string',
} as const

/** Outside Framer we are always the live, published page (never the editor canvas). */
export const RenderTarget = {
  canvas: 'CANVAS',
  export: 'EXPORT',
  thumbnail: 'THUMBNAIL',
  preview: 'PREVIEW',
  current: () => 'PREVIEW',
}
