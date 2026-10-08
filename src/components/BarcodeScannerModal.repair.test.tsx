// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const scanner = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn(), clear: vi.fn() }));
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    start = scanner.start;
    stop = scanner.stop;
    clear = scanner.clear;
  },
}));

import BarcodeScannerModal from './BarcodeScannerModal';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(node: React.ReactNode) {
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => { root!.render(node); });
  return container;
}
async function setValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  await act(async () => { input.dispatchEvent(new Event('input', { bubbles: true })); });
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  container?.remove(); root = null; container = null;
  scanner.start.mockReset(); scanner.stop.mockReset(); scanner.clear.mockReset();
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn() }, configurable: true });
});

describe('BarcodeScannerModal repair', () => {
  it('offers validated manual lookup after camera denial', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    const onManualLookup = vi.fn();
    const view = await render(createElement(BarcodeScannerModal, { open: true, onClose: vi.fn(), onDetected: vi.fn(), onManualLookup }));
    expect(view.querySelector('[role="alert"]')?.textContent).toContain('HTTPS');
    await setValue(view.querySelector('#manual-barcode') as HTMLInputElement, 'not-a-code');
    await act(async () => { (view.querySelector('form') as HTMLFormElement).requestSubmit(); });
    expect(onManualLookup).not.toHaveBeenCalled();
    expect(view.querySelector('#manual-barcode-error')?.textContent).toContain('8–14 digit');
    await setValue(view.querySelector('#manual-barcode') as HTMLInputElement, '12345678');
    await act(async () => { (view.querySelector('form') as HTMLFormElement).requestSubmit(); });
    expect(onManualLookup).toHaveBeenCalledWith('12345678');
  });

  it('stops and clears a camera scanner on close even after asynchronous startup', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn() }, configurable: true });
    scanner.start.mockResolvedValue(null); scanner.stop.mockResolvedValue(undefined); scanner.clear.mockResolvedValue(undefined);
    await render(createElement(BarcodeScannerModal, { open: true, onClose: vi.fn(), onDetected: vi.fn() }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { root!.unmount(); });
    await act(async () => { await Promise.resolve(); });
    expect(scanner.start).toHaveBeenCalled();
    expect(scanner.stop).toHaveBeenCalled();
    expect(scanner.clear).toHaveBeenCalled();
  });
});
