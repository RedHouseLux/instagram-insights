// Bundles the CSS and client JS into webapp/Index.html — the page an Apps Script web app deployment serves
// via WebApp.gs's doGet(). Code.gs and Dashboard.gs run server-side, as their own files in the Apps Script
// project; they are NOT inlined here, since the page talks to them live via google.script.run.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const parts = {
  '{{CSS}}': read('webapp/app.css'),
  // charts.js defines the global CH that app.js draws through, so it is inlined into its own earlier
  // <script> block — the template places it above {{APP}} for exactly that reason.
  '{{CHARTS}}': read('webapp/charts.js'),
  '{{APP}}': read('webapp/app.js'),
};
let out = read('webapp/index.template.html');
Object.keys(parts).forEach(token => {
  const line = new RegExp('^.*' + token.replace(/[{}]/g, '\\$&') + '.*$', 'm');
  if (!line.test(out)) throw new Error('placeholder missing: ' + token);
  out = out.replace(line, () => parts[token]);
});
['{{APP}}', '{{CHARTS}}'].forEach(token => {
  if (/<\/script>/i.test(parts[token])) {
    throw new Error(token + ' contains </script>, which would end the tag early');
  }
});
fs.writeFileSync(path.join(root, 'webapp/Index.html'), out);
console.log('webapp/Index.html written:', Math.round(out.length / 1024) + ' KB');
