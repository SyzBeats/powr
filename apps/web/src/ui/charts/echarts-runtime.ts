import { BarChart, LineChart, ScatterChart } from 'echarts/charts';
import {
  DataZoomInsideComponent,
  GridSimpleComponent,
  MarkAreaComponent,
  MarkLineComponent,
} from 'echarts/components';
import { init, use as register, type EChartsType } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

/*
 * Apache ECharts, modular (§8.10, spike S-4): only the charts, components and renderer POWR
 * draws with are registered, so the rest of the library is tree-shaken. This module is the only
 * one that imports ECharts at runtime, and `EChart` loads it with `import()`: a lazy chunk that
 * never enters the startup path (§8.19) and is precached like every chunk.
 *
 * Not registered on purpose: the tooltip (its HTML content is set through `innerHTML`, which
 * Trusted Types block; the charts show their own HTML readout instead), the legend and title
 * (plain HTML around the canvas reads better and scales with the text size), the slider
 * data zoom (range chips and Earlier/Later buttons are the tap alternative to pinch and pan),
 * and the aria component (the charts write their own summary and table, NFR-A11Y-06).
 *
 * The grid is `GridSimpleComponent`, not `GridComponent`: the latter also installs the axis
 * pointer (the charts draw their own selection marker), whose `graphic[type]` lookup keeps a
 * namespace object alive. That needs Rolldown's `__export` helper in this chunk, which then
 * moves Rolldown's runtime out of the startup chunk into a second first-wave script (§8.19).
 */
register([
  LineChart,
  ScatterChart,
  BarChart,
  GridSimpleComponent,
  DataZoomInsideComponent,
  MarkAreaComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

const innerHtml = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');

/**
 * zrender's canvas painter empties its host with `host.innerHTML = ''` on init and on dispose.
 * Under Trusted Types (`require-trusted-types-for 'script'`, dev and E2E builds now, production
 * later: TD-03) that string assignment throws, even for the empty string, and would need a
 * `default` policy for the whole document. Instead this one host element gets its own
 * `innerHTML` setter that accepts only the empty string and clears the element with
 * `replaceChildren()`, which is not an injection sink. Anything else still throws.
 */
function clearWithoutHtml(host: HTMLElement): void {
  Object.defineProperty(host, 'innerHTML', {
    configurable: true,
    get(this: HTMLElement) {
      return innerHtml?.get?.call(this) as string;
    },
    set(this: HTMLElement, value: unknown) {
      if (value !== '') throw new Error('Chart hosts only accept an empty innerHTML.');
      this.replaceChildren();
    },
  });
}

/** Creates a chart in `host` (canvas renderer). */
export function createChart(host: HTMLElement): EChartsType {
  clearWithoutHtml(host);
  return init(host, null, { renderer: 'canvas' });
}
