// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  i18n: {
    defaultLocale: 'sq',
    locales: ['sq', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
