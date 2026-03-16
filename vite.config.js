import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const THEME_DIR = 'theme', CSS_SOURCE = 'src/v-scroll.css';

const minifyCss = (css) => css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const emitCssModule = (root) => {
  const cssPath = join(root, CSS_SOURCE);
  const outDir = join(root, 'public', THEME_DIR);
  let raw = readFileSync(cssPath, 'utf-8');
  if (process.env.GH_PAGES) raw = raw.replace(/url\("\/assets\//g, `url("${base}assets/`);
  const min = minifyCss(raw);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'v-scroll.js'), `export default ${JSON.stringify(min)};\n`, 'utf-8');
  writeFileSync(join(outDir, 'v-scroll.css'), min, 'utf-8');
};

const vScrollCssPlugin = () => ({
  name: 'v-scroll-css',
  apply: 'build',
  configResolved(config) {
    emitCssModule(config.root);
  },
});

const vScrollCssDevPlugin = () => ({
  name: 'v-scroll-css-dev',
  apply: 'serve',
  configResolved(config) {
    emitCssModule(config.root);
  },
  configureServer() {
    return () => emitCssModule(process.cwd());
  },
});

const base = process.env.GH_PAGES ? '/v-scroll/' : '/';

const htmlBasePlugin = () => ({
  name: 'html-base',
  transformIndexHtml(html) {
    return html.replace('"$/": "/theme/"', `"$/": "${base}theme/"`);
  },
});

export default {
  root: __dirname,
  base,
  plugins: [vScrollCssPlugin(), vScrollCssDevPlugin(), htmlBasePlugin()],
  resolve: {
    alias: { '$/': join(__dirname, 'public', THEME_DIR) + '/' },
  },
  server: {
    host: true,
    port: 5175,
  },
};
