// @vitest-environment happy-dom
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';

vi.mock('./ScanBarcodeButton', () => ({ default: () => null }));
vi.mock('next/image', () => ({ default: ({ alt }: { alt: string }) => createElement('span', null, alt) }));

describe('BTB dashboard hydration boundary', () => {
  it('renders stable server placeholders before accessing a visitor-local date and stored data', () => {
    const html = renderToString(createElement(Dashboard));
    expect(html).toContain('BTB MEAL PLANNER');
    expect(html).toContain('LOCAL WORKSPACE');
    expect(html).toContain('Loading your local workspace');
    expect(html).not.toContain('Today, by the numbers');
    expect(html).not.toContain('Fitness &amp; Meal Planner');
  });
});
