const SALES_FLOW_MODULE = '/src/storage/salesFlowStorage.ts';

export async function resolve(specifier, context, nextResolve) {
  const parent = context.parentURL?.replaceAll('\\', '/');
  if (parent?.endsWith(SALES_FLOW_MODULE)) {
    if (specifier === '../lib/supabaseClient') {
      return {
        url: new URL('./stubs/supabaseClient.mjs', import.meta.url).href,
        shortCircuit: true,
      };
    }
    if (specifier === './personStorage') {
      return {
        url: new URL('./stubs/personStorage.mjs', import.meta.url).href,
        shortCircuit: true,
      };
    }
  }
  return nextResolve(specifier, context);
}
