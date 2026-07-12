import { register } from 'node:module';

register('./dependency-loader.mjs', import.meta.url);
