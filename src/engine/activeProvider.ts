import { resolveActiveProvider, type ImageryProvider } from './imageryProviders';

let providerPromise: Promise<ImageryProvider> | null = null;

/** The best working imagery provider, probed once per page load. */
export const activeProvider = () => (providerPromise ??= resolveActiveProvider());
